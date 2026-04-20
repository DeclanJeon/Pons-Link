import { useQuery } from '@tanstack/react-query';
import { usePersonalLinkRepository } from './usePersonalLinkRepository';

export const useBookingDetail = (bookingId: string) => {
  const repository = usePersonalLinkRepository();

  const detail = useQuery({
    queryKey: ['personal-link', 'booking', bookingId],
    queryFn: () => repository.getBooking(bookingId),
    enabled: Boolean(bookingId),
  });

  const reservation = useQuery({
    queryKey: ['personal-link', 'session-reservation', bookingId],
    queryFn: () => repository.getSessionReservation(bookingId),
    enabled: Boolean(bookingId),
  });

  return { detail, reservation };
};
