import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePersonalLinkRepository } from './usePersonalLinkRepository';
import type { RequestDecisionPayload } from './types';

export const useRequestDetail = (requestId: string) => {
  const repository = usePersonalLinkRepository();
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'request', requestId] });
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'requests'] });
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'bookings'] });
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'email-deliveries'] });
  };

  const detail = useQuery({
    queryKey: ['personal-link', 'request', requestId],
    queryFn: () => repository.getRequest(requestId),
    enabled: Boolean(requestId),
  });

  const accept = useMutation({
    mutationFn: (payload: RequestDecisionPayload) => repository.acceptRequest(requestId, payload),
    onSuccess: invalidate,
  });
  const counter = useMutation({
    mutationFn: (payload: RequestDecisionPayload) => repository.counterProposeRequest(requestId, payload),
    onSuccess: invalidate,
  });
  const decline = useMutation({
    mutationFn: (reason?: string) => repository.declineRequest(requestId, reason),
    onSuccess: invalidate,
  });

  return { detail, accept, counter, decline };
};
