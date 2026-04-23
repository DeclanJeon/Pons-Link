import { useMemo } from 'react';
import { getConfiguredPersonalLinkApiUrl } from './backendSurface';
import { useAliases } from './useAliases';
import { useAuthSession } from './useAuthSession';
import { useBookings } from './useBookings';
import { useConversations } from './useConversations';
import { useFriends } from './useFriends';
import { useMyProfile } from './useMyProfile';
import type { PersonalLinkRepositorySelectionInput } from './usePersonalLinkRepository';
import { useRequests } from './useRequests';

type RepositorySelectionArg = PersonalLinkRepositorySelectionInput | string | null | undefined;

const resolveSelection = (selection?: RepositorySelectionArg): PersonalLinkRepositorySelectionInput | undefined => {
  if (selection === undefined) {
    const apiUrl = getConfiguredPersonalLinkApiUrl();
    return apiUrl === undefined ? undefined : { apiUrl };
  }

  if (typeof selection === 'string' || selection === null) return { apiUrl: selection };
  return selection;
};

export const useDashboard = (selection?: RepositorySelectionArg) => {
  const { session, logout } = useAuthSession();
  const repositorySelection = resolveSelection(selection);
  const friends = useFriends(repositorySelection);
  const requests = useRequests('pending', repositorySelection);
  const bookings = useBookings('confirmed', repositorySelection);
  const profile = useMyProfile(repositorySelection);
  const conversations = useConversations(repositorySelection);
  const aliases = useAliases(repositorySelection);

  const accountProfile = profile.bootstrap.data?.accountProfile;
  const publicProfile = profile.bootstrap.data?.publicProfile;
  const slug = publicProfile?.slug ?? '';
  const profileLink = slug ? `${window.location.origin}/u/${slug}` : '';
  const displayName = accountProfile?.displayName ?? session?.displayName ?? '';
  const image = accountProfile?.profileImageUrl ?? '';
  const headline =
    publicProfile?.headline ?? 'Your personal link studio for managing conversations.';

  const stats = useMemo(
    () => [
      { label: 'Conversations', value: conversations.counts.total },
      { label: 'Pending Requests', value: requests.data?.length ?? 0 },
      { label: 'Reservations', value: bookings.list.data?.length ?? 0 },
      { label: 'Aliases', value: aliases.items.length },
      { label: 'Friends', value: friends.list.data?.length ?? 0 },
    ],
    [aliases.items.length, bookings.list.data?.length, conversations.counts.total, friends.list.data?.length, requests.data?.length],
  );

  return {
    session,
    logout,
    friends,
    requests,
    bookings,
    profile,
    conversations,
    aliases,
    displayName,
    image,
    headline,
    slug,
    profileLink,
    stats,
    recentConversations: conversations.items.slice(0, 4),
    recentRequests: (requests.data ?? []).slice(0, 3),
    upcomingBookings: (bookings.list.data ?? []).slice(0, 3),
  };
};
