import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_FREE_BUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';
const GOOGLE_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars';
const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

export const getCalendarConfig = (env = process.env) => ({
  clientId: env.GOOGLE_CLIENT_ID ?? '',
  clientSecret: env.GOOGLE_CLIENT_SECRET ?? '',
  redirectUri: env.GOOGLE_REDIRECT_URI ?? `http://localhost:${env.PORT ?? 3001}/api/calendar/callback`,
  frontendUrl: env.FRONTEND_URL ?? env.VITE_APP_URL ?? 'http://localhost:5173',
  calendarId: env.GOOGLE_CALENDAR_ID ?? 'primary',
  tokenFile: path.resolve(env.CALENDAR_TOKEN_FILE ?? './email-api/calendar-tokens.json'),
  scopes: DEFAULT_SCOPES,
});

export const isCalendarConfigured = (config) => Boolean(config.clientId && config.clientSecret && config.redirectUri);

const ensureDirForFile = async (filePath) => {
  await mkdir(path.dirname(filePath), { recursive: true });
};

export const readCalendarTokens = async (config) => {
  try {
    const raw = await readFile(config.tokenFile, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const writeCalendarTokens = async (config, tokens) => {
  await ensureDirForFile(config.tokenFile);
  await writeFile(config.tokenFile, JSON.stringify(tokens, null, 2));
};

export const buildCalendarAuthUrl = (config) => {
  if (!isCalendarConfigured(config)) {
    throw new Error('Google Calendar OAuth is not configured');
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: config.scopes.join(' '),
    state: Buffer.from(JSON.stringify({ frontendUrl: config.frontendUrl })).toString('base64url'),
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
};

const decodeState = (state, config) => {
  if (!state) return { frontendUrl: config.frontendUrl };
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    return { frontendUrl: parsed.frontendUrl || config.frontendUrl };
  } catch {
    return { frontendUrl: config.frontendUrl };
  }
};

const postForm = async (url, form, fetchImpl = fetch) => {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
  });
  if (!response.ok) {
    throw new Error(`Google OAuth failed with ${response.status}`);
  }
  return response.json();
};

export const exchangeCalendarCode = async ({ code, state, config, fetchImpl = fetch }) => {
  if (!isCalendarConfigured(config)) {
    throw new Error('Google Calendar OAuth is not configured');
  }

  const tokenResponse = await postForm(GOOGLE_TOKEN_URL, {
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  }, fetchImpl);

  const tokenPayload = {
    ...tokenResponse,
    created_at: Date.now(),
  };
  await writeCalendarTokens(config, tokenPayload);
  return {
    tokens: tokenPayload,
    frontendUrl: decodeState(state, config).frontendUrl,
  };
};

export const isCalendarAuthorized = async (config) => Boolean(await readCalendarTokens(config));

export const getValidAccessToken = async (config, fetchImpl = fetch) => {
  const tokens = await readCalendarTokens(config);
  if (!tokens) {
    throw new Error('Google Calendar is not authorized');
  }

  const expiresAt = (tokens.created_at ?? 0) + (tokens.expires_in ?? 0) * 1000;
  if (tokens.access_token && Date.now() < expiresAt - 60_000) {
    return { accessToken: tokens.access_token, tokens };
  }
  if (!tokens.refresh_token) {
    throw new Error('Stored Google Calendar token has no refresh token');
  }

  const refreshed = await postForm(GOOGLE_TOKEN_URL, {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: tokens.refresh_token,
    grant_type: 'refresh_token',
  }, fetchImpl);

  const merged = {
    ...tokens,
    ...refreshed,
    refresh_token: refreshed.refresh_token ?? tokens.refresh_token,
    created_at: Date.now(),
  };
  await writeCalendarTokens(config, merged);
  return { accessToken: merged.access_token, tokens: merged };
};

const googleJsonFetch = async ({ url, method = 'GET', body, config, fetchImpl = fetch }) => {
  const { accessToken } = await getValidAccessToken(config, fetchImpl);
  const response = await fetchImpl(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`Google Calendar API failed with ${response.status}`);
  }
  return response.json();
};

export const getCalendarConnectionStatus = async (config) => ({
  configured: isCalendarConfigured(config),
  authorized: await isCalendarAuthorized(config),
  calendarId: config.calendarId,
});

export const getCalendarBusySlots = async ({ start, end, config, fetchImpl = fetch }) => {
  if (!(await isCalendarAuthorized(config))) {
    return { authorized: false, busy: [] };
  }
  const body = {
    timeMin: start,
    timeMax: end,
    items: [{ id: config.calendarId }],
  };
  const data = await googleJsonFetch({ url: GOOGLE_FREE_BUSY_URL, method: 'POST', body, config, fetchImpl });
  return {
    authorized: true,
    busy: data.calendars?.[config.calendarId]?.busy ?? [],
  };
};

export const createCalendarEvent = async ({
  start,
  end,
  summary,
  description,
  location,
  attendees = [],
  config,
  fetchImpl = fetch,
}) => {
  if (!(await isCalendarAuthorized(config))) {
    return { authorized: false, htmlLink: null, eventId: null };
  }

  const url = `${GOOGLE_EVENTS_URL}/${encodeURIComponent(config.calendarId)}/events`;
  const data = await googleJsonFetch({
    url,
    method: 'POST',
    body: {
      summary,
      description,
      location,
      start: { dateTime: start },
      end: { dateTime: end },
      attendees,
    },
    config,
    fetchImpl,
  });
  return {
    authorized: true,
    htmlLink: data.htmlLink ?? null,
    eventId: data.id ?? null,
  };
};
