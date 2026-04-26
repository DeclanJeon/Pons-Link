import { ApiClientError, createApiClient, type ApiClient } from './apiClient';
import { useAuthSessionStore } from './authSessionStore';
import type {
  RemoteAccountProfileDto,
  RemoteAuthMeDto,
  RemoteAuthBootstrapIdentityDto,
  RemoteAuthBootstrapProfileDto,
  RemoteCollectionDto,
  RemoteCreatePublicAliasRequestDto,
  RemoteCreatePublicAliasRequestInputDto,
  RemoteFriendRelationDto,
  RemoteLoungeRequestDto,
  RemoteLoungeReservationDto,
  RemotePublicAliasSummaryDto,
  RemotePublicProfileDto,
  RemoteRequestActionDirectCallDto,
  RemoteUserProfileDto,
} from './dto';
import type { PersonalLinkDataRepository } from './repository';
import { normalizeSlug } from './slug';
import { buildAcceptedEmailPayload } from './emailNotifications';
import { getJoinAccessState, getJoinWindowEnd, getJoinWindowStart } from './timeWindow';
import type {
  AccountProfile,
  Booking,
  ContactRequest,
  EmailDelivery,
  FriendRelation,
  PublicProfile,
  RequestActionDirectCallResult,
  RequestActionProposeTimePayload,
  RequestCreateInput,
  RequestDecisionPayload,
  SessionAccessResult,
  SessionReservation,
  UserProfile,
} from './types';

export interface RemotePersonalLinkRepository extends PersonalLinkDataRepository {
  kind: 'remote';
  apiUrl: string;
  client: ApiClient;
}

const repositoryCache = new Map<string, RemotePersonalLinkRepository>();

const normalizeApiUrl = (apiUrl: string) => apiUrl.trim().replace(/\/$/, '');

const createNotImplementedError = (methodName: string) =>
  new Error(`Remote personal-link repository method "${methodName}" is not implemented yet.`);

const createUnsupportedMethod = <TArgs extends unknown[], TResult>(methodName: string) =>
  async (..._args: TArgs): Promise<TResult> => {
    throw createNotImplementedError(methodName);
  };

const createTimestamp = () => new Date().toISOString();
const isBrowser = () => typeof window !== 'undefined';

const DEFAULT_RESPONSE_POLICY: PublicProfile['responsePolicy'] = 'approve_before_booking';
const DEFAULT_ROOM_TYPE: Booking['roomType'] = 'video-one-to-one';
const DEFAULT_PROFILE_VISIBILITY: PublicProfile['profileVisibility'] = 'public';
const DEFAULT_TIMEZONE = 'UTC';
const REMOTE_PROFILE_BOOTSTRAP_PATHS = [
  '/api/lounge/profile-bootstrap',
  '/api/lounge/profile',
  '/api/me',
  '/api/auth/me',
];

const isApiNotFound = (error: unknown): error is ApiClientError =>
  error instanceof ApiClientError && error.status === 404;

const getOptionalTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const toBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const hasRichIdentity = (identity?: RemoteAuthBootstrapIdentityDto | null): boolean =>
  Boolean(
    identity &&
    (
      getOptionalTrimmedString(identity.displayName) ||
      getOptionalTrimmedString(identity.email) ||
      getOptionalTrimmedString(identity.avatarUrl) ||
      getOptionalTrimmedString(identity.providerSubject) ||
      getOptionalTrimmedString(identity.uniqueNumber) ||
      getOptionalTrimmedString(identity.primaryAlias)
    ),
  );

const buildSessionAccessPath = (reservationId: string, accessToken?: string) => {
  const path = `/session-access/${encodeURIComponent(reservationId)}`;
  const normalizedAccessToken = accessToken?.trim();
  if (!normalizedAccessToken) {
    return path;
  }

  return `${path}?token=${encodeURIComponent(normalizedAccessToken)}`;
};

const isAbsoluteHttpUrl = (value?: string | null) => Boolean(value && /^https?:\/\//i.test(value));

const toAbsoluteFrontendUrl = (pathOrUrl: string, apiUrl: string): string => {
  if (isAbsoluteHttpUrl(pathOrUrl)) {
    return pathOrUrl;
  }

  const baseUrl = isBrowser() ? window.location.origin : apiUrl;

  try {
    return new URL(pathOrUrl, baseUrl).toString();
  } catch {
    const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    return `${baseUrl}${normalizedPath}`;
  }
};

const toAbsoluteApiUrl = (pathOrUrl: string, apiUrl: string): string => {
  if (isAbsoluteHttpUrl(pathOrUrl)) {
    return pathOrUrl;
  }

  try {
    return new URL(pathOrUrl, apiUrl).toString();
  } catch {
    const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    return `${apiUrl}${normalizedPath}`;
  }
};

const getRemoteEmailDeliveryStorageKey = (apiUrl: string) => `pons-link:remote-email-deliveries:${apiUrl}`;

const readRemoteEmailDeliveries = (apiUrl: string): EmailDelivery[] => {
  if (!isBrowser()) {
    return [];
  }

  const raw = window.sessionStorage.getItem(getRemoteEmailDeliveryStorageKey(apiUrl));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as EmailDelivery[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    window.sessionStorage.removeItem(getRemoteEmailDeliveryStorageKey(apiUrl));
    return [];
  }
};

const writeRemoteEmailDeliveries = (apiUrl: string, deliveries: EmailDelivery[]) => {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.setItem(
    getRemoteEmailDeliveryStorageKey(apiUrl),
    JSON.stringify(deliveries),
  );
};

const getPrimaryAlias = (payload?: RemoteAuthMeDto | RemoteAuthBootstrapProfileDto | null): string | undefined => {
  if (!payload) {
    return undefined;
  }

  if ('aliases' in payload) {
    const alias = getOptionalTrimmedString(payload.aliases?.primaryAlias?.alias);
    if (alias) {
      return alias;
    }
  }

  return (
    getOptionalTrimmedString(payload.user?.primaryAlias) ??
    getOptionalTrimmedString(payload.session?.primaryAlias)
  );
};

const buildBootstrapIdentity = (
  payload: RemoteAuthMeDto | RemoteAuthBootstrapProfileDto | null,
  email: string,
): RemoteAuthBootstrapIdentityDto | null => {
  if (!payload) {
    return null;
  }

  const identity: RemoteAuthBootstrapIdentityDto = {
    userId: payload.user?.userId ?? payload.session?.userId,
    email:
      payload.user?.contactEmail ??
      payload.user?.email ??
      payload.session?.contactEmail ??
      payload.session?.email ??
      email,
    displayName: payload.user?.displayName ?? payload.session?.displayName,
    avatarUrl: payload.user?.avatarUrl ?? payload.session?.avatarUrl,
    providerSubject: payload.user?.providerSubject ?? payload.session?.providerSubject,
    primaryAlias: getPrimaryAlias(payload),
    uniqueNumber:
      getOptionalTrimmedString(payload.user?.uniqueNumber) ??
      getOptionalTrimmedString(payload.session?.uniqueNumber),
    emailVerified:
      payload.user?.emailVerified ??
      payload.session?.emailVerified ??
      Boolean(payload.user?.contactEmail ?? payload.user?.email ?? payload.session?.contactEmail ?? payload.session?.email),
  };

  return hasRichIdentity(identity) || identity.userId ? identity : null;
};

const buildRemotePublicProfile = (
  payload: RemotePublicAliasSummaryDto,
  requestedSlug: string,
): (PublicProfile & { displayName: string; profileImageUrl?: string; hostEmail?: string }) => {
  const slug = payload.alias || requestedSlug;
  const isActive = payload.status === 'active';
  const now = createTimestamp();

  return {
    userId: `alias:${slug}`,
    slug,
    headline: '',
    bio: '',
    responsePolicy: isActive ? 'open' : 'paused',
    defaultRoomType: 'video-one-to-one',
    timezone: 'UTC',
    profileVisibility: 'public',
    allowGeneralRequest: isActive,
    allowScheduleRequest: isActive,
    allowMentoringRequest: isActive,
    allowCollabRequest: isActive,
    createdAt: now,
    updatedAt: now,
    displayName: slug,
  };
};

const mapRoomType = (roomType?: string): Booking['roomType'] => {
  if (roomType === 'audio' || roomType === 'audio-one-to-one') {
    return 'audio-one-to-one';
  }

  if (roomType === 'video' || roomType === 'video-one-to-one') {
    return 'video-one-to-one';
  }

  return DEFAULT_ROOM_TYPE;
};

const mapRemoteRequestStatus = (status: string): ContactRequest['status'] => {
  if (status === 'submitted') {
    return 'pending';
  }

  return status as ContactRequest['status'];
};

const mapRemoteRequestType = (requestType?: string): ContactRequest['requestType'] => {
  if (requestType === 'schedule' || requestType === 'mentoring' || requestType === 'collab') {
    return requestType;
  }

  return 'general';
};

const mapRemoteBookingStatus = (status?: string): Booking['status'] => {
  if (status === 'scheduled' || status === 'accepted' || status === 'confirmed') {
    return 'confirmed';
  }
  if (status === 'proposed') {
    return 'proposed';
  }
  if (status === 'cancelled' || status === 'canceled') {
    return 'cancelled';
  }
  if (status === 'completed') {
    return 'completed';
  }
  if (status === 'no_show') {
    return 'no_show';
  }
  if (status === 'reschedule_needed') {
    return 'reschedule_needed';
  }

  return 'confirmed';
};

const mapRemoteSessionReservationStatus = (status?: string): SessionReservation['status'] => {
  if (status === 'ready_to_join' || status === 'in_progress' || status === 'completed' || status === 'failed' || status === 'expired') {
    return status;
  }
  if (status === 'cancelled' || status === 'canceled') {
    return 'expired';
  }

  return 'scheduled';
};

const buildPublicProfileFromDto = (
  payload: RemotePublicProfileDto,
  fallbackAlias?: string,
): PublicProfile | null => {
  const slug = normalizeSlug(payload.slug ?? fallbackAlias ?? '');
  if (!slug) {
    return null;
  }

  const now = createTimestamp();

  return {
    userId: payload.userId ?? `alias:${slug}`,
    slug,
    headline: payload.headline ?? '',
    bio: payload.bio ?? '',
    responsePolicy: (payload.responsePolicy as PublicProfile['responsePolicy'] | undefined) ?? DEFAULT_RESPONSE_POLICY,
    defaultRoomType: mapRoomType(payload.defaultRoomType),
    timezone: payload.timezone ?? DEFAULT_TIMEZONE,
    profileVisibility: (payload.profileVisibility as PublicProfile['profileVisibility'] | undefined) ?? DEFAULT_PROFILE_VISIBILITY,
    allowGeneralRequest: toBoolean(payload.allowGeneralRequest, true),
    allowScheduleRequest: toBoolean(payload.allowScheduleRequest, true),
    allowMentoringRequest: toBoolean(payload.allowMentoringRequest, true),
    allowCollabRequest: toBoolean(payload.allowCollabRequest, true),
    availabilityWeekdays: payload.availabilityWeekdays,
    availabilityStartHour: payload.availabilityStartHour,
    availabilityEndHour: payload.availabilityEndHour,
    defaultSessionMinutes: payload.defaultSessionMinutes,
    createdAt: payload.createdAt ?? now,
    updatedAt: payload.updatedAt ?? payload.createdAt ?? now,
  };
};

const buildUserProfileFromDto = (
  payload: RemoteUserProfileDto,
  fallbackEmail: string,
  fallbackIdentity?: RemoteAuthBootstrapIdentityDto | null,
): UserProfile => {
  const now = createTimestamp();

  return {
    userId: payload.userId ?? fallbackIdentity?.userId ?? `remote:${fallbackEmail}`,
    providerSubject:
      payload.providerSubject ??
      fallbackIdentity?.providerSubject ??
      `remote:${fallbackEmail.toLowerCase()}`,
    primaryEmail:
      payload.primaryEmail ??
      fallbackIdentity?.email ??
      fallbackEmail,
    emailVerified:
      payload.emailVerified ??
      fallbackIdentity?.emailVerified ??
      true,
    displayName:
      payload.displayName ??
      fallbackIdentity?.displayName ??
      fallbackEmail,
    avatarUrl: payload.avatarUrl ?? fallbackIdentity?.avatarUrl,
    createdAt: payload.createdAt ?? now,
    updatedAt: payload.updatedAt ?? payload.createdAt ?? now,
  };
};

const buildAccountProfileFromDto = (
  payload: RemoteAccountProfileDto,
  fallbackIdentity?: RemoteAuthBootstrapIdentityDto | null,
  apiUrl?: string,
): AccountProfile => {
  const now = createTimestamp();
  const userId = payload.userId ?? fallbackIdentity?.userId ?? 'remote-user';
  const profileImageUrl = payload.profileImageUrl
    ? (apiUrl ? toAbsoluteApiUrl(payload.profileImageUrl, apiUrl) : payload.profileImageUrl)
    : fallbackIdentity?.avatarUrl;

  return {
    userId,
    displayName:
      payload.displayName ??
      fallbackIdentity?.displayName ??
      userId,
    statusMessage: payload.statusMessage ?? '',
    profileImageUrl,
    createdAt: payload.createdAt ?? now,
    updatedAt: payload.updatedAt ?? payload.createdAt ?? now,
  };
};

const buildBootstrapProfile = (
  payload: RemoteAuthMeDto | RemoteAuthBootstrapProfileDto | null,
  email: string,
  apiUrl?: string,
): {
  userProfile: UserProfile | null;
  accountProfile: AccountProfile | null;
  publicProfile: PublicProfile | null;
} => {
  const bootstrap = 'bootstrap' in (payload ?? {}) ? (payload?.bootstrap ?? payload) : payload;
  const identity = buildBootstrapIdentity(payload, email);
  const fallbackAlias = getPrimaryAlias(payload) ?? identity?.primaryAlias;

  const userProfile = bootstrap?.userProfile
    ? buildUserProfileFromDto(bootstrap.userProfile, email, identity)
    : hasRichIdentity(identity)
      ? buildUserProfileFromDto({}, email, identity)
      : null;

  const accountProfile = bootstrap?.accountProfile
    ? buildAccountProfileFromDto(bootstrap.accountProfile, identity, apiUrl)
    : hasRichIdentity(identity)
      ? buildAccountProfileFromDto({}, identity, apiUrl)
      : null;

  const publicProfile = bootstrap?.publicProfile
    ? buildPublicProfileFromDto(bootstrap.publicProfile, fallbackAlias)
    : buildPublicProfileFromDto({}, fallbackAlias);

  return {
    userProfile,
    accountProfile,
    publicProfile,
  };
};

const buildRemoteRequest = (payload: RemoteLoungeRequestDto): ContactRequest | null => {
  const id = payload.id ?? payload.requestId;
  if (!id) {
    return null;
  }

  const now = createTimestamp();
  const hostSlug = normalizeSlug(payload.hostSlug ?? payload.alias ?? '');

  return {
    id,
    hostUserId: payload.hostUserId ?? (hostSlug ? `alias:${hostSlug}` : 'remote-host'),
    hostSlug,
    visitorName: payload.visitorName ?? '',
    visitorEmail: payload.visitorEmail ?? '',
    visitorTimezone: payload.visitorTimezone,
    requestType: mapRemoteRequestType(payload.requestType),
    message: payload.message ?? '',
    preferredTimeNote: payload.preferredTimeNote ?? payload.preferredTime ?? '',
    status: mapRemoteRequestStatus(payload.status ?? 'submitted'),
    expiresAt: payload.expiresAt,
    createdAt: payload.createdAt ?? now,
    updatedAt: payload.updatedAt ?? payload.createdAt ?? now,
  };
};

const buildRemoteBooking = (payload: RemoteLoungeReservationDto): Booking | null => {
  const id = payload.id ?? payload.bookingId ?? payload.reservationId;
  if (!id) {
    return null;
  }

  const now = createTimestamp();

  return {
    id,
    requestId: payload.requestId ?? '',
    hostUserId: payload.hostUserId ?? 'remote-host',
    guestDisplayName: payload.guestDisplayName ?? '',
    guestEmail: payload.guestEmail ?? '',
    roomType: mapRoomType(payload.roomType),
    scheduledStartAt: payload.scheduledStartAt ?? now,
    scheduledEndAt: payload.scheduledEndAt ?? payload.scheduledStartAt ?? now,
    timezone: payload.timezone ?? DEFAULT_TIMEZONE,
    status: mapRemoteBookingStatus(payload.status),
    cancelActor: payload.cancelActor,
    cancelReason: payload.cancelReason,
    createdAt: payload.createdAt ?? now,
    updatedAt: payload.updatedAt ?? payload.createdAt ?? now,
  };
};

const getJoinPath = (payload: RemoteLoungeReservationDto): string | null => {
  if (payload.joinPath) {
    return payload.joinPath;
  }

  const joinUrl = getOptionalTrimmedString(payload.joinUrl);
  if (!joinUrl) {
    return null;
  }

  try {
    const parsed = new URL(joinUrl, 'https://pons.invalid');
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return joinUrl;
  }
};

const getJoinAccessToken = (payload: RemoteLoungeReservationDto): string => {
  const explicitToken = getOptionalTrimmedString(payload.accessToken);
  if (explicitToken) {
    return explicitToken;
  }

  const joinUrl = getOptionalTrimmedString(payload.joinUrl);
  if (!joinUrl) {
    return '';
  }

  try {
    const parsed = new URL(joinUrl, 'https://pons.invalid');
    return parsed.searchParams.get('token') ?? '';
  } catch {
    return '';
  }
};

const buildRemoteSessionReservation = (
  payload: RemoteLoungeReservationDto,
  bookingId: string,
): SessionReservation | null => {
  const joinPath = getJoinPath(payload);
  if (!joinPath) {
    return null;
  }

  const now = createTimestamp();

  return {
    id: payload.id ?? payload.reservationId ?? payload.bookingId ?? bookingId,
    bookingId,
    roomTitle: payload.roomTitle ?? `Session ${bookingId}`,
    roomType: mapRoomType(payload.roomType),
    hostUserId: payload.hostUserId ?? 'remote-host',
    guestDisplayName: payload.guestDisplayName ?? '',
    guestEmail: payload.guestEmail ?? '',
    joinPath,
    accessToken: getJoinAccessToken(payload),
    joinWindowStartsAt:
      payload.joinWindowStartsAt ??
      (payload.scheduledStartAt ? getJoinWindowStart(payload.scheduledStartAt) : undefined) ??
      payload.createdAt ??
      now,
    joinWindowEndsAt:
      payload.joinWindowEndsAt ??
      (payload.scheduledEndAt ? getJoinWindowEnd(payload.scheduledEndAt) : undefined) ??
      payload.updatedAt ??
      now,
    status: mapRemoteSessionReservationStatus(payload.status),
    createdAt: payload.createdAt ?? now,
    updatedAt: payload.updatedAt ?? payload.createdAt ?? now,
  };
};

const buildRemoteEmailDelivery = (
  apiUrl: string,
  booking: Booking,
  reservation: SessionReservation,
): EmailDelivery => {
  const createdAt = createTimestamp();
  const meetingPath = reservation.joinPath.startsWith('/session-access/')
    ? reservation.joinPath
    : buildSessionAccessPath(reservation.id);
  const joinUrl = toAbsoluteFrontendUrl(meetingPath, apiUrl);

  return {
    id: `remote-email:${booking.id}`,
    notificationEventId: `remote-event:${booking.id}:${createdAt}`,
    bookingId: booking.id,
    recipientEmail: booking.guestEmail,
    subject: `[PonsLink] Session Confirmed with ${booking.guestDisplayName}`,
    bodyPreview: `${booking.scheduledStartAt}에 세션 링크로 입장하세요.`,
    calendarSummary: `${booking.scheduledStartAt} ~ ${booking.scheduledEndAt}`,
    joinUrl,
    deliveryStatus: 'sent',
    createdAt,
    sentAt: createdAt,
  };
};

const buildRemoteAcceptedEmailRequest = (
  apiUrl: string,
  booking: Booking,
  reservation: SessionReservation,
) => {
  const session = useAuthSessionStore.getState().session;
  const hostEmail = session?.email?.trim();
  const hostDisplayName = session?.displayName?.trim();
  if (!hostEmail || !hostDisplayName) {
    throw new Error('이메일 발송에 필요한 호스트 세션 정보가 없습니다. 다시 로그인 후 시도해 주세요.');
  }

  const guestSafeMeetingUrl = toAbsoluteFrontendUrl(buildSessionAccessPath(reservation.id), apiUrl);

  return buildAcceptedEmailPayload({
    hostEmail,
    hostDisplayName,
    hostTimezone: booking.timezone,
    visitorName: booking.guestDisplayName,
    visitorEmail: booking.guestEmail,
    requestType: 'general',
    scheduledStart: booking.scheduledStartAt,
    scheduledEnd: booking.scheduledEndAt,
    timezone: booking.timezone,
    meetingUrl: guestSafeMeetingUrl,
    directCallUrl: guestSafeMeetingUrl,
    roomTitle: reservation.roomTitle,
  });
};

const extractCollection = <T,>(
  payload: RemoteCollectionDto<T> | T[] | null | undefined,
  keys: Array<keyof RemoteCollectionDto<T>>,
): T[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload) {
    return [];
  }

  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
};

const buildRemoteCreateRequestPayload = (
  input: RequestCreateInput,
): RemoteCreatePublicAliasRequestInputDto => ({
  visitorName: input.visitorName,
  visitorEmail: input.visitorEmail,
  visitorTimezone: input.visitorTimezone,
  deliveryMode: input.deliveryMode,
  requestType: input.requestType,
  message: input.message,
  preferredTime: input.preferredTimeNote || undefined,
});

const mapRemoteRequest = (
  payload: RemoteCreatePublicAliasRequestDto,
  input: RequestCreateInput,
): ContactRequest => {
  const now = createTimestamp();

  return {
    id: payload.requestId,
    hostUserId: `alias:${payload.alias}`,
    hostSlug: payload.alias,
    visitorName: payload.visitorName ?? input.visitorName,
    visitorEmail: payload.visitorEmail ?? input.visitorEmail,
    visitorTimezone: payload.visitorTimezone ?? input.visitorTimezone,
    requestType: payload.requestType ?? input.requestType,
    message: payload.message ?? input.message,
    preferredTimeNote: payload.preferredTime ?? input.preferredTimeNote,
    status: mapRemoteRequestStatus(payload.status),
    expiresAt: payload.expiresAt,
    createdAt: payload.createdAt ?? now,
    updatedAt: payload.updatedAt ?? now,
  };
};

const mapRemoteFriendStatus = (status?: string): FriendRelation['status'] => {
  if (status === 'pending' || status === 'accepted' || status === 'blocked' || status === 'removed') {
    return status;
  }

  return 'accepted';
};

const buildRemoteFriendRelation = (payload: RemoteFriendRelationDto): FriendRelation | null => {
  const id = getOptionalTrimmedString(payload.id);
  const friendSlug = normalizeSlug(payload.friendSlug ?? '');
  if (!id || !friendSlug) {
    return null;
  }

  const now = createTimestamp();

  return {
    id,
    ownerUserId: payload.ownerUserId ?? 'remote-owner',
    friendUserId: payload.friendUserId ?? `alias:${friendSlug}`,
    friendSlug,
    friendDisplayName: payload.friendDisplayName ?? friendSlug,
    friendProfileImageUrl: payload.friendProfileImageUrl,
    status: mapRemoteFriendStatus(payload.status),
    createdAt: payload.createdAt ?? now,
    updatedAt: payload.updatedAt ?? payload.createdAt ?? now,
  };
};

export const createRemoteRepository = (apiUrl: string): RemotePersonalLinkRepository => {
  const normalizedApiUrl = normalizeApiUrl(apiUrl);
  const cachedRepository = repositoryCache.get(normalizedApiUrl);
  if (cachedRepository) return cachedRepository;

  const client = createApiClient(normalizedApiUrl);

  const toRequestHeaders = (headers?: HeadersInit): Record<string, string> => {
    if (!headers) {
      return {};
    }
    if (Array.isArray(headers)) {
      return Object.fromEntries(headers);
    }
    if (headers instanceof Headers) {
      const record: Record<string, string> = {};
      headers.forEach((value, key) => {
        record[key] = value;
      });
      return record;
    }
    return { ...headers };
  };

  const getSessionHeaders = (headers?: HeadersInit): Record<string, string> => {
    const sessionToken = useAuthSessionStore.getState().session?.sessionToken?.trim();
    if (!sessionToken) {
      throw new Error('원격 personal link 작업에 필요한 세션 토큰이 없습니다. 다시 로그인 후 시도해 주세요.');
    }
    return {
      ...toRequestHeaders(headers),
      Authorization: `Bearer ${sessionToken}`,
    };
  };

  const requestWithSession = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`${normalizedApiUrl}${path}`, {
      ...init,
      headers: getSessionHeaders(init?.headers),
    });

    let body: unknown = undefined;
    if (response.status !== 204 && response.status !== 205) {
      const rawBody = await response.text();
      if (rawBody.trim()) {
        const contentType = response.headers.get('content-type') ?? '';
        body = contentType.includes('application/json') ? JSON.parse(rawBody) : rawBody;
      }
    }

    if (!response.ok) {
      throw new ApiClientError(response.status, body);
    }

    return body as T;
  };

  const publicPostJson = async <T>(path: string, body: unknown): Promise<T> => {
    const response = await fetch(`${normalizedApiUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    let responseBody: unknown = undefined;
    if (response.status !== 204 && response.status !== 205) {
      const rawBody = await response.text();
      if (rawBody.trim()) {
        const contentType = response.headers.get('content-type') ?? '';
        responseBody = contentType.includes('application/json') ? JSON.parse(rawBody) : rawBody;
      }
    }

    if (!response.ok) {
      throw new ApiClientError(response.status, responseBody);
    }

    return responseBody as T;
  };

  const buildRequestActionPath = (token: string, action: 'accept' | 'propose-time' | 'direct-call') =>
    `/api/request-actions/${encodeURIComponent(token)}/${action}`;

  const buildBookingFromActionResponse = (payload: RemoteLoungeReservationDto, errorMessage: string): Booking => {
    const booking = buildRemoteBooking(payload);
    if (!booking) {
      throw new Error(errorMessage);
    }
    return booking;
  };

  const buildDirectCallResult = (payload: RemoteRequestActionDirectCallDto): RequestActionDirectCallResult => {
    const requestId = getOptionalTrimmedString(payload.requestId);
    const callRequestId = getOptionalTrimmedString(payload.callRequestId);
    if (!requestId || !callRequestId) {
      throw new Error('원격 즉시 호출 응답을 해석할 수 없습니다.');
    }

    return {
      requestId,
      callRequestId,
      status: getOptionalTrimmedString(payload.status) ?? 'queued',
      loungeUrl: getOptionalTrimmedString(payload.loungeUrl),
    };
  };

  const postJsonWithFallback = async <T>(paths: string[], body: unknown): Promise<T> => {
    let lastNotFound: ApiClientError | null = null;

    for (const path of paths) {
      try {
        return await requestWithSession<T>(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch (error) {
        if (isApiNotFound(error)) {
          lastNotFound = error;
          continue;
        }

        throw error;
      }
    }

    if (lastNotFound) {
      throw lastNotFound;
    }

    throw new Error('No writable profile endpoint is available.');
  };

  const getWithFallback = async <T>(paths: string[]): Promise<T> => {
    let lastNotFound: ApiClientError | null = null;

    for (const path of paths) {
      try {
        return await client.get<T>(path);
      } catch (error) {
        if (isApiNotFound(error)) {
          lastNotFound = error;
          continue;
        }

        throw error;
      }
    }

    throw lastNotFound ?? createNotImplementedError(paths[0] ?? 'remote-get');
  };

  const getOptionalWithFallback = async <T>(paths: string[]): Promise<T | null> => {
    try {
      return await getWithFallback<T>(paths);
    } catch (error) {
      if (isApiNotFound(error)) {
        return null;
      }

      throw error;
    }
  };

  const buildRequestListPath = (filter?: string) => {
    if (!filter) {
      return '/api/lounge/requests';
    }

    const encoded = encodeURIComponent(filter);
    return `/api/lounge/requests?status=${encoded}&filter=${encoded}`;
  };

  const buildReservationListPaths = (filter?: string) => {
    if (!filter) {
      return ['/api/lounge/reservations', '/api/lounge/bookings'];
    }

    const encoded = encodeURIComponent(filter);
    return [
      `/api/lounge/reservations?status=${encoded}&filter=${encoded}`,
      `/api/lounge/bookings?status=${encoded}&filter=${encoded}`,
    ];
  };

  const buildReservationDetailPaths = (bookingId: string) => [
    `/api/lounge/reservations/${encodeURIComponent(bookingId)}`,
    `/api/lounge/bookings/${encodeURIComponent(bookingId)}`,
  ];

  const getStoredEmailDelivery = (bookingId: string) =>
    readRemoteEmailDeliveries(normalizedApiUrl).find((item) => item.bookingId === bookingId) ?? null;

  const upsertStoredEmailDelivery = (delivery: EmailDelivery) => {
    const existing = readRemoteEmailDeliveries(normalizedApiUrl).filter((item) => item.bookingId !== delivery.bookingId);
    writeRemoteEmailDeliveries(normalizedApiUrl, [delivery, ...existing]);
  };

  const repository: RemotePersonalLinkRepository = {
    kind: 'remote',
    apiUrl: normalizedApiUrl,
    client,
    async getAuthBootstrapProfile(email) {
      const payload = await getWithFallback<RemoteAuthMeDto>(REMOTE_PROFILE_BOOTSTRAP_PATHS);
      return buildBootstrapProfile(payload, email, normalizedApiUrl);
    },
    async saveUserProfile(profile) {
      const payload = await postJsonWithFallback<{ userProfile?: RemoteUserProfileDto }>(
        ['/api/lounge/profile/user', '/api/lounge/profile'],
        { userProfile: profile },
      );

      return payload.userProfile
        ? buildUserProfileFromDto(payload.userProfile, profile.primaryEmail)
        : profile;
    },
    async saveAccountProfile(profile) {
      const payload = await postJsonWithFallback<{ accountProfile?: RemoteAccountProfileDto }>(
        ['/api/lounge/profile/account', '/api/lounge/profile'],
        { accountProfile: profile },
      );

      return payload.accountProfile
        ? buildAccountProfileFromDto(payload.accountProfile)
        : profile;
    },
    async savePublicProfile(profile) {
      const normalizedProfile = { ...profile, slug: normalizeSlug(profile.slug) };
      const payload = await postJsonWithFallback<{ publicProfile?: RemotePublicProfileDto }>(
        ['/api/lounge/profile/public', '/api/lounge/profile'],
        { publicProfile: normalizedProfile },
      );

      return payload.publicProfile
        ? buildPublicProfileFromDto(payload.publicProfile, normalizedProfile.slug) ?? normalizedProfile
        : normalizedProfile;
    },
    async saveAccountProfileImage(file) {
      const formData = new FormData();
      formData.set('file', file);

      const payload = await requestWithSession<{ imageUrl?: string; profileImageUrl?: string }>('/api/lounge/profile/image', {
        method: 'POST',
        body: formData,
      });

      const imageUrl = getOptionalTrimmedString(payload.imageUrl) ?? getOptionalTrimmedString(payload.profileImageUrl);
      if (!imageUrl) {
        throw new Error('프로필 이미지 업로드 응답을 해석할 수 없습니다.');
      }

      return toAbsoluteApiUrl(imageUrl, normalizedApiUrl);
    },
    async removeAccountProfileImage() {
      await requestWithSession('/api/lounge/profile/image', { method: 'DELETE' });
    },
    async listFriends() {
      const payload = await requestWithSession<RemoteCollectionDto<RemoteFriendRelationDto>>('/api/lounge/friends');
      return extractCollection(payload, ['items', 'data'])
        .map(buildRemoteFriendRelation)
        .filter((item): item is FriendRelation => item !== null);
    },
    async addFriendBySlug(slug) {
      const payload = await requestWithSession<RemoteFriendRelationDto>('/api/lounge/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: normalizeSlug(slug) }),
      });

      const relation = buildRemoteFriendRelation(payload);
      if (!relation) {
        throw new Error('친구 관계 응답을 해석할 수 없습니다.');
      }
      return relation;
    },
    async blockFriend(id) {
      await requestWithSession(`/api/lounge/friends/${encodeURIComponent(id)}/block`, { method: 'POST' });
    },
    blockVisitorIdentity: createUnsupportedMethod<[string, string?], FriendRelation>('blockVisitorIdentity'),
    async removeFriend(id) {
      await requestWithSession(`/api/lounge/friends/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    async getPublicProfileBySlug(slug) {
      const normalizedSlug = normalizeSlug(slug);

      try {
        const payload = await client.get<RemotePublicAliasSummaryDto>(
          `/api/public-aliases/${encodeURIComponent(normalizedSlug)}`,
        );

        return buildRemotePublicProfile(payload, normalizedSlug);
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 404) {
          return null;
        }

        throw error;
      }
    },
    async createRequest(input: RequestCreateInput) {
      const normalizedHostSlug = normalizeSlug(input.hostSlug);
      const payload = await client.post<RemoteCreatePublicAliasRequestDto>(
        `/api/public-aliases/${encodeURIComponent(normalizedHostSlug)}/requests`,
        buildRemoteCreateRequestPayload(input),
      );

      return mapRemoteRequest(payload, input);
    },
    async listRequests(filter) {
      const payload = await client.get<RemoteCollectionDto<RemoteLoungeRequestDto> | RemoteLoungeRequestDto[]>(
        buildRequestListPath(filter),
      );

      const items = extractCollection(payload, ['requests', 'items', 'data'])
        .map((item) => buildRemoteRequest(item))
        .filter((item): item is ContactRequest => item !== null);

      return filter ? items.filter((item) => item.status === filter) : items;
    },
    async getRequest(id) {
      const payload = await getOptionalWithFallback<RemoteLoungeRequestDto>([
        `/api/lounge/requests/${encodeURIComponent(id)}`,
      ]);

      return payload ? buildRemoteRequest(payload) : null;
    },
    deleteRequest: createUnsupportedMethod<[string], void>('deleteRequest'),
    async acceptRequest(id, payload) {
      const response = await client.post<RemoteLoungeReservationDto>(
        `/api/lounge/requests/${encodeURIComponent(id)}/accept`,
        payload,
      );
      const booking = buildRemoteBooking(response);
      if (!booking) {
        throw new Error('원격 요청 수락 응답에서 예약 정보를 읽을 수 없습니다.');
      }
      return booking;
    },
    async counterProposeRequest(id, payload) {
      const response = await client.post<RemoteLoungeReservationDto>(
        `/api/lounge/requests/${encodeURIComponent(id)}/propose-time`,
        payload,
      );
      const booking = buildRemoteBooking(response);
      if (!booking) {
        throw new Error('원격 대체 시간 제안 응답에서 예약 정보를 읽을 수 없습니다.');
      }
      return booking;
    },
    async acceptRequestByActionToken(token, payload) {
      const response = await publicPostJson<RemoteLoungeReservationDto>(
        buildRequestActionPath(token, 'accept'),
        payload,
      );
      return buildBookingFromActionResponse(response, '공개 요청 수락 응답에서 예약 정보를 읽을 수 없습니다.');
    },
    async proposeTimeByActionToken(token, payload: RequestActionProposeTimePayload) {
      const response = await publicPostJson<RemoteLoungeReservationDto>(
        buildRequestActionPath(token, 'propose-time'),
        payload,
      );
      return buildBookingFromActionResponse(response, '공개 대체 시간 제안 응답에서 예약 정보를 읽을 수 없습니다.');
    },
    async requestDirectCallByActionToken(token, message) {
      const response = await publicPostJson<RemoteRequestActionDirectCallDto>(
        buildRequestActionPath(token, 'direct-call'),
        message ? { message } : {},
      );
      return buildDirectCallResult(response);
    },
    async declineRequest(id, reason) {
      const response = await client.post<RemoteLoungeRequestDto>(
        `/api/lounge/requests/${encodeURIComponent(id)}/decline`,
        reason ? { reason } : undefined,
      );
      const request = buildRemoteRequest(response);
      if (!request) {
        throw new Error('원격 요청 거절 응답에서 요청 정보를 읽을 수 없습니다.');
      }
      return request;
    },
    expireRequests: createUnsupportedMethod<[string?], ContactRequest[]>('expireRequests'),
    async listBookings(filter) {
      const payload = await getWithFallback<RemoteCollectionDto<RemoteLoungeReservationDto> | RemoteLoungeReservationDto[]>(
        buildReservationListPaths(filter),
      );

      const items = extractCollection(payload, ['reservations', 'bookings', 'items', 'data'])
        .map((item) => buildRemoteBooking(item))
        .filter((item): item is Booking => item !== null);

      return filter ? items.filter((item) => item.status === filter) : items;
    },
    async getBooking(id) {
      const payload = await getOptionalWithFallback<RemoteLoungeReservationDto>(buildReservationDetailPaths(id));
      return payload ? buildRemoteBooking(payload) : null;
    },
    cancelBooking: createUnsupportedMethod<[string, 'host' | 'visitor', string?], Booking | null>('cancelBooking'),
    markNoShow: createUnsupportedMethod<[string, 'host' | 'visitor'], Booking | null>('markNoShow'),
    markRescheduleNeeded: createUnsupportedMethod<[string, 'host' | 'visitor'], Booking | null>('markRescheduleNeeded'),
    async createSessionReservation(bookingId) {
      const reservation = await repository.getSessionReservation(bookingId);
      if (!reservation) {
        throw new Error('세션 예약 정보를 찾을 수 없습니다.');
      }

      return reservation;
    },
    async getSessionReservation(bookingId) {
      const payload = await getOptionalWithFallback<RemoteLoungeReservationDto>(buildReservationDetailPaths(bookingId));
      return payload ? buildRemoteSessionReservation(payload, bookingId) : null;
    },
    async getSessionAccess(reservationId, accessToken) {
      const normalizedAccessToken = getOptionalTrimmedString(accessToken);
      if (!normalizedAccessToken) {
        return { state: 'not_found', reason: 'missing_access_token' } satisfies SessionAccessResult;
      }

      try {
        const payload = await client.get<RemoteLoungeReservationDto>(
          buildSessionAccessPath(reservationId, normalizedAccessToken).replace(/^\/session-access/, '/api/session-access'),
        );
        const reservation = buildRemoteSessionReservation(payload, reservationId);

        if (!reservation) {
          return { state: 'not_found' } satisfies SessionAccessResult;
        }

        return {
          state: getJoinAccessState(createTimestamp(), reservation.joinWindowStartsAt, reservation.joinWindowEndsAt),
          reservation,
        } satisfies SessionAccessResult;
      } catch (error) {
        if (error instanceof ApiClientError && [400, 401, 404].includes(error.status)) {
          return { state: 'not_found', reason: 'invalid_access_token' } satisfies SessionAccessResult;
        }

        throw error;
      }
    },
    async listEmailDeliveries(bookingIds) {
      const deliveries = readRemoteEmailDeliveries(normalizedApiUrl);
      if (!bookingIds?.length) {
        return deliveries;
      }

      return deliveries.filter((delivery) => bookingIds.includes(delivery.bookingId));
    },
    async getEmailDelivery(bookingId) {
      return getStoredEmailDelivery(bookingId);
    },
    async createEmailDelivery(bookingId) {
      const existing = getStoredEmailDelivery(bookingId);
      if (existing) {
        return existing;
      }

      const [booking, reservation] = await Promise.all([
        repository.getBooking(bookingId),
        repository.createSessionReservation(bookingId),
      ]);

      if (!booking) {
        throw new Error('예약을 찾을 수 없습니다.');
      }

      const delivery = buildRemoteEmailDelivery(normalizedApiUrl, booking, reservation);

      await client.post<{ ok: true }>('/api/email/accepted', buildRemoteAcceptedEmailRequest(normalizedApiUrl, booking, reservation));

      upsertStoredEmailDelivery(delivery);
      return delivery;
    },
    async resendEmailDelivery(bookingId) {
      const deliveries = readRemoteEmailDeliveries(normalizedApiUrl).filter((item) => item.bookingId !== bookingId);
      writeRemoteEmailDeliveries(normalizedApiUrl, deliveries);
      return repository.createEmailDelivery(bookingId);
    },
  };

  repositoryCache.set(normalizedApiUrl, repository);
  return repository;
};
