import { getConfiguredSpeechTokenApiUrl } from './azureSpeechToken';

type DeepgramSpeechTokenAvailable = {
  status: 'available';
  token: string;
  expiresInSeconds: number;
};

type DeepgramSpeechTokenUnavailable = {
  status: 'disabled' | 'unavailable';
  error: string;
};

export type DeepgramSpeechTokenResult = DeepgramSpeechTokenAvailable | DeepgramSpeechTokenUnavailable;

export const fetchDeepgramSpeechToken = async ({
  apiUrl = getConfiguredSpeechTokenApiUrl(),
  timeoutMs = 5000,
}: {
  apiUrl?: string | null;
  timeoutMs?: number;
} = {}): Promise<DeepgramSpeechTokenResult> => {
  if (!apiUrl) {
    return { status: 'disabled', error: 'Speech token API URL is not configured' };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${apiUrl}/api/speech/deepgram-token`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({})) as {
      ok?: boolean;
      token?: string;
      expiresInSeconds?: number;
      error?: string;
    };

    if (!response.ok || payload.ok === false || !payload.token) {
      return {
        status: 'unavailable',
        error: payload.error || `Deepgram token request failed with ${response.status}`,
      };
    }

    return {
      status: 'available',
      token: payload.token,
      expiresInSeconds: typeof payload.expiresInSeconds === 'number' ? payload.expiresInSeconds : 30,
    };
  } catch (error) {
    return {
      status: 'unavailable',
      error: error instanceof Error ? error.message : 'Deepgram token request failed',
    };
  } finally {
    window.clearTimeout(timeout);
  }
};
