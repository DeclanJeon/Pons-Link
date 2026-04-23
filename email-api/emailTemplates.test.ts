import { describe, expect, it } from 'vitest';
import {
  buildAcceptedEmailContent,
  buildDeclinedEmailContent,
  buildRequestEmailContent,
} from './emailTemplates.mjs';

describe('email template builders', () => {
  it('includes richer scheduling and context details in request emails', () => {
    const content = buildRequestEmailContent({
      hostDisplayName: 'Host Name',
      visitorName: 'Visitor Name',
      visitorEmail: 'visitor@example.com',
      visitorTimezone: 'America/New_York',
      requestType: 'collab',
      message: 'Would love to discuss a partnership.',
      preferredTime: 'May 5, after 10 AM',
      loungeUrl: 'https://ponslink.online/lounge/requests/req-1',
    });

    expect(content.subject).toContain('Visitor Name');
    expect(content.text).toContain('Visitor timezone: America/New_York');
    expect(content.text).toContain('Request lane: collab');
    expect(content.html).toContain('Visitor timezone');
    expect(content.html).toContain('Open request in lounge');
  });

  it('includes host/visitor previews, duration policy, and calendar links in accepted emails', () => {
    const content = buildAcceptedEmailContent({
      hostDisplayName: 'Host Name',
      visitorName: 'Visitor Name',
      visitorEmail: 'visitor@example.com',
      requestType: 'collab',
      durationPolicyLabel: '45 min collaboration default',
      scheduledStart: '2026-05-05T01:00:00.000Z',
      scheduledEnd: '2026-05-05T01:45:00.000Z',
      timezone: 'Asia/Seoul',
      hostTimezone: 'Asia/Seoul',
      visitorTimezone: 'America/New_York',
      hostLocalPreview: 'May 5, 10:00 AM',
      visitorLocalPreview: 'May 4, 9:00 PM',
      meetingUrl: 'https://ponslink.online/session-access/booking-1',
      directCallUrl: 'https://ponslink.online/session-access/booking-1',
      roomTitle: 'Session with Host Name',
      googleCalendarUrl: 'https://calendar.google.com/calendar/render?action=TEMPLATE',
      calendarEventUrl: 'https://calendar.google.com/calendar/event?eid=abc123',
    });

    expect(content.visitor.text).toContain('Request lane: collab');
    expect(content.visitor.text).toContain('Duration policy: 45 min collaboration default');
    expect(content.visitor.text).toContain('Host-local preview: May 5, 10:00 AM');
    expect(content.visitor.text).toContain('Visitor-local preview: May 4, 9:00 PM');
    expect(content.visitor.text).toContain('Google Calendar에 추가');
    expect(content.visitor.html).toContain('Host-local preview');
    expect(content.visitor.html).toContain('Visitor-local preview');
    expect(content.host.html).toContain('Google Calendar event');
    expect(content.attachments[0].filename).toBe('ponslink-session.ics');
    expect(content.attachments[0].content).toContain('BEGIN:VCALENDAR');
  });

  it('includes request context in declined emails', () => {
    const content = buildDeclinedEmailContent({
      visitorName: 'Visitor Name',
      requestType: 'mentoring',
      visitorTimezone: 'America/New_York',
      durationPolicyLabel: '60 min mentoring default',
      hostDisplayName: 'Host Name',
      hostTimezone: 'Asia/Seoul',
    });

    expect(content.text).toContain('Request lane: mentoring');
    expect(content.text).toContain('Visitor timezone: America/New_York');
    expect(content.text).toContain('Host timezone: Asia/Seoul');
    expect(content.html).toContain('Duration policy');
  });
});
