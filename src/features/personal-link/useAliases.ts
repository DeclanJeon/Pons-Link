import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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

const getEnabledRequestTypes = (input: {
  allowGeneralRequest: boolean;
  allowScheduleRequest: boolean;
  allowMentoringRequest: boolean;
  allowCollabRequest: boolean;
}, t: (key: string) => string) => {
  const labels: string[] = [];
  if (input.allowGeneralRequest) labels.push(t('lounge.labels.requestTypeShort.general'));
  if (input.allowScheduleRequest) labels.push(t('lounge.labels.requestTypeShort.schedule'));
  if (input.allowMentoringRequest) labels.push(t('lounge.labels.requestTypeShort.mentoring'));
  if (input.allowCollabRequest) labels.push(t('lounge.labels.requestTypeShort.collab'));
  return labels;
};

const getAvailabilitySummary = (
  t: (key: string) => string,
  weekdays?: number[],
  startHour?: number,
  endHour?: number,
) => {
  if (!weekdays?.length || startHour == null || endHour == null) {
    return t('lounge.labels.availabilityNotConfigured');
  }

  return `${weekdays.map((day) => t(`lounge.labels.weekdays.${day}`) || '?').join(', ')} · ${startHour}:00-${endHour}:00`;
};

type RepositorySelectionArg = PersonalLinkRepositorySelectionInput | string | null | undefined;

const resolveSelection = (selection?: RepositorySelectionArg): PersonalLinkRepositorySelectionInput | undefined => {
  if (selection === undefined) {
    const apiUrl = getConfiguredPersonalLinkApiUrl();
    return apiUrl === undefined ? undefined : { apiUrl };
  }

  if (typeof selection === 'string') return { apiUrl: selection };
  if (selection === null) return { apiUrl: null };
  return selection;
};

export const useAliases = (selection?: RepositorySelectionArg) => {
  const { t } = useTranslation();
  const profile = useMyProfile(resolveSelection(selection));

  const items = useMemo<LoungeAliasItem[]>(() => {
    const publicProfile = profile.bootstrap.data?.publicProfile;
    if (!publicProfile?.slug) {
      return [];
    }

    const enabledRequestTypes = getEnabledRequestTypes(publicProfile, t);
    const isActive = publicProfile.profileVisibility !== 'private' && publicProfile.responsePolicy !== 'paused';

    return [
      {
        id: publicProfile.slug,
        alias: publicProfile.slug,
        href: `/room/${publicProfile.slug}`,
        statusLabel: isActive ? t('lounge.labels.active') : t('lounge.labels.paused'),
        visibilityLabel: t(`lounge.labels.visibility.${publicProfile.profileVisibility}`),
        responseLabel: t(`lounge.labels.response.${publicProfile.responsePolicy}`),
        headline: publicProfile.headline,
        timezone: publicProfile.timezone,
        availabilitySummary: getAvailabilitySummary(
          t,
          publicProfile.availabilityWeekdays,
          publicProfile.availabilityStartHour,
          publicProfile.availabilityEndHour,
        ),
        enabledRequestTypes,
      },
    ];
  }, [profile.bootstrap.data, t]);

  return {
    profile,
    items,
    primaryAlias: items[0] ?? null,
  };
};
