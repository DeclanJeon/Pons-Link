import type { RoomType } from '@/types/room.types';

export type RequestType = 'general' | 'schedule' | 'mentoring' | 'collab';
export type RequestStatus = 'pending' | 'accepted' | 'counter_proposed' | 'confirmed' | 'declined' | 'blocked' | 'expired';
export type BookingStatus = 'proposed' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'reschedule_needed';
export type FriendRelationStatus = 'pending' | 'accepted' | 'blocked' | 'removed';
export type SessionReservationStatus = 'scheduled' | 'ready_to_join' | 'in_progress' | 'completed' | 'failed' | 'expired';
export type DeliveryStatus = 'queued' | 'sent' | 'failed' | 'read' | 'opened';
export type ProfileVisibility = 'public' | 'unlisted' | 'private';
export type ResponsePolicy = 'open' | 'approve_before_booking' | 'paused';

export interface UserProfile {
  userId: string;
  providerSubject: string;
  primaryEmail: string;
  emailVerified: boolean;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountProfile {
  userId: string;
  displayName: string;
  statusMessage: string;
  profileImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicProfile {
  userId: string;
  slug: string;
  headline: string;
  bio: string;
  responsePolicy: ResponsePolicy;
  defaultRoomType: Extract<RoomType, 'audio-one-to-one' | 'video-one-to-one'>;
  timezone: string;
  profileVisibility: ProfileVisibility;
  allowGeneralRequest: boolean;
  allowScheduleRequest: boolean;
  allowMentoringRequest: boolean;
  allowCollabRequest: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FriendRelation {
  id: string;
  ownerUserId: string;
  friendUserId: string;
  friendSlug: string;
  friendDisplayName: string;
  friendProfileImageUrl?: string;
  status: FriendRelationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ContactRequest {
  id: string;
  hostUserId: string;
  hostSlug: string;
  visitorName: string;
  visitorEmail: string;
  visitorTimezone?: string;
  requestType: RequestType;
  message: string;
  preferredTimeNote: string;
  status: RequestStatus;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  requestId: string;
  hostUserId: string;
  guestDisplayName: string;
  guestEmail: string;
  roomType: Extract<RoomType, 'audio-one-to-one' | 'video-one-to-one'>;
  scheduledStartAt: string;
  scheduledEndAt: string;
  timezone: string;
  status: BookingStatus;
  cancelActor?: 'host' | 'visitor';
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionReservation {
  id: string;
  bookingId: string;
  roomTitle: string;
  roomType: Extract<RoomType, 'audio-one-to-one' | 'video-one-to-one'>;
  hostUserId: string;
  guestDisplayName: string;
  guestEmail: string;
  joinPath: string;
  accessToken: string;
  joinWindowStartsAt: string;
  joinWindowEndsAt: string;
  status: SessionReservationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationEvent {
  id: string;
  userId: string;
  requestId?: string;
  bookingId?: string;
  sessionReservationId?: string;
  eventType: string;
  deliveryChannel: 'email' | 'web';
  deliveryStatus: DeliveryStatus;
  payloadJson: Record<string, unknown>;
  createdAt: string;
  sentAt?: string;
}

export interface EmailDelivery {
  id: string;
  notificationEventId: string;
  bookingId: string;
  recipientEmail: string;
  subject: string;
  bodyPreview: string;
  calendarSummary: string;
  joinUrl: string;
  deliveryStatus: DeliveryStatus;
  createdAt: string;
  sentAt?: string;
}

export interface AuthSession {
  userId: string;
  providerSubject: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  loggedInAt: string;
}

export interface RequestCreateInput {
  hostSlug: string;
  visitorName: string;
  visitorEmail: string;
  visitorTimezone?: string;
  requestType: RequestType;
  message: string;
  preferredTimeNote: string;
}

export interface RequestDecisionPayload {
  proposedStartAt: string;
  proposedEndAt: string;
  roomType: Extract<RoomType, 'audio-one-to-one' | 'video-one-to-one'>;
  timezone: string;
}

export interface SessionAccessResult {
  state: 'allowed' | 'waiting' | 'expired' | 'email_mismatch' | 'unauthenticated' | 'not_found';
  reservation?: SessionReservation;
  reason?: string;
}
