import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getConfiguredPersonalLinkApiUrl } from './backendSurface';
import { useBookings } from './useBookings';
import type { PersonalLinkRepositorySelectionInput } from './usePersonalLinkRepository';
import { useRequests } from './useRequests';

export interface LoungeConversationItem {
  id: string;
  kind: 'request' | 'reservation';
  title: string;
  counterpart: string;
  summary: string;
  statusLabel: string;
  meta: string;
  href: string;
  happenedAt: string;
}

const toTimestamp = (value?: string) => {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

type RepositorySelectionArg = PersonalLinkRepositorySelectionInput | string | null | undefined;

const resolveSelection = (selection?: RepositorySelectionArg): PersonalLinkRepositorySelectionInput | undefined => {
  if (selection === undefined) {
    const apiUrl = getConfiguredPersonalLinkApiUrl();
    return apiUrl === undefined ? undefined : { apiUrl };
  }

  if (typeof selection === 'string') return { apiUrl: selection };
  if (selection === null) return { apiUrl: null };
  return selection;
};

export const useConversations = (selection?: RepositorySelectionArg) => {
  const { t, i18n } = useTranslation();
  const repositorySelection = resolveSelection(selection);
  const requests = useRequests(undefined, repositorySelection);
  const bookings = useBookings(undefined, repositorySelection);

  const items = useMemo<LoungeConversationItem[]>(() => {
    const requestItems = (requests.data ?? []).map((request) => ({
      id: `request:${request.id}`,
      kind: 'request' as const,
      title: request.visitorName,
      counterpart: request.visitorEmail,
      summary: request.message,
      statusLabel: t(`lounge.labels.requestStatus.${request.status}`),
      meta: t(`lounge.labels.requestType.${request.requestType}`),
      href: `/lounge/requests/${request.id}`,
      happenedAt: request.updatedAt || request.createdAt,
    }));

    const bookingItems = (bookings.list.data ?? []).map((booking) => ({
      id: `reservation:${booking.id}`,
      kind: 'reservation' as const,
      title: booking.guestDisplayName,
      counterpart: booking.guestEmail,
      summary: booking.scheduledStartAt
        ? t('lounge.conversationsPage.scheduled', { date: new Date(booking.scheduledStartAt).toLocaleString(i18n.language, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }) })
        : t('lounge.conversationsPage.reservationInProgress'),
      statusLabel: t(`lounge.labels.bookingStatus.${booking.status}`),
      meta: t(`lounge.labels.roomType.${booking.roomType}`),
      href: `/lounge/bookings/${booking.id}`,
      happenedAt: booking.updatedAt || booking.createdAt,
    }));

    return [...requestItems, ...bookingItems].sort(
      (left, right) => toTimestamp(right.happenedAt) - toTimestamp(left.happenedAt),
    );
  }, [bookings.list.data, i18n.language, requests.data, t]);

  return {
    requests,
    bookings,
    items,
    counts: {
      requests: requests.data?.length ?? 0,
      reservations: bookings.list.data?.length ?? 0,
      total: items.length,
    },
  };
};
