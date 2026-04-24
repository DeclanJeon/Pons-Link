import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type PersonalLinkRepositorySelectionInput, usePersonalLinkRepository } from './usePersonalLinkRepository';

type RepositorySelectionArg = PersonalLinkRepositorySelectionInput | string | null | undefined;

const resolveSelection = (selection?: RepositorySelectionArg): PersonalLinkRepositorySelectionInput | undefined => {
  if (selection === undefined) return undefined;
  if (typeof selection === 'string' || selection === null) return { apiUrl: selection };
  return selection;
};

export const useRequests = (filter?: string, selection?: RepositorySelectionArg) => {
  const repositorySelection = resolveSelection(selection);
  const repository = usePersonalLinkRepository(repositorySelection);
  return useQuery({
    queryKey: ['personal-link', 'requests', repositorySelection?.apiUrl ?? 'local', filter ?? 'all'],
    queryFn: () => repository.listRequests(filter),
    refetchInterval: 5000,
  });
};

export const useExpireRequests = (apiUrl?: string | null) => {
  const repository = usePersonalLinkRepository({ apiUrl });
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (now?: string) => repository.expireRequests(now),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['personal-link', 'requests'] });
    },
  });
};

export const useDeleteRequest = (apiUrl?: string | null) => {
  const repository = usePersonalLinkRepository({ apiUrl });
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string) => repository.deleteRequest(requestId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['personal-link', 'requests'] });
    },
  });
};
