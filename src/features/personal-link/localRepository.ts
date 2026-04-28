import { nanoid } from 'nanoid';
import { getJoinAccessState, getJoinWindowEnd, getJoinWindowStart } from './timeWindow';
import { normalizeSlug, validateSlug } from './slug';
import {
  PERSONAL_LINK_ACCOUNT_PROFILE_KEY,
  PERSONAL_LINK_BOOKINGS_KEY,
  PERSONAL_LINK_EMAIL_DELIVERIES_KEY,
  PERSONAL_LINK_FRIENDS_KEY,
  PERSONAL_LINK_PUBLIC_PROFILE_KEY,
  PERSONAL_LINK_REQUESTS_KEY,
  PERSONAL_LINK_SESSIONS_KEY,
  PERSONAL_LINK_USER_PROFILE_KEY,
} from './storageKeys';
import type { PersonalLinkRepository } from './repository';
import type {
  AccountProfile,
  Booking,
  BookingStatus,
  ContactRequest,
  EmailDelivery,
  FriendRelation,
  FriendRelationStatus,
  PublicProfile,
  RequestActionDeclineResult,
  RequestActionDirectCallResult,
  RequestActionProposeTimePayload,
  RequestCreateInput,
  RequestDecisionPayload,
  RequestStatus,
  SessionAccessResult,
  SessionReservation,
  UserProfile,
} from './types';

const nowIso = () => new Date().toISOString();
const isBrowser = () => typeof window !== 'undefined';

type ProfileBundle = {
  userProfile: UserProfile | null;
  accountProfile: AccountProfile | null;
  publicProfile: PublicProfile | null;
};

const readJson = <T,>(key: string, fallback: T): T => {
  if (!isBrowser()) return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
};

const writeJson = <T,>(key: string, value: T) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const findPublicProfile = (): PublicProfile | null => readJson(PERSONAL_LINK_PUBLIC_PROFILE_KEY, null as PublicProfile | null);
const findAccountProfile = (): AccountProfile | null => readJson(PERSONAL_LINK_ACCOUNT_PROFILE_KEY, null as AccountProfile | null);
const findUserProfile = (): UserProfile | null => readJson(PERSONAL_LINK_USER_PROFILE_KEY, null as UserProfile | null);
const listRequests = (): ContactRequest[] => readJson(PERSONAL_LINK_REQUESTS_KEY, [] as ContactRequest[]);
const listBookings = (): Booking[] => readJson(PERSONAL_LINK_BOOKINGS_KEY, [] as Booking[]);
const listSessions = (): SessionReservation[] => readJson(PERSONAL_LINK_SESSIONS_KEY, [] as SessionReservation[]);
const listFriends = (): FriendRelation[] => readJson(PERSONAL_LINK_FRIENDS_KEY, [] as FriendRelation[]);
const listEmailDeliveries = (): EmailDelivery[] => readJson(PERSONAL_LINK_EMAIL_DELIVERIES_KEY, [] as EmailDelivery[]);

const saveRequests = (value: ContactRequest[]) => writeJson(PERSONAL_LINK_REQUESTS_KEY, value);
const saveBookings = (value: Booking[]) => writeJson(PERSONAL_LINK_BOOKINGS_KEY, value);
const saveSessions = (value: SessionReservation[]) => writeJson(PERSONAL_LINK_SESSIONS_KEY, value);
const saveFriends = (value: FriendRelation[]) => writeJson(PERSONAL_LINK_FRIENDS_KEY, value);
const saveEmailDeliveries = (value: EmailDelivery[]) => writeJson(PERSONAL_LINK_EMAIL_DELIVERIES_KEY, value);

const buildRoomTitle = (booking: Booking) => {
  const stamp = booking.scheduledStartAt.replace(/\D/g, '').slice(0, 12);
  return `${normalizeSlug(booking.guestDisplayName || 'guest')}-${stamp}`;
};

const normalizeVisitorIdentity = (email: string) => email.trim().toLowerCase();
const toVisitorFriendUserId = (email: string) => `visitor:${normalizeVisitorIdentity(email)}`;
const isBlockedVisitor = (email: string) => listFriends().some((friend) => friend.friendUserId === toVisitorFriendUserId(email) && friend.status === 'blocked');
const buildSessionAccessPath = (bookingId: string, accessToken?: string) => {
  const path = `/session-access/${encodeURIComponent(bookingId)}`;
  const normalizedAccessToken = accessToken?.trim();
  if (!normalizedAccessToken) {
    return path;
  }

  return `${path}?token=${encodeURIComponent(normalizedAccessToken)}`;
};

const buildMeetingAccess = (hostSlug: string): ContactRequest['meetingAccess'] => {
  const normalizedHostSlug = normalizeSlug(hostSlug);
  const publicCId = Date.now() + Math.floor(Math.random() * 1000);
  const accessCode = nanoid(6);

  return {
    cId: publicCId,
    code: accessCode,
    url: `/room/${encodeURIComponent(normalizedHostSlug)}?c_id=${publicCId}#${accessCode}`,
  };
};

const expireRequestsInternal = (items: ContactRequest[], currentIso: string): ContactRequest[] => {
  const current = new Date(currentIso).getTime();
  return items.map((item) => {
    if (item.status === 'pending' && item.expiresAt && current > new Date(item.expiresAt).getTime()) {
      return { ...item, status: 'expired' as RequestStatus, updatedAt: currentIso };
    }
    if (item.status === 'counter_proposed' && item.expiresAt && current > new Date(item.expiresAt).getTime()) {
      return { ...item, status: 'expired' as RequestStatus, updatedAt: currentIso };
    }
    return item;
  });
};

export const localRepository: PersonalLinkRepository = {
  async getAuthBootstrapProfile(email) {
    const userProfile = findUserProfile();
    const accountProfile = findAccountProfile();
    const publicProfile = findPublicProfile();

    if (userProfile && userProfile.primaryEmail === email) {
      return { userProfile, accountProfile, publicProfile };
    }

    return { userProfile: null, accountProfile: null, publicProfile: null } satisfies ProfileBundle;
  },

  async saveUserProfile(profile) {
    writeJson(PERSONAL_LINK_USER_PROFILE_KEY, profile);
    return profile;
  },

  async saveAccountProfile(profile) {
    writeJson(PERSONAL_LINK_ACCOUNT_PROFILE_KEY, profile);
    return profile;
  },

  async savePublicProfile(profile) {
    const error = validateSlug(profile.slug);
    if (error) throw new Error(error);
    writeJson(PERSONAL_LINK_PUBLIC_PROFILE_KEY, { ...profile, slug: normalizeSlug(profile.slug) });
    return { ...profile, slug: normalizeSlug(profile.slug) };
  },

  async saveAccountProfileImage(file) {
    const reader = new FileReader();
    const result = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Image upload failed.'));
      reader.readAsDataURL(file);
    });
    return result;
  },

  async removeAccountProfileImage() {
    const account = findAccountProfile();
    if (!account) return;
    writeJson(PERSONAL_LINK_ACCOUNT_PROFILE_KEY, { ...account, profileImageUrl: undefined, updatedAt: nowIso() });
  },

  async listFriends() {
    return listFriends();
  },

  async addFriendBySlug(slug) {
    const normalized = normalizeSlug(slug);
    const publicProfile = findPublicProfile();
    if (publicProfile?.slug === normalized) throw new Error('You cannot add yourself as a friend.');
    const next: FriendRelation = {
      id: nanoid(),
      ownerUserId: publicProfile?.userId ?? 'host',
      friendUserId: `friend:${normalized}`,
      friendSlug: normalized,
      friendDisplayName: normalized,
      status: 'accepted',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const items = listFriends().filter((item) => item.friendSlug !== normalized);
    items.unshift(next);
    saveFriends(items);
    return next;
  },

  async blockFriend(id) {
    const items: FriendRelation[] = listFriends().map((item) => item.id === id ? { ...item, status: 'blocked' as FriendRelationStatus, updatedAt: nowIso() } : item);
    saveFriends(items);
  },

  async blockVisitorIdentity(email, displayName) {
    const identity = normalizeVisitorIdentity(email);
    const items = listFriends().filter((item) => item.friendUserId !== toVisitorFriendUserId(identity));
    const next: FriendRelation = {
      id: nanoid(),
      ownerUserId: findPublicProfile()?.userId ?? 'host',
      friendUserId: toVisitorFriendUserId(identity),
      friendSlug: identity,
      friendDisplayName: displayName || identity,
      status: 'blocked',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    saveFriends([next, ...items]);
    return next;
  },

  async removeFriend(id) {
    const items: FriendRelation[] = listFriends().map((item) => item.id === id ? { ...item, status: 'removed' as FriendRelationStatus, updatedAt: nowIso() } : item);
    saveFriends(items);
  },

  async getPublicProfileBySlug(slug) {
    const publicProfile = findPublicProfile();
    const accountProfile = findAccountProfile();
    const userProfile = findUserProfile();
    if (!publicProfile || publicProfile.slug !== normalizeSlug(slug)) return null;
    return {
      ...publicProfile,
      displayName: accountProfile?.displayName ?? publicProfile.slug,
      profileImageUrl: accountProfile?.profileImageUrl,
      hostEmail: userProfile?.primaryEmail,
    };
  },

  async createRequest(input) {
    if (isBlockedVisitor(input.visitorEmail)) {
      throw new Error('This visitor is blocked.');
    }
    const request: ContactRequest = {
      id: nanoid(),
      hostUserId: findPublicProfile()?.userId ?? 'host',
      hostSlug: normalizeSlug(input.hostSlug),
      visitorName: input.visitorName,
      visitorEmail: input.visitorEmail,
      visitorTimezone: input.visitorTimezone,
      requestType: input.requestType,
      message: input.message,
      preferredTimeNote: input.preferredTimeNote,
      status: 'pending',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      meetingAccess: buildMeetingAccess(input.hostSlug),
    };
    const items = [request, ...listRequests()];
    saveRequests(items);
    return request;
  },

  async listRequests(filter) {
    const expired = expireRequestsInternal(listRequests(), nowIso());
    saveRequests(expired);
    return filter ? expired.filter((item) => item.status === filter) : expired;
  },

  async getRequest(id) {
    const items = expireRequestsInternal(listRequests(), nowIso());
    saveRequests(items);
    return items.find((item) => item.id === id) ?? null;
  },

  async deleteRequest(id) {
    const items = listRequests().filter((item) => item.id !== id);
    saveRequests(items);
  },

  async acceptRequest(id, payload) {
    const requests: ContactRequest[] = listRequests().map((item) => item.id === id ? { ...item, status: 'accepted' as RequestStatus, updatedAt: nowIso() } : item);
    saveRequests(requests);
    const request = requests.find((item) => item.id === id);
    if (!request) throw new Error('Request not found.');
    const booking: Booking = {
      id: nanoid(),
      requestId: request.id,
      hostUserId: request.hostUserId,
      guestDisplayName: request.visitorName,
      guestEmail: request.visitorEmail,
      roomType: payload.roomType,
      scheduledStartAt: payload.proposedStartAt,
      scheduledEndAt: payload.proposedEndAt,
      timezone: payload.timezone,
      status: 'confirmed',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    saveBookings([booking, ...listBookings()]);
    await this.createEmailDelivery(booking.id);
    return booking;
  },

  async counterProposeRequest(id, payload) {
    const requests: ContactRequest[] = listRequests().map((item) => item.id === id ? { ...item, status: 'counter_proposed' as RequestStatus, expiresAt: new Date(Date.now() + 72 * 60 * 60_000).toISOString(), updatedAt: nowIso() } : item);
    saveRequests(requests);
    const request = requests.find((item) => item.id === id);
    if (!request) throw new Error('Request not found.');
    const booking: Booking = {
      id: nanoid(),
      requestId: request.id,
      hostUserId: request.hostUserId,
      guestDisplayName: request.visitorName,
      guestEmail: request.visitorEmail,
      roomType: payload.roomType,
      scheduledStartAt: payload.proposedStartAt,
      scheduledEndAt: payload.proposedEndAt,
      timezone: payload.timezone,
      status: 'proposed',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    saveBookings([booking, ...listBookings()]);
    await this.createEmailDelivery(booking.id);
    return booking;
  },

  async declineRequest(id) {
    const items: ContactRequest[] = listRequests().map((item) => item.id === id ? { ...item, status: 'declined' as RequestStatus, updatedAt: nowIso() } : item);
    saveRequests(items);
    return items.find((item) => item.id === id) ?? null;
  },

  async acceptRequestByActionToken(actionToken) {
    const request = listRequests().find((item) => item.id === actionToken || item.id === actionToken.replace(/^local-action:/, ''));
    if (!request) throw new Error('Action token is invalid or expired.');
    const start = new Date(Date.now() + 60 * 60_000);
    const end = new Date(start.getTime() + 30 * 60_000);
    return this.acceptRequest(request.id, {
      proposedStartAt: start.toISOString(),
      proposedEndAt: end.toISOString(),
      roomType: findPublicProfile()?.defaultRoomType ?? 'video-one-to-one',
      timezone: request.visitorTimezone ?? findPublicProfile()?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  },

  async proposeTimeByActionToken(actionToken, payload: RequestActionProposeTimePayload) {
    const request = listRequests().find((item) => item.id === actionToken || item.id === actionToken.replace(/^local-action:/, ''));
    if (!request) throw new Error('Action token is invalid or expired.');
    return this.counterProposeRequest(request.id, payload);
  },

  async requestDirectCallByActionToken(actionToken): Promise<RequestActionDirectCallResult> {
    const request = listRequests().find((item) => item.id === actionToken || item.id === actionToken.replace(/^local-action:/, ''));
    if (!request) throw new Error('Action token is invalid or expired.');
    return {
      requestId: request.id,
      callRequestId: nanoid(),
      status: 'queued',
      loungeUrl: `/lounge/requests/${encodeURIComponent(request.id)}`,
    };
  },

  async declineRequestByActionToken(actionToken): Promise<RequestActionDeclineResult> {
    const request = listRequests().find((item) => item.id === actionToken || item.id === actionToken.replace(/^local-action:/, ''));
    if (!request) throw new Error('Action token is invalid or expired.');
    await this.declineRequest(request.id);
    return {
      requestId: request.id,
      status: 'declined',
    };
  },

  async expireRequests(now = nowIso()) {
    const items = expireRequestsInternal(listRequests(), now);
    saveRequests(items);
    return items;
  },

  async listBookings(filter) {
    const items = listBookings();
    return filter ? items.filter((item) => item.status === filter) : items;
  },

  async getBooking(id) {
    return listBookings().find((item) => item.id === id) ?? null;
  },

  async cancelBooking(id, actor, reason) {
    const items: Booking[] = listBookings().map((item) => item.id === id ? { ...item, status: 'cancelled' as BookingStatus, cancelActor: actor, cancelReason: reason, updatedAt: nowIso() } : item);
    saveBookings(items);
    return items.find((item) => item.id === id) ?? null;
  },

  async markNoShow(id, actor) {
    const items: Booking[] = listBookings().map((item) =>
      item.id === id
        ? {
            ...item,
            status: 'no_show' as BookingStatus,
            cancelActor: actor,
            updatedAt: nowIso(),
          }
        : item,
    );
    saveBookings(items);
    return items.find((item) => item.id === id) ?? null;
  },

  async markRescheduleNeeded(id, actor) {
    const items: Booking[] = listBookings().map((item) => item.id === id ? { ...item, status: 'reschedule_needed' as BookingStatus, cancelActor: actor, cancelReason: 'reschedule_needed', updatedAt: nowIso() } : item);
    saveBookings(items);
    return items.find((item) => item.id === id) ?? null;
  },

  async createSessionReservation(bookingId) {
    const existing = listSessions().find((item) => item.bookingId === bookingId);
    if (existing) return existing;
    const booking = listBookings().find((item) => item.id === bookingId);
    if (!booking) throw new Error('Booking not found.');
    const roomTitle = buildRoomTitle(booking);
    const reservation: SessionReservation = {
      id: nanoid(),
      bookingId,
      roomTitle,
      roomType: booking.roomType,
      hostUserId: booking.hostUserId,
      guestDisplayName: booking.guestDisplayName,
      guestEmail: booking.guestEmail,
      joinPath: `/lobby/${encodeURIComponent(roomTitle)}?type=${booking.roomType}`,
      accessToken: nanoid(),
      joinWindowStartsAt: getJoinWindowStart(booking.scheduledStartAt),
      joinWindowEndsAt: getJoinWindowEnd(booking.scheduledEndAt),
      status: 'scheduled',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    saveSessions([reservation, ...listSessions()]);
    return reservation;
  },

  async getSessionReservation(bookingId) {
    return listSessions().find((item) => item.bookingId === bookingId) ?? null;
  },

  async getSessionAccess(bookingId, accessToken) {
    const booking = listBookings().find((item) => item.id === bookingId);
    if (!booking) return { state: 'not_found' } satisfies SessionAccessResult;
    const reservation = listSessions().find((item) => item.bookingId === bookingId);
    if (!reservation) return { state: 'not_found' } satisfies SessionAccessResult;

    const normalizedAccessToken = accessToken?.trim();
    if (normalizedAccessToken) {
      if (normalizedAccessToken !== reservation.accessToken) {
        return { state: 'not_found', reason: 'invalid_access_token' } satisfies SessionAccessResult;
      }

      const state = getJoinAccessState(nowIso(), reservation.joinWindowStartsAt, reservation.joinWindowEndsAt);
      return { state, reservation } satisfies SessionAccessResult;
    }

    const currentUserEmail = findUserProfile()?.primaryEmail;
    if (!currentUserEmail) return { state: 'unauthenticated', reservation } satisfies SessionAccessResult;
    if (currentUserEmail !== booking.guestEmail) {
      return { state: 'email_mismatch', reservation, reason: 'booking_email_mismatch' } satisfies SessionAccessResult;
    }

    const state = getJoinAccessState(nowIso(), reservation.joinWindowStartsAt, reservation.joinWindowEndsAt);
    return { state, reservation } satisfies SessionAccessResult;
  },

  async listLoungeEvents() {
    return [];
  },

  async listEmailDeliveries(bookingIds) {
    const deliveries = listEmailDeliveries();
    if (!bookingIds || bookingIds.length === 0) return deliveries;
    return deliveries.filter((delivery) => bookingIds.includes(delivery.bookingId));
  },

  async getEmailDelivery(bookingId) {
    return listEmailDeliveries().find((item) => item.bookingId === bookingId) ?? null;
  },

  async createEmailDelivery(bookingId) {
    const existing = listEmailDeliveries().find((item) => item.bookingId === bookingId);
    if (existing) return existing;
    const booking = listBookings().find((item) => item.id === bookingId);
    if (!booking) throw new Error('Booking not found.');
    await this.createSessionReservation(bookingId);
    const delivery: EmailDelivery = {
      id: nanoid(),
      notificationEventId: nanoid(),
      bookingId,
      recipientEmail: booking.guestEmail,
      subject: `Your meeting with ${booking.guestDisplayName} is confirmed`,
      bodyPreview: `Join with the Direct Call Link at ${booking.scheduledStartAt}.`,
      calendarSummary: `${booking.scheduledStartAt} ~ ${booking.scheduledEndAt}`,
      joinUrl: buildSessionAccessPath(bookingId, listSessions().find((item) => item.bookingId === bookingId)?.accessToken),
      deliveryStatus: 'sent',
      createdAt: nowIso(),
      sentAt: nowIso(),
    };
    saveEmailDeliveries([delivery, ...listEmailDeliveries()]);
    return delivery;
  },

  async resendEmailDelivery(bookingId) {
    const sessions = listSessions().map((session) => session.bookingId === bookingId ? { ...session, accessToken: nanoid(), updatedAt: nowIso() } : session);
    saveSessions(sessions);
    const deliveries = listEmailDeliveries().filter((delivery) => delivery.bookingId !== bookingId);
    saveEmailDeliveries(deliveries);
    return this.createEmailDelivery(bookingId);
  },
};
