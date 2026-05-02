import { describe, expect, it, vi } from 'vitest';
import {
  buildMeetingMinutesChatMessage,
  buildMeetingMinutesMarkdown,
  createMeetingMinutesCaptionId,
  downloadMeetingMinutesMarkdown,
  getMeetingMinutesDedupeKey,
} from './meetingMinutes';
import type { ChatMessage, MeetingMinutesCaptionPayload } from '@/types/chat.types';

const payload: MeetingMinutesCaptionPayload = {
  captionId: 'room-1:local-user:1777683600000:abc',
  speakerId: 'local-user',
  speakerNickname: 'Local User',
  text: '다시 한번 말해볼래?',
  lang: 'ko-KR',
  provider: 'azure',
  capturedAt: 1777683600000,
  meetingStartedAt: 1777683500000,
  version: 1,
};

describe('meeting minutes helpers', () => {
  it('builds stable caption IDs from room, speaker, time, and normalized text', () => {
    expect(createMeetingMinutesCaptionId({
      roomId: 'room-1',
      speakerId: 'local-user',
      capturedAt: 1777683600000,
      text: '다시   한번 말해볼래?',
    })).toBe(createMeetingMinutesCaptionId({
      roomId: 'room-1',
      speakerId: 'local-user',
      capturedAt: 1777683600000,
      text: '다시 한번 말해볼래?',
    }));
  });

  it('converts finalized captions into immutable chat records', () => {
    expect(buildMeetingMinutesChatMessage(payload)).toMatchObject({
      id: `minutes-${payload.captionId}`,
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
  });

  it('dedupes records by caption ID before falling back to time-bucket text hashes', () => {
    const message = buildMeetingMinutesChatMessage(payload);
    expect(getMeetingMinutesDedupeKey(message)).toBe(payload.captionId);

    const fallback: ChatMessage = {
      ...message,
      id: 'fallback',
      meetingMinutes: undefined,
      timestamp: 1777683601000,
    };
    const sameBucket: ChatMessage = {
      ...fallback,
      id: 'fallback-2',
      text: '다시   한번 말해볼래?',
    };

    expect(getMeetingMinutesDedupeKey(fallback)).toBe(getMeetingMinutesDedupeKey(sameBucket));
  });

  it('exports meeting records as chronological markdown', () => {
    const older = buildMeetingMinutesChatMessage({ ...payload, captionId: 'older', capturedAt: 1777683500000, text: '먼저 말한 내용' });
    const newer = buildMeetingMinutesChatMessage(payload);

    const markdown = buildMeetingMinutesMarkdown({
      roomLabel: 'Pons room',
      exportedAt: new Date('2026-05-02T01:05:00.000Z'),
      records: [newer, older],
    });

    expect(markdown).toContain('# Pons Meeting Records');
    expect(markdown.indexOf('먼저 말한 내용')).toBeLessThan(markdown.indexOf('다시 한번 말해볼래?'));
    expect(markdown).toContain('- Records: 2');
  });

  it('downloads markdown through a temporary object URL', () => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:minutes'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    const createObjectURL = vi.mocked(URL.createObjectURL);
    const revokeObjectURL = vi.mocked(URL.revokeObjectURL);
    const click = vi.fn();
    const appendChild = vi.spyOn(document.body, 'appendChild');
    const removeChild = vi.spyOn(document.body, 'removeChild');
    const originalCreateElement = document.createElement.bind(document);

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'a') {
        Object.defineProperty(element, 'click', { value: click });
      }
      return element;
    });

    downloadMeetingMinutesMarkdown([buildMeetingMinutesChatMessage(payload)], '회의실 A');

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(appendChild).toHaveBeenCalledOnce();
    expect(removeChild).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:minutes');
  });
});
