import { useMutation } from '@tanstack/react-query';
import { getPersonalLinkRepository, resolvePersonalLinkApiUrl } from './usePersonalLinkRepository';
import type { RequestCreateInput } from './types';

export interface UseCreateRequestOptions {
  requireRemote?: boolean;
}

const missingRemoteApiError = 'Public profile is unavailable because the remote API is not configured.';

export const useCreateRequest = (
  apiUrl?: string | null,
  options?: UseCreateRequestOptions,
) => {
  const resolvedApiUrl = resolvePersonalLinkApiUrl(apiUrl);
  const isRemoteUnavailable = Boolean(options?.requireRemote && !resolvedApiUrl);
  const repository = isRemoteUnavailable
    ? null
    : getPersonalLinkRepository({ apiUrl: resolvedApiUrl });

  return useMutation({
    mutationFn: (input: RequestCreateInput) => {
      if (!repository) {
        throw new Error(missingRemoteApiError);
      }

      return repository.createRequest(input);
    },
  });
};
