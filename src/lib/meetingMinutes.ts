import { nanoid } from 'nanoid';
import type { ChatMessage, MeetingMinutesCaptionPayload } from '@/types/chat.types';

export const MEETING_MINUTES_SYSTEM_LABEL = 'Meeting Minutes';

const normalizeForHash = (text: string) => text.trim().replace(/\s+/g, ' ');

export const hashMeetingMinutesText = (text: string): string => {
  let hash = 5381;
  const normalized = normalizeForHash(text);
  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) + hash) ^ normalized.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

export const createMeetingMinutesCaptionId = ({
  roomId,
  speakerId,
  text,
  capturedAt,
}: {
  roomId: string;
  speakerId: string;
  text: string;
  capturedAt: number;
}) => `${roomId}:${speakerId}:${capturedAt}:${hashMeetingMinutesText(text)}`;

export const buildMeetingMinutesChatMessage = (payload: MeetingMinutesCaptionPayload): ChatMessage => ({
  id: `minutes-${payload.captionId || nanoid()}`,
  type: 'text',
  text: payload.text,
  senderId: payload.speakerId,
  senderNickname: payload.speakerNickname,
  timestamp: payload.capturedAt,
  status: 'sent',
  source: 'meeting-minutes',
  meetingMinutes: {
    captionId: payload.captionId,
    speakerId: payload.speakerId,
    speakerNickname: payload.speakerNickname,
    sourceLang: payload.lang,
    provider: payload.provider,
    capturedAt: payload.capturedAt,
  },
});

export const getMeetingMinutesDedupeKey = (message: ChatMessage) => {
  if (message.meetingMinutes?.captionId) {
    return message.meetingMinutes.captionId;
  }

  const bucket = Math.floor(message.timestamp / 2000);
  return `${message.senderId}:${bucket}:${hashMeetingMinutesText(message.text || '')}`;
};

const sanitizeFilenamePart = (value: string) => value
  .trim()
  .replace(/[^a-z0-9가-힣-_]+/gi, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 80);

const formatExportTime = (timestamp: number) => new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
}).format(new Date(timestamp));

export const buildMeetingMinutesMarkdown = ({
  roomLabel,
  exportedAt,
  records,
}: {
  roomLabel: string;
  exportedAt: Date;
  records: ChatMessage[];
}) => {
  const sortedRecords = [...records].sort((a, b) => a.timestamp - b.timestamp);
  const lines = [
    '# Pons Meeting Records',
    '',
    `- Room: ${roomLabel || 'Unknown room'}`,
    `- Exported: ${exportedAt.toISOString()}`,
    `- Records: ${sortedRecords.length}`,
    '',
    '## Timeline',
    '',
  ];

  if (sortedRecords.length === 0) {
    lines.push('_No meeting records were captured._');
    return lines.join('\n');
  }

  sortedRecords.forEach((record) => {
    lines.push(`### ${formatExportTime(record.timestamp)} - ${record.senderNickname}`);
    lines.push(record.text || '');
    lines.push('');
  });

  return lines.join('\n');
};

export const downloadMeetingMinutesMarkdown = (records: ChatMessage[], roomLabel: string) => {
  const exportedAt = new Date();
  const markdown = buildMeetingMinutesMarkdown({ roomLabel, exportedAt, records });
  const datePart = exportedAt.toISOString().slice(0, 16).replaceAll('-', '').replaceAll(':', '').replaceAll('T', '');
  const roomPart = sanitizeFilenamePart(roomLabel) || 'room';
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `pons-meeting-records-${roomPart}-${datePart}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};
