import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type PersonalLinkRepositorySelectionInput, usePersonalLinkRepository } from './usePersonalLinkRepository';

type RepositorySelectionArg = PersonalLinkRepositorySelectionInput | string | null | undefined;

const resolveSelection = (selection?: RepositorySelectionArg): PersonalLinkRepositorySelectionInput | undefined => {
  if (selection === undefined) return undefined;
  if (typeof selection === 'string' || selection === null) return { apiUrl: selection };
  return selection;
};

export const useBookings = (filter?: string, selection?: RepositorySelectionArg) => {
  const repositorySelection = resolveSelection(selection);
  const repository = usePersonalLinkRepository(repositorySelection);
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'bookings'] });
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'booking'] });
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'session-reservation'] });
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'email-deliveries'] });
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'email-delivery'] });
  };

  const list = useQuery({
    queryKey: ['personal-link', 'bookings', repositorySelection?.apiUrl ?? 'local', filter ?? 'all'],
    queryFn: () => repository.listBookings(filter),
  });

  const cancelBooking = useMutation({
    mutationFn: ({ id, actor, reason }: { id: string; actor: 'host' | 'visitor'; reason?: string }) => repository.cancelBooking(id, actor, reason),
    onSuccess: invalidate,
  });

  const markNoShow = useMutation({
    mutationFn: ({ id, actor }: { id: string; actor: 'host' | 'visitor' }) => repository.markNoShow(id, actor),
    onSuccess: invalidate,
  });

  const markRescheduleNeeded = useMutation({
    mutationFn: ({ id, actor }: { id: string; actor: 'host' | 'visitor' }) => repository.markRescheduleNeeded(id, actor),
    onSuccess: invalidate,
  });

  return { list, cancelBooking, markNoShow, markRescheduleNeeded };
};
