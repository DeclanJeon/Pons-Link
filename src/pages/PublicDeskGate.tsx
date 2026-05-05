import { useMemo, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { DeskIntroPanel } from '@/components/desk/DeskIntroPanel';
import { PurposeRequestSelector } from '@/components/desk/PurposeRequestSelector';
import { DeskRequestForm } from '@/components/desk/DeskRequestForm';
import { RequestSubmittedPanel } from '@/components/desk/RequestSubmittedPanel';
import { usePublicProfile } from '@/features/personal-link/usePublicProfile';
import { getConfiguredPersonalLinkApiUrl } from '@/features/personal-link/usePersonalLinkRepository';
import type { ContactRequest, RequestType } from '@/features/personal-link/types';

const requestTypes: RequestType[] = ['general', 'schedule', 'mentoring', 'collab'];

const isRequestTypeAvailable = (
  type: RequestType,
  availability: Partial<Record<RequestType, boolean>>,
) => availability[type] !== false;

export const PublicDeskGate = () => {
  const { identifier } = useParams<{ identifier?: string }>();
  const hostSlug = (identifier ?? 'public-desk');
  const apiUrl = useMemo(() => getConfiguredPersonalLinkApiUrl(), []);
  const { data: profile, isLoading: profileLoading, isRemoteUnavailable } = usePublicProfile(
    hostSlug,
    apiUrl,
    {
      requireRemote: true,
      retry: false,
    }
  );

  const [selectedType, setSelectedType] = useState<RequestType>('general');
  const [submittedRequest, setSubmittedRequest] = useState<ContactRequest | null>(null);

  const availability = useMemo<Partial<Record<RequestType, boolean>> | undefined>(() => {
    if (!profile) return undefined;
    return {
      general: profile.allowGeneralRequest,
      schedule: profile.allowScheduleRequest,
      mentoring: profile.allowMentoringRequest,
      collab: profile.allowCollabRequest,
    };
  }, [profile]);

  const hasAllowedRequestType = useMemo(() => (
    availability ? requestTypes.some((type) => isRequestTypeAvailable(type, availability)) : true
  ), [availability]);

  useEffect(() => {
    if (!availability) return;
    if (!isRequestTypeAvailable(selectedType, availability)) {
      const firstAllowed = requestTypes.find((type) => isRequestTypeAvailable(type, availability));
      if (firstAllowed) setSelectedType(firstAllowed);
    }
  }, [availability, selectedType]);

  const canShowDesk = !!profile;
  const pageTitle = useMemo(() => {
    if (hostSlug === 'public-desk') return 'Public Desk Gate';
    return `Desk for ${hostSlug}`;
  }, [hostSlug]);

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:px-8 lg:px-16">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-md">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-white">{pageTitle}</h1>
            <span className="text-sm text-zinc-400">Slug: {hostSlug}</span>
          </div>
          <p className="mt-2 text-sm text-zinc-300">Submit a request to book a moment with this public profile. All data stays on your side and is mediated through the hosted API.</p>
        </header>

        {profile && (
          <section className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-md">
            <div className="flex items-center justify-between">
              <div className="text-sm text-zinc-300">
                <span className="text-white font-semibold">{profile.displayName ?? profile.slug ?? hostSlug}</span>
                {profile.headline && <span className="ml-2 text-zinc-400">{profile.headline}</span>}
              </div>
              {profile.timezone && <span className="text-xs text-zinc-400">Timezone: {profile.timezone}</span>}
            </div>
            {profile.bio && <p className="mt-2 text-xs text-zinc-300">{profile.bio}</p>}
            {profile.defaultRoomType && <p className="mt-1 text-xs text-zinc-400">Default room: {profile.defaultRoomType}</p>}
          </section>
        )}

        <DeskIntroPanel />

        {isRemoteUnavailable && (
          <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-6 text-sm text-amber-100">Public desk is unavailable because the remote API is not configured.</div>
        )}
        {profileLoading && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">Loading public profile...</div>
        )}
        {!isRemoteUnavailable && !profileLoading && !profile && (
          <div className="rounded-xl border border-rose-300/20 bg-rose-300/10 p-6 text-sm text-rose-100">Desk not found. The slug {hostSlug} did not return a profile. This public desk link may be inactive or misconfigured.</div>
        )}
        {!isRemoteUnavailable && !profileLoading && canShowDesk && (
          <section className="space-y-6">
            <PurposeRequestSelector value={selectedType} onChange={setSelectedType} availability={availability} />
            {!hasAllowedRequestType && (
              <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-6 text-sm text-amber-100">This desk is visible, but it is not accepting new request types right now.</div>
            )}
            {!submittedRequest && hasAllowedRequestType && (
              <DeskRequestForm apiUrl={apiUrl} hostSlug={hostSlug} requestType={selectedType} onSubmitted={setSubmittedRequest} />
            )}
          </section>
        )}

        {submittedRequest && (
          <RequestSubmittedPanel hostSlug={hostSlug} request={submittedRequest} />
        )}
      </div>
    </div>
  );
};

export default PublicDeskGate;
