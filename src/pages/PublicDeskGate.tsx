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
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-8 text-[#111827] md:px-8 lg:px-16">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1E63FF]">PonsLink public profile</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#111827]">{pageTitle}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6B7280]">
                Meet with context, not cold calls. Review the host profile and send the right request before a room opens.
              </p>
            </div>
            <span className="rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-1 text-sm font-medium text-[#6B7280]">Slug: {hostSlug}</span>
          </div>
        </header>

        {profile && (
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EEF5FF] text-xl font-bold text-[#1E63FF]">
                  {(profile.displayName ?? profile.slug ?? hostSlug).slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-[#111827]">{profile.displayName ?? profile.slug ?? hostSlug}</h2>
                  {profile.headline && <p className="mt-1 text-sm text-[#6B7280]">{profile.headline}</p>}
                </div>
              </div>
              {profile.timezone && <span className="rounded-full bg-[#EEF5FF] px-3 py-1 text-xs font-semibold text-[#1E63FF]">Timezone: {profile.timezone}</span>}
            </div>
            {profile.bio && <p className="mt-4 max-w-3xl text-sm leading-6 text-[#374151]">{profile.bio}</p>}
            {profile.defaultRoomType && <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-[#6B7280]">Default room: {profile.defaultRoomType}</p>}
          </section>
        )}

        <DeskIntroPanel />

        {isRemoteUnavailable && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">Public desk is unavailable because the remote API is not configured.</div>
        )}
        {profileLoading && (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 text-sm text-[#6B7280]">Loading public profile...</div>
        )}
        {!isRemoteUnavailable && !profileLoading && !profile && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">Desk not found. The slug {hostSlug} did not return a profile. This public desk link may be inactive or misconfigured.</div>
        )}
        {!isRemoteUnavailable && !profileLoading && canShowDesk && (
          <section className="space-y-6">
            <PurposeRequestSelector value={selectedType} onChange={setSelectedType} availability={availability} />
            {!hasAllowedRequestType && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">This desk is visible, but it is not accepting new request types right now.</div>
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
