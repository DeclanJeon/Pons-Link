import { describe, expect, it, vi } from 'vitest';
import { buildAzureSpeechConfig, fetchAzureSpeechToken } from './azureSpeechService.mjs';

describe('azureSpeechService', () => {
  it('builds server-side Azure Speech config without exposing the key', () => {
    const config = buildAzureSpeechConfig({
      AZURE_SPEECH_KEY: 'secret-key',
      AZURE_SPEECH_REGION: 'eastus',
      AZURE_SPEECH_ENDPOINT: 'https://eastus.api.cognitive.microsoft.com/',
    });

    expect(config).toEqual({
      configured: true,
      region: 'eastus',
      endpoint: 'https://eastus.api.cognitive.microsoft.com',
      tokenUrl: 'https://eastus.api.cognitive.microsoft.com/sts/v1.0/issueToken',
    });
  });

  it('returns unavailable config when key is missing', () => {
    const config = buildAzureSpeechConfig({
      AZURE_SPEECH_REGION: 'eastus',
      AZURE_SPEECH_ENDPOINT: 'https://eastus.api.cognitive.microsoft.com/',
    });

    expect(config).toMatchObject({ configured: false, region: 'eastus' });
  });

  it('exchanges the server-side key for a short-lived token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('token-123', { status: 200 }));

    const result = await fetchAzureSpeechToken({
      env: {
        AZURE_SPEECH_KEY: 'secret-key',
        AZURE_SPEECH_REGION: 'eastus',
        AZURE_SPEECH_ENDPOINT: 'https://eastus.api.cognitive.microsoft.com/',
      },
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://eastus.api.cognitive.microsoft.com/sts/v1.0/issueToken',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Ocp-Apim-Subscription-Key': 'secret-key',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': '0',
        }),
      }),
    );
    expect(result).toEqual({
      ok: true,
      token: 'token-123',
      region: 'eastus',
      endpoint: 'https://eastus.api.cognitive.microsoft.com',
      expiresInSeconds: 600,
    });
  });
});
