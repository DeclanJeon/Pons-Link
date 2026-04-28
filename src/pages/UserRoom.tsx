import Room from './Room';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { HostRequestComposer } from '@/features/personal-link/HostRequestComposer';
import { normalizeSlug } from '@/features/personal-link/slug';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { usePublicProfile } from '@/features/personal-link/usePublicProfile';
import { getConfiguredPersonalLinkApiUrl } from '@/features/personal-link/usePersonalLinkRepository';

type MeetingAccessResponse = {
  state: 'allowed' | 'pending' | 'declined' | 'not_found' | 'invalid';
  reservation?: {
    joinUrl?: string;
  };
};

const toInternalJoinPath = (joinUrl?: string): string | null => {
  if (!joinUrl) {
    return null;
  }

  try {
    const parsed = new URL(joinUrl, window.location.origin);
    if (parsed.origin !== window.location.origin) {
      return joinUrl;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return joinUrl.startsWith('/') ? joinUrl : null;
  }
};

const UserRoom = () => {
  const { roomTitle = '' } = useParams<{ roomTitle: string }>();
  const location = useLocation();
  const hostSlug = decodeURIComponent(roomTitle);
  const { session } = useAuthSession();
  const apiUrl = getConfiguredPersonalLinkApiUrl();
  const profile = usePublicProfile(hostSlug, apiUrl, { requireRemote: true });
  const normalizedHostSlug = normalizeSlug(hostSlug);
  const ownerAliases = [normalizeSlug(session?.primaryAlias ?? ''), normalizeSlug(session?.uniqueNumber ?? '')];
  const localSessionMatchesSlug = Boolean(session) && ownerAliases.some((value) => value && value === normalizedHostSlug);
  const isHost = profile.data?.viewer
    ? profile.data.viewer.isOwner
    : localSessionMatchesSlug;
  const searchParams = new URLSearchParams(location.search);
  const cId = searchParams.get('c_id')?.trim() ?? '';
  const entryFull = searchParams.get('entry') === 'full';
  const accessCode = location.hash.replace('#', '').trim();
  const hasMeetingAccess = Boolean(cId && accessCode);
  const aliasNotFound = Boolean(
    normalizedHostSlug && !profile.isLoading && !profile.data && !profile.isError && !profile.isRemoteUnavailable && !hasMeetingAccess,
  );
  const meetingAccess = useQuery({
    queryKey: ['meeting-access', apiUrl, cId, accessCode],
    enabled: hasMeetingAccess && !isHost,
    retry: false,
    refetchInterval: (query) => query.state.data?.state === 'pending' ? 5000 : false,
    queryFn: async () => {
      const url = new URL('/api/session-access/meeting/access', apiUrl);
      url.searchParams.set('c_id', cId);
      url.searchParams.set('code', accessCode);
      const response = await fetch(url.toString());
      if (!response.ok && response.status !== 404) {
        throw new Error('Meeting access lookup failed.');
      }
      return response.json() as Promise<MeetingAccessResponse>;
    },
  });

  const canEnterRoom = isHost || meetingAccess.data?.state === 'allowed';
  const meetingJoinPath = meetingAccess.data?.state === 'allowed'
    ? toInternalJoinPath(meetingAccess.data.reservation?.joinUrl)
    : null;
  const shouldShowOfflineRequest = Boolean(profile.data) && ((!canEnterRoom && !hasMeetingAccess) || (!isHost && entryFull));
  const profileRoomType = profile.data?.defaultRoomType;

  if (!isHost && meetingJoinPath) {
    return <Navigate to={meetingJoinPath} replace />;
  }

  if (!entryFull && canEnterRoom) {
    return <Room roomTypeOverride={profileRoomType} />;
  }

  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-5 py-12">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.24em] text-indigo-300">PonsLink room gate</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
            {profile.data ? profile.data.slug : hostSlug}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-400">
            This personal room only opens for the identifier owner or a visitor with a meeting access link.
          </p>
          {hasMeetingAccess && !isHost ? (
            <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
              {meetingAccess.isLoading
                ? 'Checking meeting access...'
                : meetingAccess.data?.state === 'pending'
                  ? 'This meeting request is still waiting for the host response.'
                  : meetingAccess.data?.state === 'declined'
                    ? 'This meeting request was declined.'
                    : meetingAccess.data?.state === 'not_found' || meetingAccess.data?.state === 'invalid'
                      ? 'This meeting access link is invalid or expired.'
                      : meetingAccess.isError
                        ? 'Meeting access could not be verified right now.'
                        : null}
            </p>
          ) : null}
        </div>

      {aliasNotFound ? (
        <div className="mb-6 max-w-md rounded-2xl border border-amber-500/25 bg-[#09090d]/95 px-5 py-4 text-sm leading-6 text-amber-100 shadow-2xl">
          <p className="font-semibold">Identifier not registered.</p>
          <p className="mt-1 text-amber-100/80">
            No active PonsLink alias was found for <span className="font-medium text-white">{hostSlug}</span>. The owner needs to create this personal link in Lounge before visitors can send meeting requests.
          </p>
        </div>
      ) : null}

      {profile.isError || profile.isRemoteUnavailable ? (
        <div className="flex max-w-md items-start gap-3 rounded-2xl border border-amber-500/25 bg-[#09090d]/95 px-4 py-3 text-sm leading-6 text-amber-100 shadow-2xl">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Host lookup unavailable.</p>
            <p>Room access is blocked until the host profile or a valid meeting access link can be verified.</p>
          </div>
        </div>
      ) : null}

      {shouldShowOfflineRequest ? (
        <HostRequestComposer
          hostSlug={hostSlug}
          profile={profile.data}
          defaultOpen
          showLauncher={false}
          closeable={false}
          requirePreferredDate
          defaultRequestType="schedule"
          offlineNotice
          notice={entryFull ? 'This 1:1 room is full right now. Send a reservation request and PonsLink will issue a visitor link for the host to reconnect with you.' : undefined}
        />
      ) : null}
      </div>
    </main>
  );
};

export default UserRoom;
