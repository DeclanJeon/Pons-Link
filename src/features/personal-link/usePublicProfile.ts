import { useQuery } from '@tanstack/react-query';
import { getPersonalLinkRepository, resolvePersonalLinkApiUrl } from './usePersonalLinkRepository';

export interface UsePublicProfileOptions {
  requireRemote?: boolean;
}

export const usePublicProfile = (
  slug: string,
  apiUrl?: string | null,
  options?: UsePublicProfileOptions,
) => {
  const resolvedApiUrl = resolvePersonalLinkApiUrl(apiUrl);
  const isRemoteUnavailable = Boolean(options?.requireRemote && !resolvedApiUrl);
  const repository = isRemoteUnavailable
    ? null
    : getPersonalLinkRepository({ apiUrl: resolvedApiUrl });

  const query = useQuery({
    queryKey: ['personal-link', 'public-profile', resolvedApiUrl ?? 'remote-unavailable', slug],
    queryFn: () => repository!.getPublicProfileBySlug(slug),
    enabled: Boolean(slug) && !isRemoteUnavailable,
    select: (profile) => {
      if (!profile) return null;
      return {
        ...profile,
        hostEmail: undefined,
      };
    },
  });

  return {
    ...query,
    isRemoteUnavailable,
  };
};
