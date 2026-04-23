import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type PersonalLinkRepositorySelectionInput, usePersonalLinkRepository } from './usePersonalLinkRepository';
import { useAuthSession } from './useAuthSession';
import type { AccountProfile, PublicProfile, UserProfile } from './types';

type RepositorySelectionArg = PersonalLinkRepositorySelectionInput | string | null | undefined;

const resolveSelection = (selection?: RepositorySelectionArg): PersonalLinkRepositorySelectionInput | undefined => {
  if (selection === undefined) return undefined;
  if (typeof selection === 'string' || selection === null) return { apiUrl: selection };
  return selection;
};

export const useMyProfile = (selection?: RepositorySelectionArg) => {
  const repositorySelection = resolveSelection(selection);
  const repository = usePersonalLinkRepository(repositorySelection);
  const { session } = useAuthSession();
  const queryClient = useQueryClient();

  const bootstrap = useQuery({
    queryKey: ['personal-link', 'profile-bootstrap', repositorySelection?.apiUrl ?? 'local', session?.email ?? 'guest'],
    queryFn: async () => {
      if (!session?.email) return { userProfile: null, accountProfile: null, publicProfile: null };
      return repository.getAuthBootstrapProfile(session.email);
    },
    enabled: Boolean(session?.email),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['personal-link', 'profile-bootstrap'] });

  const saveUserProfile = useMutation({ mutationFn: (profile: UserProfile) => repository.saveUserProfile(profile), onSuccess: invalidate });
  const saveAccountProfile = useMutation({ mutationFn: (profile: AccountProfile) => repository.saveAccountProfile(profile), onSuccess: invalidate });
  const savePublicProfile = useMutation({ mutationFn: (profile: PublicProfile) => repository.savePublicProfile(profile), onSuccess: invalidate });

  return { bootstrap, saveUserProfile, saveAccountProfile, savePublicProfile };
};
