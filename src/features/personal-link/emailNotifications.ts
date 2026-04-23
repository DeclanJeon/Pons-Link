import {
  getConfiguredEmailApiUrl as getConfiguredBackendEmailApiUrl,
  resolveBackendApiUrl,
  supportsSessionAuthAtApiUrl,
} from './backendSurface';

export type EmailNotificationStatus = 'sent' | 'disabled' | 'unavailable' | 'failed';

export interface EmailNotificationResult {
  status: EmailNotificationStatus;
  error?: string;
}

interface SendEmailNotificationOptions {
  endpoint: '/api/email/request' | '/api/email/accepted' | '/api/email/declined';
  payload: Record<string, unknown>;
  apiUrl?: string | null;
  bearerToken?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10000;

const compactPayload = <T extends Record<string, unknown>>(payload: T) => {
  const next: Record<string, unknown> = {};
  for (const key in payload) {
    const value = payload[key];
    if (value !== undefined && value !== null && value !== '') {
      next[key] = value;
    }
  }
  return next as T;
};

export const buildRequestEmailPayload = (payload: {
  hostEmail: string;
  hostDisplayName: string;
  visitorName: string;
  visitorEmail: string;
  visitorTimezone?: string;
  requestType: string;
  message: string;
  preferredTime?: string;
  loungeUrl: string;
}) => compactPayload(payload);

// Public alias request notifications are now queued by the backend.
// Keep the request payload builder as a compatibility shim while the
// remaining host-side email flows still share this module.

export const buildAcceptedEmailPayload = (payload: {
  hostEmail: string;
  hostDisplayName: string;
  hostTimezone: string;
  visitorName: string;
  visitorEmail: string;
  visitorTimezone?: string;
  visitorLocalPreview?: string;
  hostLocalPreview?: string;
  requestType: string;
  durationPolicyLabel?: string;
  scheduledStart: string;
  scheduledEnd: string;
  timezone: string;
  meetingUrl: string;
  directCallUrl: string;
  roomTitle: string;
}) => compactPayload(payload);

export const buildDeclinedEmailPayload = (payload: {
  visitorEmail: string;
  visitorName: string;
  visitorTimezone?: string;
  requestType: string;
  durationPolicyLabel?: string;
  hostDisplayName: string;
  hostTimezone: string;
}) => compactPayload(payload);

export const resolveEmailApiUrl = (apiUrl?: string | null) => {
  return resolveBackendApiUrl(apiUrl);
};

export const isEmailApiEnabled = () => import.meta.env.VITE_ENABLE_EMAIL_API === 'true';
export const getConfiguredEmailApiUrl = () => getConfiguredBackendEmailApiUrl();

export const sendEmailNotification = async ({
  endpoint,
  payload,
  apiUrl,
  bearerToken,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: SendEmailNotificationOptions): Promise<EmailNotificationResult> => {
  const baseUrl = apiUrl === undefined
    ? (isEmailApiEnabled() ? getConfiguredEmailApiUrl() : null)
    : resolveEmailApiUrl(apiUrl);
  if (!baseUrl) {
    return { status: 'disabled' };
  }

  const controller = new globalThis.AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (bearerToken && await supportsSessionAuthAtApiUrl(baseUrl)) {
      headers.Authorization = `Bearer ${bearerToken}`;
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        status: 'failed',
        error: `Email API responded with ${response.status}`,
      };
    }

    return { status: 'sent' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown email notification error';
    return {
      status: message.toLowerCase().includes('fetch') || message.toLowerCase().includes('network') || message.toLowerCase().includes('abort')
        ? 'unavailable'
        : 'failed',
      error: message,
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
};
