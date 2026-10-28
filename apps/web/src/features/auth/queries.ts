import type { CompleteOnboardingInput, Me, UsernameAvailability } from '@opulent/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/api/ApiProvider';
import { queryKeys } from '@/api/queryKeys';

export function useMe(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api<Me>('/v1/users/me'),
    enabled,
  });
}

/** Typing-time hint only; the server decides whether the username is free. */
export function useUsernameAvailability(username: string, enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.usernameAvailability(username),
    queryFn: () =>
      api<UsernameAvailability>(
        `/v1/users/me/username-available?username=${encodeURIComponent(username)}`,
      ),
    enabled: enabled && username.length > 0,
    staleTime: 30 * 1000,
  });
}

export function useCompleteOnboarding() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CompleteOnboardingInput) =>
      api<Me>('/v1/users/me/onboarding', { method: 'POST', body: input }),
    onSuccess: (me) => queryClient.setQueryData(queryKeys.me, me),
  });
}
