import { localRepository } from './localRepository';
import type { PersonalLinkDataRepository } from './repository';
import { createRemoteRepository } from './remoteRepository';
import { getConfiguredPersonalLinkApiUrl as getConfiguredBackendPersonalLinkApiUrl, resolveBackendApiUrl } from './backendSurface';

export interface PersonalLinkRepositorySelectionInput {
  apiUrl?: string | null;
}

const localRepositoryAdapter: PersonalLinkDataRepository = {
  ...localRepository,
  kind: 'local',
};

export const resolvePersonalLinkApiUrl = (apiUrl?: string | null) => {
  return resolveBackendApiUrl(apiUrl);
};

export const getConfiguredPersonalLinkApiUrl = () => getConfiguredBackendPersonalLinkApiUrl();

export const getPersonalLinkRepository = (input?: PersonalLinkRepositorySelectionInput): PersonalLinkDataRepository => {
  const resolvedApiUrl = resolvePersonalLinkApiUrl(input?.apiUrl);

  return resolvedApiUrl ? createRemoteRepository(resolvedApiUrl) : localRepositoryAdapter;
};

export const usePersonalLinkRepository = (input?: PersonalLinkRepositorySelectionInput) => getPersonalLinkRepository(input);
