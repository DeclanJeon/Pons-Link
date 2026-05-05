import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type PersonalLinkRepositorySelectionInput, usePersonalLinkRepository } from './usePersonalLinkRepository';
import type { PaidProposalPayload, RequestDecisionPayload } from './types';

type RepositorySelectionArg = PersonalLinkRepositorySelectionInput | string | null | undefined;

const resolveSelection = (selection?: RepositorySelectionArg): PersonalLinkRepositorySelectionInput | undefined => {
  if (selection === undefined) return undefined;
  if (typeof selection === 'string') return { apiUrl: selection };
  if (selection === null) return { apiUrl: null };
  return selection;
};

export const useRequestDetail = (requestId: string, selection?: RepositorySelectionArg) => {
  const repositorySelection = resolveSelection(selection);
  const repository = usePersonalLinkRepository(repositorySelection);
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'request'] });
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'requests'] });
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'bookings'] });
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'email-deliveries'] });
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'front-desk-summary'] });
  };

  const detail = useQuery({
    queryKey: ['personal-link', 'request', repositorySelection?.apiUrl ?? 'local', requestId],
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
  const paidProposal = useMutation({
    mutationFn: (payload?: PaidProposalPayload) => repository.proposePaidConsultation(requestId, payload),
    onSuccess: invalidate,
  });
  const decline = useMutation({
    mutationFn: (reason?: string) => repository.declineRequest(requestId, reason),
    onSuccess: invalidate,
  });

  return { detail, accept, counter, paidProposal, decline };
};
