import type {
  BookingStatus,
  DeliveryStatus,
  RequestStatus,
  RequestType,
} from './types';
import type { RoomType } from '@/types/room.types';

const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  general: 'General request',
  schedule: 'Schedule request',
  mentoring: 'Mentoring',
  collab: 'Collaboration',
};

const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  counter_proposed: 'New time proposed',
  confirmed: 'Confirmed',
  declined: 'Declined',
  blocked: 'Blocked',
  expired: 'Expired',
};

const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  proposed: 'Proposed',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  completed: 'Completed',
  no_show: 'No-show',
  reschedule_needed: 'Reschedule needed',
};

const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  queued: 'Queued',
  sent: 'Sent',
  failed: 'Failed',
  read: 'Read',
  opened: 'Opened',
};

const ROOM_TYPE_LABELS: Partial<Record<RoomType, string>> = {
  'audio-one-to-one': '1:1 audio',
  'video-one-to-one': '1:1 video',
  'audio-group': 'Group audio',
  'video-group': 'Group video',
};

export const getRequestTypeLabel = (type: RequestType) => REQUEST_TYPE_LABELS[type] ?? type;
export const getRequestStatusLabel = (status: RequestStatus) => REQUEST_STATUS_LABELS[status] ?? status;
export const getBookingStatusLabel = (status: BookingStatus) => BOOKING_STATUS_LABELS[status] ?? status;
export const getDeliveryStatusLabel = (status: DeliveryStatus) => DELIVERY_STATUS_LABELS[status] ?? status;
export const getRoomTypeLabel = (roomType: RoomType) => ROOM_TYPE_LABELS[roomType] ?? roomType;
