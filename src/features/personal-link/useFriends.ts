import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type PersonalLinkRepositorySelectionInput, usePersonalLinkRepository } from './usePersonalLinkRepository';

type RepositorySelectionArg = PersonalLinkRepositorySelectionInput | string | null | undefined;

const resolveSelection = (selection?: RepositorySelectionArg): PersonalLinkRepositorySelectionInput | undefined => {
  if (selection === undefined) return undefined;
  if (typeof selection === 'string' || selection === null) return { apiUrl: selection };
  return selection;
};

export const useFriends = (selection?: RepositorySelectionArg) => {
  const repositorySelection = resolveSelection(selection);
  const repository = usePersonalLinkRepository(repositorySelection);
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'friends'] });
  };

  const list = useQuery({
    queryKey: ['personal-link', 'friends', repositorySelection?.apiUrl ?? 'local'],
    queryFn: () => repository.listFriends(),
    refetchInterval: 5000,
  });

  const addFriend = useMutation({
    mutationFn: (slug: string) => repository.addFriendBySlug(slug),
    onSuccess: invalidate,
  });

  const blockFriend = useMutation({
    mutationFn: (id: string) => repository.blockFriend(id),
    onSuccess: invalidate,
  });

  const blockVisitorIdentity = useMutation({
    mutationFn: ({ email, displayName }: { email: string; displayName?: string }) => repository.blockVisitorIdentity(email, displayName),
    onSuccess: invalidate,
  });

  const removeFriend = useMutation({
    mutationFn: (id: string) => repository.removeFriend(id),
    onSuccess: invalidate,
  });

  return { list, addFriend, blockFriend, blockVisitorIdentity, removeFriend };
};
