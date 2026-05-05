import { useQuery } from '@tanstack/react-query';
import { type PersonalLinkRepositorySelectionInput, usePersonalLinkRepository } from './usePersonalLinkRepository';

type RepositorySelectionArg = PersonalLinkRepositorySelectionInput | string | null | undefined;

const resolveSelection = (selection?: RepositorySelectionArg): PersonalLinkRepositorySelectionInput | undefined => {
  if (selection === undefined) return undefined;
  if (typeof selection === 'string') return { apiUrl: selection };
  if (selection === null) return { apiUrl: null };
  return selection;
};

export const useFrontDeskSummary = (selection?: RepositorySelectionArg) => {
  const repositorySelection = resolveSelection(selection);
  const repository = usePersonalLinkRepository(repositorySelection);

  return useQuery({
    queryKey: ['personal-link', 'front-desk-summary', repositorySelection?.apiUrl ?? 'local'],
    queryFn: () => repository.getFrontDeskSummary(),
    retry: false,
    refetchInterval: (query) => (query.state.error ? false : 5000),
  });
};
