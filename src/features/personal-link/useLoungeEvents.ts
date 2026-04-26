import { useQuery } from '@tanstack/react-query';
import { type PersonalLinkRepositorySelectionInput, usePersonalLinkRepository } from './usePersonalLinkRepository';

type RepositorySelectionArg = PersonalLinkRepositorySelectionInput | string | null | undefined;

const resolveSelection = (selection?: RepositorySelectionArg): PersonalLinkRepositorySelectionInput | undefined => {
  if (selection === undefined) return undefined;
  if (typeof selection === 'string' || selection === null) return { apiUrl: selection };
  return selection;
};

export const useLoungeEvents = (selection?: RepositorySelectionArg) => {
  const repositorySelection = resolveSelection(selection);
  const repository = usePersonalLinkRepository(repositorySelection);

  return useQuery({
    queryKey: ['personal-link', 'lounge-events', repositorySelection?.apiUrl ?? 'local'],
    queryFn: () => repository.listLoungeEvents(),
    retry: false,
    refetchInterval: (query) => (query.state.error ? false : 5000),
  });
};
