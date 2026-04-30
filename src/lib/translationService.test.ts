import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslationService } from './translationService';

describe('TranslationService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('preserves meaningful Chinese regional language codes while normalizing STT locales', () => {
    const service = new TranslationService();

    expect(service.normalizeLanguageCode('ko-KR')).toBe('ko');
    expect(service.normalizeLanguageCode('en-US')).toBe('en');
    expect(service.normalizeLanguageCode('zh-TW')).toBe('zh-TW');
    expect(service.normalizeLanguageCode('zh-Hant')).toBe('zh-TW');
    expect(service.normalizeLanguageCode('zh-CN')).toBe('zh-CN');
  });

  it('calls the Pons server Azure Translation route instead of MyMemory or browser-side keys', async () => {
    let requestedUrl = '';
    let requestedInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = String(input);
      requestedInit = init;

      return new Response(JSON.stringify({
        ok: true,
        text: 'hello',
        engine: 'azure',
      }), { status: 200, statusText: 'OK' });
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new TranslationService({ apiUrl: 'https://api.pons.test' });
    const result = await service.translate('안녕하세요', 'ko-KR', 'en');

    expect(result).toEqual({ text: 'hello', engine: 'azure' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedUrl).toBe('https://api.pons.test/api/translation/translate');
    expect(requestedUrl).not.toContain('mymemory');
    expect(requestedInit).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ text: '안녕하세요', sourceLang: 'ko', targetLang: 'en' }),
    });
    expect(JSON.stringify(requestedInit)).not.toContain('AZURE');
    expect(JSON.stringify(requestedInit)).not.toContain('secret');
  });

  it('falls back to the same-origin translation route when the configured API lacks the route', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === 'https://api.pons.test/api/translation/translate') {
        return new Response(JSON.stringify({ ok: false, error: 'Not found' }), { status: 404 });
      }

      return new Response(JSON.stringify({
        ok: true,
        text: 'hello',
        engine: 'azure',
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new TranslationService({ apiUrl: 'https://api.pons.test' });
    const result = await service.translate('안녕하세요', 'ko-KR', 'en');

    expect(result).toEqual({ text: 'hello', engine: 'azure' });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.pons.test/api/translation/translate',
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/translation/translate',
      expect.any(Object),
    );
  });

  it('uses the shared Pons_Backend API URL by default', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:6650/');

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, text: 'hello', engine: 'azure' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const service = new TranslationService();
    const result = await service.translate('안녕하세요', 'ko', 'en');

    expect(result).toEqual({ text: 'hello', engine: 'azure' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:6650/api/translation/translate',
      expect.any(Object),
    );
  });

  it('accepts server-side fallback translation engines', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, text: 'hello', engine: 'mymemory' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const service = new TranslationService({ apiUrl: 'https://api.pons.test' });
    const result = await service.translate('안녕하세요', 'ko-KR', 'en');

    expect(result).toEqual({ text: 'hello', engine: 'mymemory' });
  });

  it('returns original text when source language is not concrete', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const service = new TranslationService({ apiUrl: 'https://api.pons.test' });
    const result = await service.translate('hello', 'auto', 'ko');

    expect(result).toEqual({ text: 'hello', engine: 'none' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
