import { useMutation } from '@tanstack/react-query';
import { usePersonalLinkRepository } from './usePersonalLinkRepository';
import type { RequestCreateInput } from './types';

export const useCreateRequest = () => {
  const repository = usePersonalLinkRepository();
  return useMutation({ mutationFn: (input: RequestCreateInput) => repository.createRequest(input) });
};
