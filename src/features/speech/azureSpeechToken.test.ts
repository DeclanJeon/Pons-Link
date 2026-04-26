import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAzureSpeechToken, getConfiguredSpeechTokenApiUrl, resolveSpeechTokenApiUrl } from './azureSpeechToken';

describe('azureSpeechToken', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('normalizes configured token api urls', () => {
    expect(resolveSpeechTokenApiUrl('http://localhost:6650/')).toBe('http://localhost:6650');
    expect(resolveSpeechTokenApiUrl('   ')).toBeNull();
    expect(resolveSpeechTokenApiUrl(undefined)).toBeNull();
  });

  it('prefers explicit speech token api url over shared api url', () => {
    vi.stubEnv('VITE_SPEECH_TOKEN_API_URL', 'http://localhost:3010/');
    vi.stubEnv('VITE_API_URL', 'http://localhost:6650');

    expect(getConfiguredSpeechTokenApiUrl()).toBe('http://localhost:3010');
  });

  it('fetches a token without needing the Azure resource key in the browser', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        ok: true,
        token: 'issued-token',
        region: 'eastus',
        endpoint: 'https://eastus.api.cognitive.microsoft.com',
        expiresInSeconds: 600,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const result = await fetchAzureSpeechToken({ apiUrl: 'http://localhost:6650' });

    expect(fetchSpy).toHaveBeenCalledWith('http://localhost:6650/api/speech/token', expect.objectContaining({ method: 'GET' }));
    expect(result).toEqual({
      status: 'available',
      token: 'issued-token',
      region: 'eastus',
      endpoint: 'https://eastus.api.cognitive.microsoft.com',
      expiresInSeconds: 600,
    });
  });
});
