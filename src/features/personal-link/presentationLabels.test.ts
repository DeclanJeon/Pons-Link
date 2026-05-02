import { describe, expect, it } from 'vitest';
import {
  getBookingStatusLabel,
  getRequestStatusLabel,
  getRequestTypeLabel,
  getRoomTypeLabel,
} from './presentationLabels';

describe('presentationLabels', () => {
  it('maps request types to korean labels', () => {
    expect(getRequestTypeLabel('general')).toBe('General request');
    expect(getRequestTypeLabel('schedule')).toBe('Schedule request');
    expect(getRequestTypeLabel('mentoring')).toBe('Mentoring');
    expect(getRequestTypeLabel('collab')).toBe('Collaboration');
  });

  it('maps request statuses to korean labels', () => {
    expect(getRequestStatusLabel('pending')).toBe('Pending');
    expect(getRequestStatusLabel('accepted')).toBe('Accepted');
    expect(getRequestStatusLabel('counter_proposed')).toBe('New time proposed');
    expect(getRequestStatusLabel('confirmed')).toBe('Confirmed');
    expect(getRequestStatusLabel('declined')).toBe('Declined');
    expect(getRequestStatusLabel('blocked')).toBe('Blocked');
    expect(getRequestStatusLabel('expired')).toBe('Expired');
  });

  it('maps booking statuses and room types to korean labels', () => {
    expect(getBookingStatusLabel('confirmed')).toBe('Confirmed');
    expect(getBookingStatusLabel('proposed')).toBe('Proposed');
    expect(getBookingStatusLabel('cancelled')).toBe('Cancelled');
    expect(getBookingStatusLabel('completed')).toBe('Completed');
    expect(getBookingStatusLabel('no_show')).toBe('No-show');
    expect(getBookingStatusLabel('reschedule_needed')).toBe('Reschedule needed');

    expect(getRoomTypeLabel('audio-one-to-one')).toBe('1:1 audio');
    expect(getRoomTypeLabel('video-one-to-one')).toBe('1:1 video');
  });
});
