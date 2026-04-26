import { useMutation } from '@tanstack/react-query';
import { type PersonalLinkRepositorySelectionInput, usePersonalLinkRepository } from './usePersonalLinkRepository';
import type {
  RequestActionDirectCallResult,
  RequestActionProposeTimePayload,
  RequestDecisionPayload,
} from './types';

type RepositorySelectionArg = PersonalLinkRepositorySelectionInput | string | null | undefined;

const resolveSelection = (selection?: RepositorySelectionArg): PersonalLinkRepositorySelectionInput | undefined => {
  if (selection === undefined) return undefined;
  if (typeof selection === 'string' || selection === null) return { apiUrl: selection };
  return selection;
};

export const useRequestAction = (selection?: RepositorySelectionArg) => {
  const repositorySelection = resolveSelection(selection);
  const repository = usePersonalLinkRepository(repositorySelection);

  const accept = useMutation({
    mutationFn: ({ token, payload }: { token: string; payload: RequestDecisionPayload }) =>
      repository.acceptRequestByActionToken(token, payload),
    retry: false,
  });

  const proposeTime = useMutation({
    mutationFn: ({ token, payload }: { token: string; payload: RequestActionProposeTimePayload }) =>
      repository.proposeTimeByActionToken(token, payload),
    retry: false,
  });

  const directCall = useMutation({
    mutationFn: ({ token, message }: { token: string; message?: string }): Promise<RequestActionDirectCallResult> =>
      repository.requestDirectCallByActionToken(token, message),
    retry: false,
  });

  return { accept, proposeTime, directCall };
};
