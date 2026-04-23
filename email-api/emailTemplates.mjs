const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export const toIcsDate = (value) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

export const buildGoogleCalendarUrl = ({ title, start, end, details, location }) => {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${toIcsDate(start)}/${toIcsDate(end)}`,
    details,
    location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const buildIcs = ({ start, end, summary, description, location }) => {
  const uid = `${Date.now()}@ponslink.local`;
  const dtStamp = toIcsDate(new Date().toISOString());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PonsLink//Email API//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${summary.replaceAll(/\n/g, ' ')}`,
    `DESCRIPTION:${description.replaceAll(/\n/g, '\\n')}`,
    `LOCATION:${location.replaceAll(/\n/g, ' ')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
};

export const buildRequestEmailContent = ({
  hostDisplayName,
  visitorName,
  visitorEmail,
  visitorTimezone,
  requestType,
  message,
  preferredTime,
  loungeUrl,
}) => {
  const subject = `[PonsLink] ${visitorName}님이 새로운 요청을 보냈습니다`;
  const preferred = preferredTime?.trim() ? preferredTime : '미입력';
  const timezone = visitorTimezone?.trim() ? visitorTimezone : 'Unknown';
  const text = [
    `${hostDisplayName}님, 새로운 Request가 도착했습니다.`,
    '',
    `Visitor: ${visitorName} <${visitorEmail}>`,
    `Request lane: ${requestType}`,
    `Visitor timezone: ${timezone}`,
    `Preferred timing: ${preferred}`,
    '',
    message,
    '',
    `Open request in lounge: ${loungeUrl}`,
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;background:#f8fafc;padding:24px">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:28px">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#6366f1">New request</p>
        <h2 style="margin:0 0 16px;font-size:24px;color:#0f172a">${escapeHtml(hostDisplayName)}님, 새로운 요청이 도착했습니다.</h2>
        <div style="display:grid;gap:10px;margin:0 0 18px;padding:16px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0">
          <p style="margin:0"><strong>Visitor</strong><br />${escapeHtml(visitorName)} &lt;${escapeHtml(visitorEmail)}&gt;</p>
          <p style="margin:0"><strong>Request lane</strong><br />${escapeHtml(requestType)}</p>
          <p style="margin:0"><strong>Visitor timezone</strong><br />${escapeHtml(timezone)}</p>
          <p style="margin:0"><strong>Preferred timing</strong><br />${escapeHtml(preferred)}</p>
        </div>
        <div style="margin:0 0 18px;padding:18px;border-radius:16px;background:#111827;color:#e5e7eb;white-space:pre-wrap">${escapeHtml(message)}</div>
        <a href="${escapeHtml(loungeUrl)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#111827;color:#fff;text-decoration:none;font-weight:600">Open request in lounge</a>
      </div>
    </div>
  `;

  return { subject, text, html };
};

export const buildAcceptedEmailContent = ({
  hostDisplayName,
  visitorName,
  visitorEmail,
  requestType,
  durationPolicyLabel,
  scheduledStart,
  scheduledEnd,
  timezone,
  hostTimezone,
  visitorTimezone,
  hostLocalPreview,
  visitorLocalPreview,
  meetingUrl,
  directCallUrl,
  roomTitle,
  googleCalendarUrl,
  calendarEventUrl,
}) => {
  const start = formatDateTime(scheduledStart);
  const end = formatDateTime(scheduledEnd);
  const summary = `${hostDisplayName} · ${roomTitle}`;
  const description = [
    `${hostDisplayName}님과 ${visitorName}님의 세션이 확정되었습니다.`,
    `Request lane: ${requestType}`,
    `Duration policy: ${durationPolicyLabel || 'Not specified'}`,
    `Host timezone: ${hostTimezone || timezone}`,
    `Visitor timezone: ${visitorTimezone || 'Unknown'}`,
    `Host-local preview: ${hostLocalPreview || start}`,
    `Visitor-local preview: ${visitorLocalPreview || start}`,
    `Direct Call Link: ${directCallUrl}`,
    `Landing / 안내 페이지: ${meetingUrl}`,
  ].join('\n');
  const attachments = [
    {
      filename: 'ponslink-session.ics',
      content: buildIcs({
        start: scheduledStart,
        end: scheduledEnd,
        summary,
        description,
        location: directCallUrl,
      }),
      contentType: 'text/calendar; charset=utf-8; method=REQUEST',
    },
  ];

  const sharedDetailsText = [
    `${start} ~ ${end} (${timezone})`,
    `Request lane: ${requestType}`,
    `Duration policy: ${durationPolicyLabel || 'Not specified'}`,
    `Host-local preview: ${hostLocalPreview || start}`,
    `Visitor-local preview: ${visitorLocalPreview || start}`,
    `Direct Call Link: ${directCallUrl}`,
    `Google Calendar에 추가: ${googleCalendarUrl}`,
    calendarEventUrl ? `Google Calendar event: ${calendarEventUrl}` : null,
    `안내 페이지: ${meetingUrl}`,
  ].filter(Boolean).join('\n');

  const sharedDetailsHtml = `
    <div style="display:grid;gap:10px;margin:16px 0;padding:18px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0">
      <p style="margin:0"><strong>Time</strong><br />${escapeHtml(start)} ~ ${escapeHtml(end)} (${escapeHtml(timezone)})</p>
      <p style="margin:0"><strong>Request lane</strong><br />${escapeHtml(requestType)}</p>
      <p style="margin:0"><strong>Duration policy</strong><br />${escapeHtml(durationPolicyLabel || 'Not specified')}</p>
      <p style="margin:0"><strong>Host-local preview</strong><br />${escapeHtml(hostLocalPreview || start)}</p>
      <p style="margin:0"><strong>Visitor-local preview</strong><br />${escapeHtml(visitorLocalPreview || start)}</p>
      <p style="margin:0"><strong>Direct Call Link</strong><br /><a href="${escapeHtml(directCallUrl)}">${escapeHtml(directCallUrl)}</a></p>
      <p style="margin:0"><strong>Google Calendar 등록</strong><br /><a href="${escapeHtml(googleCalendarUrl)}">Google Calendar에 추가</a></p>
      ${calendarEventUrl ? `<p style="margin:0"><strong>Google Calendar event</strong><br /><a href="${escapeHtml(calendarEventUrl)}">Host calendar event</a></p>` : ''}
      <p style="margin:0"><strong>안내 페이지</strong><br /><a href="${escapeHtml(meetingUrl)}">${escapeHtml(meetingUrl)}</a></p>
    </div>
  `;

  return {
    visitor: {
      subject: `[PonsLink] ${hostDisplayName}님과의 일정이 확정되었습니다`,
      text: [
        `${visitorName}님, 일정이 확정되었습니다.`,
        sharedDetailsText,
      ].join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;background:#f8fafc;padding:24px">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:28px">
            <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#6366f1">Booking confirmed</p>
            <h2 style="margin:0 0 12px;font-size:24px;color:#0f172a">${escapeHtml(visitorName)}님, 일정이 확정되었습니다.</h2>
            <p style="margin:0;color:#475569">이 메일에는 일정 확인, Direct Call Link, 캘린더 등록 링크가 함께 들어 있습니다.</p>
            ${sharedDetailsHtml}
          </div>
        </div>
      `,
    },
    host: {
      subject: `[PonsLink] ${visitorName}님과의 일정이 확정되었습니다`,
      text: [
        `${hostDisplayName}님, ${visitorName}님과의 일정이 확정되었습니다.`,
        `Visitor email: ${visitorEmail}`,
        sharedDetailsText,
      ].join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;background:#f8fafc;padding:24px">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:28px">
            <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#6366f1">Booking confirmed</p>
            <h2 style="margin:0 0 12px;font-size:24px;color:#0f172a">${escapeHtml(hostDisplayName)}님, 일정이 확정되었습니다.</h2>
            <p style="margin:0;color:#475569">상대: ${escapeHtml(visitorName)} (${escapeHtml(visitorEmail)})</p>
            ${sharedDetailsHtml}
          </div>
        </div>
      `,
    },
    attachments,
  };
};

export const buildDeclinedEmailContent = ({
  visitorName,
  requestType,
  visitorTimezone,
  durationPolicyLabel,
  hostDisplayName,
  hostTimezone,
}) => {
  const text = [
    `${visitorName}님, ${hostDisplayName}님이 이번 요청은 진행하지 않기로 했습니다.`,
    `Request lane: ${requestType}`,
    `Visitor timezone: ${visitorTimezone || 'Unknown'}`,
    `Host timezone: ${hostTimezone}`,
    `Duration policy: ${durationPolicyLabel || 'Not specified'}`,
    '필요하면 다른 시간이나 맥락으로 다시 요청해 주세요.',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;background:#f8fafc;padding:24px">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:28px">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#f59e0b">Request update</p>
        <h2 style="margin:0 0 12px;font-size:24px;color:#0f172a">이번 요청은 진행하지 않기로 했습니다.</h2>
        <div style="display:grid;gap:10px;margin:16px 0;padding:18px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0">
          <p style="margin:0"><strong>Request lane</strong><br />${escapeHtml(requestType)}</p>
          <p style="margin:0"><strong>Visitor timezone</strong><br />${escapeHtml(visitorTimezone || 'Unknown')}</p>
          <p style="margin:0"><strong>Host timezone</strong><br />${escapeHtml(hostTimezone)}</p>
          <p style="margin:0"><strong>Duration policy</strong><br />${escapeHtml(durationPolicyLabel || 'Not specified')}</p>
        </div>
        <p style="margin:0;color:#475569">필요하면 다른 시간이나 맥락으로 다시 요청해 주세요.</p>
      </div>
    </div>
  `;

  return { text, html };
};
