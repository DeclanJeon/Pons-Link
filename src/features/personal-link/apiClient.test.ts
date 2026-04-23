import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from './apiClient';

describe('createApiClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns undefined for 204 responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    const client = createApiClient('http://localhost:3001/');

    await expect(client.post<void>('/api/ping', { ok: true })).resolves.toBeUndefined();
  });

  it('returns undefined for successful empty-body responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const client = createApiClient('http://localhost:3001/');

    await expect(client.get<void>('/api/empty')).resolves.toBeUndefined();
  });
});
