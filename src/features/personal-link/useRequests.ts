import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePersonalLinkRepository } from './usePersonalLinkRepository';

export const useRequests = (filter?: string) => {
  const repository = usePersonalLinkRepository();
  return useQuery({
    queryKey: ['personal-link', 'requests', filter ?? 'all'],
    queryFn: () => repository.listRequests(filter),
  });
};

export const useExpireRequests = () => {
  const repository = usePersonalLinkRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (now?: string) => repository.expireRequests(now),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['personal-link', 'requests'] });
    },
  });
};
