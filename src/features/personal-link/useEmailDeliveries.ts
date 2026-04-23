import { useQuery } from '@tanstack/react-query';
import { getConfiguredPersonalLinkApiUrl } from './backendSurface';
import { type PersonalLinkRepositorySelectionInput, usePersonalLinkRepository } from './usePersonalLinkRepository';

type RepositorySelectionArg = PersonalLinkRepositorySelectionInput | string | null | undefined;

const resolveSelection = (selection?: RepositorySelectionArg): PersonalLinkRepositorySelectionInput | undefined => {
  if (selection === undefined) {
    const apiUrl = getConfiguredPersonalLinkApiUrl();
    return apiUrl === undefined ? undefined : { apiUrl };
  }

  if (typeof selection === 'string' || selection === null) return { apiUrl: selection };
  return selection;
};

export const useEmailDeliveries = (bookingIds: string[], selection?: RepositorySelectionArg) => {
  const repositorySelection = resolveSelection(selection);
  const repository = usePersonalLinkRepository(repositorySelection);

  return useQuery({
    queryKey: ['personal-link', 'email-deliveries', repositorySelection?.apiUrl ?? 'local', bookingIds.join(',')],
    queryFn: () => repository.listEmailDeliveries(bookingIds),
    enabled: bookingIds.length > 0,
  });
};

export const useEmailDelivery = (bookingId?: string, selection?: RepositorySelectionArg) => {
  const repositorySelection = resolveSelection(selection);
  const repository = usePersonalLinkRepository(repositorySelection);

  return useQuery({
    queryKey: ['personal-link', 'email-delivery', repositorySelection?.apiUrl ?? 'local', bookingId ?? 'none'],
    queryFn: () => repository.getEmailDelivery(bookingId as string),
    enabled: Boolean(bookingId),
  });
};
