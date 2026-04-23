import type {
  BookingStatus,
  DeliveryStatus,
  RequestStatus,
  RequestType,
} from './types';
import type { RoomType } from '@/types/room.types';

const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  general: '일반 문의',
  schedule: '일정 요청',
  mentoring: '멘토링',
  collab: '협업',
};

const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: '대기 중',
  accepted: '수락됨',
  counter_proposed: '대체 시간 제안됨',
  confirmed: '확정됨',
  declined: '거절됨',
  blocked: '차단됨',
  expired: '만료됨',
};

const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  proposed: '제안됨',
  confirmed: '확정됨',
  cancelled: '취소됨',
  completed: '완료됨',
  no_show: '노쇼',
  reschedule_needed: '재조율 필요',
};

const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  queued: '발송 대기',
  sent: '전달 완료',
  failed: '전달 실패',
  read: '읽음',
  opened: '열람됨',
};

const ROOM_TYPE_LABELS: Partial<Record<RoomType, string>> = {
  'audio-one-to-one': '1:1 오디오',
  'video-one-to-one': '1:1 화상',
  'audio-group': '그룹 오디오',
  'video-group': '그룹 화상',
};

export const getRequestTypeLabel = (type: RequestType) => REQUEST_TYPE_LABELS[type] ?? type;
export const getRequestStatusLabel = (status: RequestStatus) => REQUEST_STATUS_LABELS[status] ?? status;
export const getBookingStatusLabel = (status: BookingStatus) => BOOKING_STATUS_LABELS[status] ?? status;
export const getDeliveryStatusLabel = (status: DeliveryStatus) => DELIVERY_STATUS_LABELS[status] ?? status;
export const getRoomTypeLabel = (roomType: RoomType) => ROOM_TYPE_LABELS[roomType] ?? roomType;
