// frontend/src/lib/translationService.ts

import { resolveSpeechTokenApiUrl } from '@/features/speech/azureSpeechToken';

export interface TranslationResult {
  text: string;
  engine: 'azure' | 'none';
  error?: string;
}

interface TranslationServiceOptions {
  apiUrl?: string | null;
  timeoutMs?: number;
}

interface TranslationApiResponse {
  ok?: boolean;
  text?: string;
  engine?: string;
  error?: string;
}

const NON_CONCRETE_LANGUAGES = new Set(['auto', 'und', 'unknown']);

const isConcreteLanguageCode = (lang: string) => {
  const normalized = lang.trim().toLowerCase();
  return normalized !== '' && !NON_CONCRETE_LANGUAGES.has(normalized);
};

/**
 * STT caption translation service.
 *
 * Azure Translator credentials stay on the server. The browser only calls the
 * Pons API route, which protects long-lived Azure keys and avoids MyMemory's
 * quota/quality limits.
 */
const getConfiguredTranslationApiUrls = (preferredApiUrl?: string | null): string[] => {
  const preferred = resolveSpeechTokenApiUrl(preferredApiUrl ?? undefined);
  const candidates = preferred
    ? [preferred]
    : [resolveSpeechTokenApiUrl(import.meta.env.VITE_API_URL as string | undefined)];

  const urls = [...candidates.filter((url): url is string => Boolean(url)), ''];
  return [...new Set(urls)];
};

export class TranslationService {
  private readonly apiUrls: string[];
  private readonly timeoutMs: number;

  constructor(options: TranslationServiceOptions = {}) {
    this.apiUrls = getConfiguredTranslationApiUrls(options.apiUrl);
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  async translate(
    text: string,
    sourceLang: string,
    targetLang: string,
  ): Promise<TranslationResult> {
    if (!text.trim()) {
      return { text, engine: 'none' };
    }

    const normalizedSource = this.normalizeLanguageCode(sourceLang);
    const normalizedTarget = this.normalizeLanguageCode(targetLang);

    if (!isConcreteLanguageCode(normalizedSource)) {
      return { text, engine: 'none' };
    }

    if (!isConcreteLanguageCode(normalizedTarget) || normalizedTarget === 'none') {
      return { text, engine: 'none' };
    }

    if (normalizedSource === normalizedTarget) {
      return { text, engine: 'none' };
    }

    let lastError = 'Translation API URL is not configured';

    for (const apiUrl of this.apiUrls) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), this.timeoutMs);
      const route = `${apiUrl}/api/translation/translate`;

      try {
        const response = await fetch(route, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            text,
            sourceLang: normalizedSource,
            targetLang: normalizedTarget,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          lastError = `Translation API returned ${response.status}`;
          continue;
        }

        const payload = await response.json() as TranslationApiResponse;
        if (!payload.ok || typeof payload.text !== 'string' || payload.engine !== 'azure') {
          lastError = payload.error ?? 'Translation response is incomplete';
          continue;
        }

        return { text: payload.text, engine: 'azure' };
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Translation unavailable';
      } finally {
        window.clearTimeout(timeout);
      }
    }

    return { text, engine: 'none', error: lastError };
  }

  /**
   * 언어 코드 정규화 (ISO 639-1). 중국어 번체/간체처럼 지역 코드가
   * 의미 있는 언어는 Azure Translator가 구분할 수 있도록 보존한다.
   */
  normalizeLanguageCode(code: string): string {
    const normalized = code.trim().toLowerCase();

    const languageMap: Record<string, string> = {
      'zh-tw': 'zh-TW',
      'zh-hant': 'zh-TW',
      'zh-cn': 'zh-CN',
      'zh-hans': 'zh-CN',
      zh: 'zh-CN',
    };

    if (languageMap[normalized]) return languageMap[normalized];

    return normalized.split('-')[0];
  }
}

export const translationService = new TranslationService();
