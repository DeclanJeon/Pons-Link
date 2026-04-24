export type AzureSpeechTokenResult =
  | {
      status: 'available';
      token: string;
      region: string;
      endpoint: string;
      expiresInSeconds: number;
    }
  | {
      status: 'disabled' | 'unavailable';
      error?: string;
    };

export const resolveSpeechTokenApiUrl = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, '');
};

export const getConfiguredSpeechTokenApiUrl = (): string | null => {
  return resolveSpeechTokenApiUrl(import.meta.env.VITE_SPEECH_TOKEN_API_URL as string | undefined)
    ?? resolveSpeechTokenApiUrl(import.meta.env.VITE_API_URL as string | undefined);
};

export const fetchAzureSpeechToken = async ({
  apiUrl = getConfiguredSpeechTokenApiUrl(),
  timeoutMs = 5000,
}: {
  apiUrl?: string | null;
  timeoutMs?: number;
} = {}): Promise<AzureSpeechTokenResult> => {
  if (!apiUrl) {
    return { status: 'disabled', error: 'Speech token API URL is not configured' };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${apiUrl}/api/speech/token`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      return { status: 'unavailable', error: `Speech token API returned ${response.status}` };
    }

    const payload = await response.json() as {
      ok?: boolean;
      token?: string;
      region?: string;
      endpoint?: string;
      expiresInSeconds?: number;
      error?: string;
    };

    if (!payload.ok || !payload.token || !payload.region || !payload.endpoint) {
      return { status: 'unavailable', error: payload.error ?? 'Speech token response is incomplete' };
    }

    return {
      status: 'available',
      token: payload.token,
      region: payload.region,
      endpoint: payload.endpoint,
      expiresInSeconds: payload.expiresInSeconds ?? 600,
    };
  } catch (error) {
    return {
      status: 'unavailable',
      error: error instanceof Error ? error.message : 'Failed to fetch Azure Speech token',
    };
  } finally {
    window.clearTimeout(timeout);
  }
};
