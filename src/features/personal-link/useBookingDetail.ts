import { useQuery } from '@tanstack/react-query';
import { getConfiguredPersonalLinkApiUrl } from './backendSurface';
import { type PersonalLinkRepositorySelectionInput, usePersonalLinkRepository } from './usePersonalLinkRepository';

type RepositorySelectionArg = PersonalLinkRepositorySelectionInput | string | null | undefined;

const resolveSelection = (selection?: RepositorySelectionArg): PersonalLinkRepositorySelectionInput | undefined => {
  if (selection === undefined) {
    const apiUrl = getConfiguredPersonalLinkApiUrl();
    return apiUrl === undefined ? undefined : { apiUrl };
  }

  if (typeof selection === 'string' || selection === null) return { apiUrl: selection };
  return selection;
};

export const useBookingDetail = (bookingId: string, selection?: RepositorySelectionArg) => {
  const repositorySelection = resolveSelection(selection);
  const repository = usePersonalLinkRepository(repositorySelection);

  const detail = useQuery({
    queryKey: ['personal-link', 'booking', repositorySelection?.apiUrl ?? 'local', bookingId],
    queryFn: () => repository.getBooking(bookingId),
    enabled: Boolean(bookingId),
  });

  const reservation = useQuery({
    queryKey: ['personal-link', 'session-reservation', repositorySelection?.apiUrl ?? 'local', bookingId],
    queryFn: () => repository.getSessionReservation(bookingId),
    enabled: Boolean(bookingId),
  });

  return { detail, reservation };
};
