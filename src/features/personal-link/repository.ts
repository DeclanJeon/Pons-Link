import type {
  AccountProfile,
  Booking,
  ContactRequest,
  EmailDelivery,
  PublicProfile,
  FriendRelation,
  LoungeEvent,
  RequestCreateInput,
  RequestActionDeclineResult,
  RequestActionDirectCallResult,
  RequestActionProposeTimePayload,
  RequestDecisionPayload,
  SessionAccessResult,
  SessionReservation,
  UserProfile,
} from './types';

export type PersonalLinkRepositoryKind = 'local' | 'remote';

export interface PersonalLinkRepository {
  getAuthBootstrapProfile(email: string): Promise<{
    userProfile: UserProfile | null;
    accountProfile: AccountProfile | null;
    publicProfile: PublicProfile | null;
  }>;
  saveUserProfile(profile: UserProfile): Promise<UserProfile>;
  saveAccountProfile(profile: AccountProfile): Promise<AccountProfile>;
  savePublicProfile(profile: PublicProfile): Promise<PublicProfile>;
  saveAccountProfileImage(file: File): Promise<string>;
  removeAccountProfileImage(): Promise<void>;
  listFriends(): Promise<FriendRelation[]>;
  addFriendBySlug(slug: string): Promise<FriendRelation>;
  blockFriend(id: string): Promise<void>;
  blockVisitorIdentity(email: string, displayName?: string): Promise<FriendRelation>;
  removeFriend(id: string): Promise<void>;
  getPublicProfileBySlug(slug: string): Promise<(PublicProfile & { displayName: string; profileImageUrl?: string; hostEmail?: string }) | null>;
  createRequest(input: RequestCreateInput): Promise<ContactRequest>;
  listRequests(filter?: string): Promise<ContactRequest[]>;
  getRequest(id: string): Promise<ContactRequest | null>;
  deleteRequest(id: string): Promise<void>;
  acceptRequest(id: string, payload: RequestDecisionPayload): Promise<Booking>;
  counterProposeRequest(id: string, payload: RequestDecisionPayload): Promise<Booking>;
  acceptRequestByActionToken(token: string, payload: RequestDecisionPayload): Promise<Booking>;
  proposeTimeByActionToken(token: string, payload: RequestActionProposeTimePayload): Promise<Booking>;
  requestDirectCallByActionToken(token: string, message?: string): Promise<RequestActionDirectCallResult>;
  declineRequestByActionToken(token: string): Promise<RequestActionDeclineResult>;
  declineRequest(id: string, reason?: string): Promise<ContactRequest | null>;
  expireRequests(now?: string): Promise<ContactRequest[]>;
  listBookings(filter?: string): Promise<Booking[]>;
  getBooking(id: string): Promise<Booking | null>;
  cancelBooking(id: string, actor: 'host' | 'visitor', reason?: string): Promise<Booking | null>;
  markNoShow(id: string, actor: 'host' | 'visitor'): Promise<Booking | null>;
  markRescheduleNeeded(id: string, actor: 'host' | 'visitor'): Promise<Booking | null>;
  createSessionReservation(bookingId: string): Promise<SessionReservation>;
  getSessionReservation(bookingId: string): Promise<SessionReservation | null>;
  getSessionAccess(reservationId: string, accessToken?: string): Promise<SessionAccessResult>;
  listLoungeEvents(): Promise<LoungeEvent[]>;
  listEmailDeliveries(bookingIds?: string[]): Promise<EmailDelivery[]>;
  getEmailDelivery(bookingId: string): Promise<EmailDelivery | null>;
  createEmailDelivery(bookingId: string): Promise<EmailDelivery>;
  resendEmailDelivery(bookingId: string): Promise<EmailDelivery>;
}

export type PersonalLinkDataRepository = PersonalLinkRepository & {
  kind: PersonalLinkRepositoryKind;
};
