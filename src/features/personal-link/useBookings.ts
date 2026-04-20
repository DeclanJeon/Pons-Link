import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePersonalLinkRepository } from './usePersonalLinkRepository';

export const useBookings = (filter?: string) => {
  const repository = usePersonalLinkRepository();
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'bookings'] });
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'booking'] });
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'session-reservation'] });
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'email-deliveries'] });
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'email-delivery'] });
  };

  const list = useQuery({
    queryKey: ['personal-link', 'bookings', filter ?? 'all'],
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
