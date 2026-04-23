import { useMemo } from 'react';
import { getConfiguredPersonalLinkApiUrl } from './backendSurface';
import type { PersonalLinkRepositorySelectionInput } from './usePersonalLinkRepository';
import { useMyProfile } from './useMyProfile';

export interface LoungeAliasItem {
  id: string;
  alias: string;
  href: string;
  statusLabel: string;
  visibilityLabel: string;
  responseLabel: string;
  headline: string;
  timezone: string;
  availabilitySummary: string;
  enabledRequestTypes: string[];
}

const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getVisibilityLabel = (visibility: 'public' | 'unlisted' | 'private') => {
  if (visibility === 'private') return 'Private';
  if (visibility === 'unlisted') return 'Direct-link only';
  return 'Public';
};

const getResponseLabel = (responsePolicy: 'open' | 'approve_before_booking' | 'paused') => {
  if (responsePolicy === 'paused') return 'Paused';
  if (responsePolicy === 'open') return 'Open';
  return 'Review before booking';
};

const getEnabledRequestTypes = (input: {
  allowGeneralRequest: boolean;
  allowScheduleRequest: boolean;
  allowMentoringRequest: boolean;
  allowCollabRequest: boolean;
}) => {
  const labels: string[] = [];
  if (input.allowGeneralRequest) labels.push('General');
  if (input.allowScheduleRequest) labels.push('Schedule');
  if (input.allowMentoringRequest) labels.push('Mentoring');
  if (input.allowCollabRequest) labels.push('Collaboration');
  return labels;
};

const getAvailabilitySummary = (weekdays?: number[], startHour?: number, endHour?: number) => {
  if (!weekdays?.length || startHour == null || endHour == null) {
    return 'Availability not configured yet';
  }

  return `${weekdays.map((day) => weekdayNames[day] ?? '?').join(', ')} · ${startHour}:00-${endHour}:00`;
};

type RepositorySelectionArg = PersonalLinkRepositorySelectionInput | string | null | undefined;

const resolveSelection = (selection?: RepositorySelectionArg): PersonalLinkRepositorySelectionInput | undefined => {
  if (selection === undefined) {
    const apiUrl = getConfiguredPersonalLinkApiUrl();
    return apiUrl === undefined ? undefined : { apiUrl };
  }

  if (typeof selection === 'string' || selection === null) return { apiUrl: selection };
  return selection;
};

export const useAliases = (selection?: RepositorySelectionArg) => {
  const profile = useMyProfile(resolveSelection(selection));

  const items = useMemo<LoungeAliasItem[]>(() => {
    const publicProfile = profile.bootstrap.data?.publicProfile;
    if (!publicProfile?.slug) {
      return [];
    }

    const enabledRequestTypes = getEnabledRequestTypes(publicProfile);
    const isActive = publicProfile.profileVisibility !== 'private' && publicProfile.responsePolicy !== 'paused';

    return [
      {
        id: publicProfile.slug,
        alias: publicProfile.slug,
        href: `/u/${publicProfile.slug}`,
        statusLabel: isActive ? 'Active' : 'Paused',
        visibilityLabel: getVisibilityLabel(publicProfile.profileVisibility),
        responseLabel: getResponseLabel(publicProfile.responsePolicy),
        headline: publicProfile.headline,
        timezone: publicProfile.timezone,
        availabilitySummary: getAvailabilitySummary(
          publicProfile.availabilityWeekdays,
          publicProfile.availabilityStartHour,
          publicProfile.availabilityEndHour,
        ),
        enabledRequestTypes,
      },
    ];
  }, [profile.bootstrap.data]);

  return {
    profile,
    items,
    primaryAlias: items[0] ?? null,
  };
};
