import { beforeEach, describe, expect, it } from 'vitest';
import { localRepository } from './localRepository';
import {
  PERSONAL_LINK_PUBLIC_PROFILE_KEY,
  PERSONAL_LINK_REQUESTS_KEY,
  PERSONAL_LINK_BOOKINGS_KEY,
  PERSONAL_LINK_SESSIONS_KEY,
  PERSONAL_LINK_EMAIL_DELIVERIES_KEY,
} from './storageKeys';

describe('localRepository request creation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      PERSONAL_LINK_PUBLIC_PROFILE_KEY,
      JSON.stringify({ userId: 'host-1', slug: 'declan' }),
    );
  });

  it('stores a pending meeting request at the front of lounge request history', async () => {
    window.localStorage.setItem(
      PERSONAL_LINK_REQUESTS_KEY,
      JSON.stringify([
        {
          id: 'older-req',
          hostUserId: 'host-1',
          hostSlug: 'declan',
          visitorName: 'Older Visitor',
          visitorEmail: 'older@example.com',
          visitorTimezone: 'Asia/Seoul',
          requestType: 'general',
          message: 'Older request',
          preferredTimeNote: 'Tomorrow',
          status: 'pending',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]),
    );

    const request = await localRepository.createRequest({
      hostSlug: 'Declan',
      visitorName: 'Visitor Name',
      visitorEmail: 'visitor@example.com',
      visitorTimezone: 'Asia/Seoul',
      deliveryMode: 'mediated',
      requestType: 'schedule',
      message: '제품 방향을 논의하고 싶습니다.',
      preferredTimeNote: '2026-04-30 14:00',
    });

    const stored = JSON.parse(window.localStorage.getItem(PERSONAL_LINK_REQUESTS_KEY) || '[]');
    expect(stored).toHaveLength(2);
    expect(stored[0]).toMatchObject({
      id: request.id,
      hostUserId: 'host-1',
      hostSlug: 'declan',
      visitorName: 'Visitor Name',
      visitorEmail: 'visitor@example.com',
      visitorTimezone: 'Asia/Seoul',
      requestType: 'schedule',
      message: '제품 방향을 논의하고 싶습니다.',
      preferredTimeNote: '2026-04-30 14:00',
      status: 'pending',
    });
    expect(stored[0].expiresAt).toBeTruthy();
    expect(stored[1].id).toBe('older-req');
  });
});

describe('localRepository accept flow', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      PERSONAL_LINK_PUBLIC_PROFILE_KEY,
      JSON.stringify({ userId: 'host-1', slug: 'alex-dev' }),
    );
    window.localStorage.setItem(
      PERSONAL_LINK_REQUESTS_KEY,
      JSON.stringify([
        {
          id: 'req-1',
          hostUserId: 'host-1',
          hostSlug: 'alex-dev',
          visitorName: 'B User',
          visitorEmail: 'b@example.com',
          visitorTimezone: 'Asia/Seoul',
          requestType: 'general',
          message: 'Hello',
          preferredTimeNote: 'Tomorrow 3pm',
          status: 'pending',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]),
    );
  });

  it('acceptRequest creates a booking, session reservation, and email delivery', async () => {
    const booking = await localRepository.acceptRequest('req-1', {
      proposedStartAt: '2026-05-01T10:00:00.000Z',
      proposedEndAt: '2026-05-01T10:30:00.000Z',
      timezone: 'Asia/Seoul',
      roomType: 'audio-one-to-one',
    });

    expect(booking.status).toBe('confirmed');
    expect(booking.guestEmail).toBe('b@example.com');

    // Session reservation should exist
    const sessions = JSON.parse(window.localStorage.getItem(PERSONAL_LINK_SESSIONS_KEY) || '[]');
    expect(sessions.length).toBe(1);
    expect(sessions[0].bookingId).toBe(booking.id);
    expect(sessions[0].roomType).toBe('audio-one-to-one');
    expect(sessions[0].status).toBe('scheduled');

    // Email delivery should exist
    const deliveries = JSON.parse(window.localStorage.getItem(PERSONAL_LINK_EMAIL_DELIVERIES_KEY) || '[]');
    expect(deliveries.length).toBe(1);
    expect(deliveries[0].bookingId).toBe(booking.id);
    expect(deliveries[0].recipientEmail).toBe('b@example.com');
    expect(deliveries[0].deliveryStatus).toBe('sent');
  });

  it('counterProposeRequest creates a booking, session reservation, and email delivery', async () => {
    const booking = await localRepository.counterProposeRequest('req-1', {
      proposedStartAt: '2026-05-02T14:00:00.000Z',
      proposedEndAt: '2026-05-02T14:30:00.000Z',
      timezone: 'Asia/Seoul',
      roomType: 'video-one-to-one',
    });

    expect(booking.status).toBe('proposed');

    const sessions = JSON.parse(window.localStorage.getItem(PERSONAL_LINK_SESSIONS_KEY) || '[]');
    expect(sessions.length).toBe(1);

    const deliveries = JSON.parse(window.localStorage.getItem(PERSONAL_LINK_EMAIL_DELIVERIES_KEY) || '[]');
    expect(deliveries.length).toBe(1);
  });
});
