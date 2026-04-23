import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAcceptedEmailPayload,
  buildDeclinedEmailPayload,
  buildRequestEmailPayload,
  getConfiguredEmailApiUrl,
  resolveEmailApiUrl,
  sendEmailNotification,
} from './emailNotifications';

describe('emailNotifications', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('normalizes the configured api url', () => {
    expect(resolveEmailApiUrl('http://localhost:3001/')).toBe('http://localhost:3001');
    expect(resolveEmailApiUrl('   ')).toBeNull();
    expect(resolveEmailApiUrl(undefined)).toBeNull();
  });

  it('prefers the explicit email api url over the legacy shared api url', () => {
    vi.stubEnv('VITE_EMAIL_API_URL', 'http://localhost:3002/');
    vi.stubEnv('VITE_API_URL', 'https://api.pons.link');

    expect(getConfiguredEmailApiUrl()).toBe('http://localhost:3002');
  });

  it('builds the request email payload with visitor context', () => {
    const payload = buildRequestEmailPayload({
      hostEmail: 'host@example.com',
      hostDisplayName: 'Host Name',
      visitorName: 'Visitor Name',
      visitorEmail: 'visitor@example.com',
      visitorTimezone: 'America/New_York',
      requestType: 'collab',
      message: 'Let us talk about a product partnership.',
      preferredTime: '2026-05-01 10:00',
      loungeUrl: 'http://localhost:3000/lounge/requests',
    });

    expect(payload).toMatchObject({
      hostEmail: 'host@example.com',
      hostDisplayName: 'Host Name',
      visitorName: 'Visitor Name',
      visitorEmail: 'visitor@example.com',
      visitorTimezone: 'America/New_York',
      requestType: 'collab',
      message: 'Let us talk about a product partnership.',
      preferredTime: '2026-05-01 10:00',
      loungeUrl: 'http://localhost:3000/lounge/requests',
    });
  });

  it('builds the accepted email payload with scheduling context', () => {
    const payload = buildAcceptedEmailPayload({
      hostEmail: 'host@example.com',
      hostDisplayName: 'Host Name',
      hostTimezone: 'Asia/Seoul',
      visitorName: 'Visitor Name',
      visitorEmail: 'visitor@example.com',
      visitorTimezone: 'America/New_York',
      visitorLocalPreview: 'May 1, 12:00 AM',
      hostLocalPreview: 'May 1, 01:00 PM',
      requestType: 'collab',
      durationPolicyLabel: '45 min collaboration default',
      scheduledStart: '2026-05-01T04:00:00.000Z',
      scheduledEnd: '2026-05-01T04:45:00.000Z',
      timezone: 'Asia/Seoul',
      meetingUrl: 'http://localhost:3000/session-access/booking-1',
      directCallUrl: 'http://localhost:3000/session-access/booking-1',
      roomTitle: 'Session with Host Name',
    });

    expect(payload).toMatchObject({
      hostTimezone: 'Asia/Seoul',
      visitorTimezone: 'America/New_York',
      visitorLocalPreview: 'May 1, 12:00 AM',
      hostLocalPreview: 'May 1, 01:00 PM',
      requestType: 'collab',
      durationPolicyLabel: '45 min collaboration default',
      roomTitle: 'Session with Host Name',
    });
  });

  it('builds the declined email payload with host and request context', () => {
    const payload = buildDeclinedEmailPayload({
      visitorEmail: 'visitor@example.com',
      visitorName: 'Visitor Name',
      visitorTimezone: 'America/New_York',
      requestType: 'collab',
      durationPolicyLabel: '45 min collaboration default',
      hostDisplayName: 'Host Name',
      hostTimezone: 'Asia/Seoul',
    });

    expect(payload).toMatchObject({
      visitorEmail: 'visitor@example.com',
      visitorName: 'Visitor Name',
      visitorTimezone: 'America/New_York',
      requestType: 'collab',
      durationPolicyLabel: '45 min collaboration default',
      hostDisplayName: 'Host Name',
      hostTimezone: 'Asia/Seoul',
    });
  });

  it('skips requests when the email api is disabled', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch');

    const result = await sendEmailNotification({
      endpoint: '/api/email/request',
      payload: { ok: true },
      apiUrl: null,
    });

    expect(result).toEqual({ status: 'disabled' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns unavailable when the email api cannot be reached', async () => {
    vi.spyOn(window, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await sendEmailNotification({
      endpoint: '/api/email/request',
      payload: { ok: true },
      apiUrl: 'http://localhost:3001',
      timeoutMs: 10,
    });

    expect(result.status).toBe('unavailable');
    expect(result.error).toBe('Failed to fetch');
  });

  it('returns sent when the email api succeeds', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await sendEmailNotification({
      endpoint: '/api/email/request',
      payload: { ok: true },
      apiUrl: 'http://localhost:3001',
    });

    expect(result).toEqual({ status: 'sent' });
  });

  it('adds a bearer authorization header when a session token is provided', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await sendEmailNotification({
      endpoint: '/api/email/accepted',
      payload: { ok: true },
      apiUrl: 'http://localhost:3001',
      bearerToken: 'backend-session-token',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3001/api/email/accepted',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer backend-session-token',
        }),
      }),
    );
  });

  it('omits the bearer authorization header when the configured surface does not expose session auth', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) {
        return new Response(JSON.stringify({ ok: false, error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await sendEmailNotification({
      endpoint: '/api/email/declined',
      payload: { ok: true },
      apiUrl: 'http://localhost:3001',
      bearerToken: 'backend-session-token',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3001/api/email/declined',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
    const request = fetchSpy.mock.calls.find(([url]) => String(url).endsWith('/api/email/declined'));
    expect(request?.[1]).toBeDefined();
    expect((request?.[1] as RequestInit).headers).toEqual({
      'Content-Type': 'application/json',
    });
  });
});
