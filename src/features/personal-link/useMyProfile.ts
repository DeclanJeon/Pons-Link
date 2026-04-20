import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePersonalLinkRepository } from './usePersonalLinkRepository';
import { useAuthSession } from './useAuthSession';
import type { AccountProfile, PublicProfile, UserProfile } from './types';

export const useMyProfile = () => {
  const repository = usePersonalLinkRepository();
  const { session } = useAuthSession();
  const queryClient = useQueryClient();

  const bootstrap = useQuery({
    queryKey: ['personal-link', 'profile-bootstrap', session?.email ?? 'guest'],
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
