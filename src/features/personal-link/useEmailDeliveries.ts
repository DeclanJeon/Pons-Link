import { useQuery } from '@tanstack/react-query';
import { usePersonalLinkRepository } from './usePersonalLinkRepository';

export const useEmailDeliveries = (bookingIds: string[]) => {
  const repository = usePersonalLinkRepository();

  return useQuery({
    queryKey: ['personal-link', 'email-deliveries', bookingIds.join(',')],
    queryFn: () => repository.listEmailDeliveries(bookingIds),
    enabled: bookingIds.length > 0,
  });
};

export const useEmailDelivery = (bookingId?: string) => {
  const repository = usePersonalLinkRepository();

  return useQuery({
    queryKey: ['personal-link', 'email-delivery', bookingId ?? 'none'],
    queryFn: () => repository.getEmailDelivery(bookingId as string),
    enabled: Boolean(bookingId),
  });
};
