import { useMutation, useQueryClient } from '@tanstack/react-query';
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

export const useSessionReservation = (selection?: RepositorySelectionArg) => {
  const repositorySelection = resolveSelection(selection);
  const repository = usePersonalLinkRepository(repositorySelection);
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'bookings'] });
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'booking'] });
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'requests'] });
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'session-reservation'] });
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'email-deliveries'] });
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'email-delivery'] });
  };

  const createReservation = useMutation({ mutationFn: (bookingId: string) => repository.createSessionReservation(bookingId), onSuccess: invalidate });
  const createEmailDelivery = useMutation({ mutationFn: (bookingId: string) => repository.createEmailDelivery(bookingId), onSuccess: invalidate });
  const resendEmailDelivery = useMutation({ mutationFn: (bookingId: string) => repository.resendEmailDelivery(bookingId), onSuccess: invalidate });

  return { createReservation, createEmailDelivery, resendEmailDelivery };
};
