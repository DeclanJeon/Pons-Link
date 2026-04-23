import { describe, expect, it } from 'vitest';
import {
  getBookingStatusLabel,
  getRequestStatusLabel,
  getRequestTypeLabel,
  getRoomTypeLabel,
} from './presentationLabels';

describe('presentationLabels', () => {
  it('maps request types to korean labels', () => {
    expect(getRequestTypeLabel('general')).toBe('일반 문의');
    expect(getRequestTypeLabel('schedule')).toBe('일정 요청');
    expect(getRequestTypeLabel('mentoring')).toBe('멘토링');
    expect(getRequestTypeLabel('collab')).toBe('협업');
  });

  it('maps request statuses to korean labels', () => {
    expect(getRequestStatusLabel('pending')).toBe('대기 중');
    expect(getRequestStatusLabel('accepted')).toBe('수락됨');
    expect(getRequestStatusLabel('counter_proposed')).toBe('대체 시간 제안됨');
    expect(getRequestStatusLabel('confirmed')).toBe('확정됨');
    expect(getRequestStatusLabel('declined')).toBe('거절됨');
    expect(getRequestStatusLabel('blocked')).toBe('차단됨');
    expect(getRequestStatusLabel('expired')).toBe('만료됨');
  });

  it('maps booking statuses and room types to korean labels', () => {
    expect(getBookingStatusLabel('confirmed')).toBe('확정됨');
    expect(getBookingStatusLabel('proposed')).toBe('제안됨');
    expect(getBookingStatusLabel('cancelled')).toBe('취소됨');
    expect(getBookingStatusLabel('completed')).toBe('완료됨');
    expect(getBookingStatusLabel('no_show')).toBe('노쇼');
    expect(getBookingStatusLabel('reschedule_needed')).toBe('재조율 필요');

    expect(getRoomTypeLabel('audio-one-to-one')).toBe('1:1 오디오');
    expect(getRoomTypeLabel('video-one-to-one')).toBe('1:1 화상');
  });
});
