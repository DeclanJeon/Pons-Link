import http from 'node:http';
import nodemailer from 'nodemailer';
import {
  buildAcceptedEmailContent,
  buildDeclinedEmailContent,
  buildGoogleCalendarUrl,
  buildRequestEmailContent,
} from './emailTemplates.mjs';
import {
  buildCalendarAuthUrl,
  createCalendarEvent,
  exchangeCalendarCode,
  getCalendarBusySlots,
  getCalendarConfig,
  getCalendarConnectionStatus,
} from './calendarService.mjs';

const PORT = Number(process.env.PORT ?? 3001);
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM ?? SMTP_USER;

const allowedOrigins = new Set(['https://ponslink.online']);
const calendarConfig = getCalendarConfig(process.env);

const isAllowedOrigin = (origin) => {
  if (!origin) return false;
  if (allowedOrigins.has(origin)) return true;

  try {
    const url = new URL(origin);
    return ['localhost', '127.0.0.1'].includes(url.hostname);
  } catch {
    return false;
  }
};

const smtpConfigured = Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && SMTP_FROM);

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })
  : null;

const json = (res, statusCode, payload, origin) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  res.writeHead(statusCode, headers);
  res.end(statusCode === 204 ? undefined : JSON.stringify(payload));
};

const redirect = (res, location) => {
  res.writeHead(302, { Location: location });
  res.end();
};

const readJsonBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
};

const requireFields = (payload, fields) => {
  const missing = fields.filter((field) => {
    const value = payload[field];
    return typeof value !== 'string' || !value.trim();
  });

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
};

const sendMail = async ({ to, subject, text, html, attachments }) => {
  if (!transporter) {
    throw new Error('SMTP is not configured');
  }

  return transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    text,
    html,
    attachments,
  });
};

const sendRequestEmail = async (payload) => {
  requireFields(payload, ['hostEmail', 'hostDisplayName', 'visitorName', 'visitorEmail', 'requestType', 'message', 'loungeUrl']);
  const content = buildRequestEmailContent(payload);
  return sendMail({
    to: payload.hostEmail,
    ...content,
  });
};

const sendAcceptedEmails = async (payload) => {
  requireFields(payload, ['hostEmail', 'hostDisplayName', 'visitorName', 'visitorEmail', 'scheduledStart', 'scheduledEnd', 'timezone', 'meetingUrl', 'roomTitle', 'directCallUrl']);

  const summary = `${payload.hostDisplayName} · ${payload.roomTitle}`;
  const description = [
    `${payload.hostDisplayName}님과 ${payload.visitorName}님의 세션이 확정되었습니다.`,
    `Request lane: ${payload.requestType ?? 'general'}`,
    `Duration policy: ${payload.durationPolicyLabel ?? 'Not specified'}`,
    `Host timezone: ${payload.hostTimezone ?? payload.timezone}`,
    `Visitor timezone: ${payload.visitorTimezone ?? 'Unknown'}`,
    `Direct Call Link: ${payload.directCallUrl}`,
    `Landing / 안내 페이지: ${payload.meetingUrl}`,
  ].join('\n');
  const googleCalendarUrl = buildGoogleCalendarUrl({
    title: summary,
    start: payload.scheduledStart,
    end: payload.scheduledEnd,
    details: description,
    location: payload.directCallUrl,
  });

  let calendarEvent = { authorized: false, htmlLink: null, eventId: null };
  try {
    calendarEvent = await createCalendarEvent({
      start: payload.scheduledStart,
      end: payload.scheduledEnd,
      summary,
      description,
      location: payload.directCallUrl,
      attendees: [
        { email: payload.hostEmail },
        { email: payload.visitorEmail, displayName: payload.visitorName },
      ],
      config: calendarConfig,
    });
  } catch (error) {
    console.error('[email-api] calendar event creation failed', error instanceof Error ? error.message : error);
  }

  const content = buildAcceptedEmailContent({
    ...payload,
    requestType: payload.requestType ?? 'general',
    googleCalendarUrl,
    calendarEventUrl: calendarEvent.htmlLink ?? undefined,
  });

  const infos = await Promise.all([
    sendMail({
      to: payload.visitorEmail,
      subject: content.visitor.subject,
      text: content.visitor.text,
      html: content.visitor.html,
      attachments: content.attachments,
    }),
    sendMail({
      to: payload.hostEmail,
      subject: content.host.subject,
      text: content.host.text,
      html: content.host.html,
      attachments: content.attachments,
    }),
  ]);

  return {
    infos,
    googleCalendarUrl,
    calendarEventUrl: calendarEvent.htmlLink,
    calendarAuthorized: calendarEvent.authorized,
  };
};

const sendDeclinedEmail = async (payload) => {
  requireFields(payload, ['visitorEmail', 'visitorName', 'hostDisplayName']);
  const content = buildDeclinedEmailContent(payload);
  return sendMail({
    to: payload.visitorEmail,
    subject: `[PonsLink] ${payload.hostDisplayName}님이 이번 요청을 진행하지 않기로 했습니다`,
    text: content.text,
    html: content.html,
  });
};

const route = async (req, res) => {
  const origin = req.headers.origin;
  const requestUrl = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (req.method === 'OPTIONS') {
    return json(res, 204, {}, origin);
  }

  try {
    if (req.method === 'GET' && requestUrl.pathname === '/api/health') {
      if (transporter) {
        await transporter.verify();
      }

      return json(res, 200, { ok: true, smtpConfigured }, origin);
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/calendar/status') {
      const status = await getCalendarConnectionStatus(calendarConfig);
      return json(res, 200, status, origin);
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/calendar/auth') {
      const url = buildCalendarAuthUrl(calendarConfig);
      return json(res, 200, { ok: true, url }, origin);
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/calendar/callback') {
      const code = requestUrl.searchParams.get('code');
      const state = requestUrl.searchParams.get('state');
      if (!code) {
        throw new Error('Missing Google OAuth code');
      }
      const result = await exchangeCalendarCode({ code, state, config: calendarConfig });
      return redirect(res, `${result.frontendUrl.replace(/\/$/, '')}/lounge?calendar_connected=1`);
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/calendar/free-busy') {
      const start = requestUrl.searchParams.get('start');
      const end = requestUrl.searchParams.get('end');
      if (!start || !end) {
        throw new Error('Missing required fields: start, end');
      }
      const busy = await getCalendarBusySlots({ start, end, config: calendarConfig });
      return json(res, 200, busy, origin);
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/calendar/event') {
      const payload = await readJsonBody(req);
      requireFields(payload, ['start', 'end', 'summary']);
      const event = await createCalendarEvent({
        start: payload.start,
        end: payload.end,
        summary: payload.summary,
        description: payload.description ?? '',
        location: payload.location ?? '',
        attendees: Array.isArray(payload.attendees) ? payload.attendees : [],
        config: calendarConfig,
      });
      return json(res, 200, { ok: true, ...event }, origin);
    }

    if (req.method === 'POST' && requestUrl.pathname.startsWith('/api/email/')) {
      if (!transporter) {
        return json(res, 503, { ok: false, error: 'SMTP is not configured' }, origin);
      }

      if (requestUrl.pathname === '/api/email/request') {
        const payload = await readJsonBody(req);
        const info = await sendRequestEmail(payload);
        return json(res, 200, { ok: true, messageId: info.messageId, accepted: info.accepted }, origin);
      }

      if (requestUrl.pathname === '/api/email/accepted') {
        const payload = await readJsonBody(req);
        const result = await sendAcceptedEmails(payload);
        return json(res, 200, {
          ok: true,
          messageIds: result.infos.map((info) => info.messageId),
          googleCalendarUrl: result.googleCalendarUrl,
          calendarEventUrl: result.calendarEventUrl,
          calendarAuthorized: result.calendarAuthorized,
        }, origin);
      }

      if (requestUrl.pathname === '/api/email/declined') {
        const payload = await readJsonBody(req);
        const info = await sendDeclinedEmail(payload);
        return json(res, 200, { ok: true, messageId: info.messageId, accepted: info.accepted }, origin);
      }
    }

    return json(res, 404, { ok: false, error: 'Not found' }, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    console.error('[email-api]', message);
    return json(res, 500, { ok: false, error: message }, origin);
  }
};

const server = http.createServer((req, res) => {
  void route(req, res);
});

server.listen(PORT, () => {
  console.log(`[email-api] listening on http://localhost:${PORT}`);
});
