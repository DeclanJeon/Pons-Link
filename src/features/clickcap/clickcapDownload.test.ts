import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchClickCapExtensionMetadata,
  getConfiguredClickCapApiUrl,
  triggerClickCapExtensionDownload,
} from './clickcapDownload';

describe('clickcapDownload', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('resolves the backend URL from VITE_API_URL', () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:6650/');

    expect(getConfiguredClickCapApiUrl()).toBe('http://localhost:6650');
  });

  it('fetches ClickCap extension metadata from the backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        extension: {
          id: 'clickcap',
          name: 'ClickCap - Smart Screen Recorder',
          version: '1.0.1',
          downloadUrl: '/api/clickcap-extension/download',
          fileName: 'clickcap-extension-1.0.1.zip',
          installInstructions: ['Download', 'Unzip'],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchClickCapExtensionMetadata({ apiUrl: 'http://localhost:6650', timeoutMs: 100 });

    expect(result.status).toBe('available');
    if (result.status === 'available') {
      expect(result.extension.downloadUrl).toBe('http://localhost:6650/api/clickcap-extension/download');
      expect(result.extension.fileName).toBe('clickcap-extension-1.0.1.zip');
    }
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:6650/api/clickcap-extension', expect.objectContaining({ method: 'GET' }));
  });

  it('returns disabled when no backend API URL is configured', async () => {
    const result = await fetchClickCapExtensionMetadata({ apiUrl: null });

    expect(result).toEqual({ status: 'disabled', error: 'ClickCap extension API URL is not configured' });
  });

  it('triggers a browser download with the backend file URL', () => {
    const anchor = {
      href: '',
      download: '',
      rel: '',
      click: vi.fn(),
      remove: vi.fn(),
    } as unknown as HTMLAnchorElement;
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    const appendChild = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);

    triggerClickCapExtensionDownload({
      downloadUrl: 'http://localhost:6650/api/clickcap-extension/download',
      fileName: 'clickcap-extension-1.0.1.zip',
    });

    expect(createElement).toHaveBeenCalledWith('a');
    expect(anchor.href).toBe('http://localhost:6650/api/clickcap-extension/download');
    expect(anchor.download).toBe('clickcap-extension-1.0.1.zip');
    expect(anchor.rel).toBe('noopener');
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(anchor.remove).toHaveBeenCalledTimes(1);
  });
});
