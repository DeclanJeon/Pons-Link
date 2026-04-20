import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePersonalLinkRepository } from './usePersonalLinkRepository';

export const useSessionReservation = () => {
  const repository = usePersonalLinkRepository();
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
