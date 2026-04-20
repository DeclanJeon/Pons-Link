import { useQuery } from '@tanstack/react-query';
import { usePersonalLinkRepository } from './usePersonalLinkRepository';

export const usePublicProfile = (slug: string) => {
  const repository = usePersonalLinkRepository();

  return useQuery({
    queryKey: ['personal-link', 'public-profile', slug],
    queryFn: () => repository.getPublicProfileBySlug(slug),
    enabled: Boolean(slug),
  });
};
