import type { RequestDeliveryMode, RequestType } from './types';

export interface RemotePublicAliasSummaryDto {
  alias: string;
  status: string;
}

export interface RemoteCreatePublicAliasRequestInputDto {
  visitorName: string;
  visitorEmail: string;
  visitorTimezone?: string;
  deliveryMode: RequestDeliveryMode;
  requestType: RequestType;
  message: string;
  preferredTime?: string;
}

export interface RemoteCreatePublicAliasRequestDto {
  alias: string;
  conversationId: string;
  requestId: string;
  visitorName?: string;
  visitorEmail?: string;
  visitorTimezone?: string;
  requestType?: RequestType;
  message?: string;
  preferredTime?: string;
  status: string;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RemoteAuthBootstrapIdentityDto {
  userId?: string;
  email?: string;
  contactEmail?: string;
  displayName?: string;
  avatarUrl?: string;
  providerSubject?: string;
  primaryAlias?: string;
  uniqueNumber?: string;
  emailVerified?: boolean;
}

export interface RemoteAuthAliasDto {
  aliasId?: string;
  ownerUserId?: string;
  alias?: string;
  rawAlias?: string;
  status?: string;
  isPrimary?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RemoteAuthAliasesDto {
  items?: RemoteAuthAliasDto[];
  primaryAlias?: RemoteAuthAliasDto | null;
}

export interface RemoteUserProfileDto {
  userId?: string;
  providerSubject?: string;
  primaryEmail?: string;
  emailVerified?: boolean;
  displayName?: string;
  avatarUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RemoteAccountProfileDto {
  userId?: string;
  displayName?: string;
  statusMessage?: string;
  profileImageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RemotePublicProfileDto {
  userId?: string;
  slug?: string;
  headline?: string;
  bio?: string;
  responsePolicy?: string;
  defaultRoomType?: string;
  timezone?: string;
  profileVisibility?: string;
  allowGeneralRequest?: boolean;
  allowScheduleRequest?: boolean;
  allowMentoringRequest?: boolean;
  allowCollabRequest?: boolean;
  availabilityWeekdays?: number[];
  availabilityStartHour?: number;
  availabilityEndHour?: number;
  defaultSessionMinutes?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RemoteAuthBootstrapProfileDto {
  userProfile?: RemoteUserProfileDto | null;
  accountProfile?: RemoteAccountProfileDto | null;
  publicProfile?: RemotePublicProfileDto | null;
  user?: RemoteAuthBootstrapIdentityDto | null;
  session?: RemoteAuthBootstrapIdentityDto | null;
}

export interface RemoteAuthMeDto extends RemoteAuthBootstrapProfileDto {
  ok?: boolean;
  aliases?: RemoteAuthAliasesDto | null;
  bootstrap?: RemoteAuthBootstrapProfileDto | null;
}

export interface RemoteLoungeRequestDto {
  id?: string;
  requestId?: string;
  hostUserId?: string;
  hostSlug?: string;
  alias?: string;
  visitorName?: string;
  visitorEmail?: string;
  visitorTimezone?: string;
  requestType?: RequestType | string;
  message?: string;
  preferredTimeNote?: string;
  preferredTime?: string;
  status?: string;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RemoteLoungeReservationDto {
  id?: string;
  bookingId?: string;
  reservationId?: string;
  requestId?: string;
  hostUserId?: string;
  guestDisplayName?: string;
  guestEmail?: string;
  roomType?: string;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  timezone?: string;
  status?: string;
  cancelActor?: 'host' | 'visitor';
  cancelReason?: string;
  joinUrl?: string;
  joinPath?: string;
  accessToken?: string;
  roomTitle?: string;
  joinWindowStartsAt?: string;
  joinWindowEndsAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RemoteRequestActionDirectCallDto {
  requestId?: string;
  callRequestId?: string;
  status?: string;
  loungeUrl?: string;
}

export interface RemoteFriendRelationDto {
  id?: string;
  ownerUserId?: string;
  friendUserId?: string;
  friendSlug?: string;
  friendDisplayName?: string;
  friendProfileImageUrl?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RemoteCollectionDto<T> {
  items?: T[];
  data?: T[];
  requests?: T[];
  bookings?: T[];
  reservations?: T[];
}
