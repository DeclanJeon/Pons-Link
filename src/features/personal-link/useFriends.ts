import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePersonalLinkRepository } from './usePersonalLinkRepository';

export const useFriends = () => {
  const repository = usePersonalLinkRepository();
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'friends'] });
  };

  const list = useQuery({
    queryKey: ['personal-link', 'friends'],
    queryFn: () => repository.listFriends(),
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
