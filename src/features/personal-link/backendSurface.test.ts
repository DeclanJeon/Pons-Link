import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getConfiguredEmailApiUrl,
  getConfiguredPersonalLinkApiUrl,
  resolveBackendApiUrl,
  supportsSessionAuthAtApiUrl,
} from './backendSurface';

describe('backend API URL selection', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults Pons-Link backend calls to the local Pons_Backend during development', () => {
    vi.stubEnv('VITE_PERSONAL_LINK_API_URL', '');
    vi.stubEnv('VITE_API_URL', '');

    expect(getConfiguredPersonalLinkApiUrl()).toBe('http://localhost:6650');
    expect(getConfiguredEmailApiUrl()).toBe('http://localhost:6650');
  });

  it('keeps production switching explicit through environment variables', () => {
    vi.stubEnv('VITE_PERSONAL_LINK_API_URL', 'https://ponslink.online/');
    vi.stubEnv('VITE_API_URL', 'http://localhost:6650');

    expect(getConfiguredPersonalLinkApiUrl()).toBe('https://ponslink.online');
    expect(getConfiguredEmailApiUrl()).toBe('http://localhost:6650');
  });

  it('normalizes trailing slashes', () => {
    expect(resolveBackendApiUrl('http://localhost:6650/')).toBe('http://localhost:6650');
  });

  it('detects the Pons_Backend auth surface through health before probing protected auth routes', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(supportsSessionAuthAtApiUrl('http://localhost:6650')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:6650/api/health', {
      method: 'GET',
      cache: 'no-store',
    });
  });

  it('falls back to the protected auth route only when health is unavailable', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }));

    await expect(supportsSessionAuthAtApiUrl('http://localhost:6650')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith('http://localhost:6650/api/auth/me', {
      method: 'GET',
      cache: 'no-store',
    });
  });
});
