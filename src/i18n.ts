import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';

export const UI_LANGUAGES = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
] as const;

export type UiLanguage = (typeof UI_LANGUAGES)[number]['code'];

const FALLBACK_LANGUAGE: UiLanguage = 'en';
const LANGUAGE_STORAGE_KEY = 'ponslink.uiLanguage';
const supportedLanguageCodes = new Set<string>(UI_LANGUAGES.map((language) => language.code));

export const resolveUiLanguage = (language?: string | null): UiLanguage => {
  if (!language) return FALLBACK_LANGUAGE;

  const normalized = language.trim().toLowerCase();
  if (supportedLanguageCodes.has(normalized)) return normalized as UiLanguage;

  const primaryLanguage = normalized.split('-')[0];
  if (supportedLanguageCodes.has(primaryLanguage)) return primaryLanguage as UiLanguage;

  return FALLBACK_LANGUAGE;
};

const readInitialLanguage = (): UiLanguage => {
  if (typeof window === 'undefined') return FALLBACK_LANGUAGE;

  try {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (storedLanguage) return resolveUiLanguage(storedLanguage);
  } catch {
    // localStorage can be unavailable in privacy-restricted browser contexts.
  }

  const browserLanguages = [
    ...(Array.isArray(window.navigator.languages) ? window.navigator.languages : []),
    window.navigator.language,
  ];

  for (const language of browserLanguages) {
    const resolvedLanguage = resolveUiLanguage(language);
    if (resolvedLanguage !== FALLBACK_LANGUAGE || language?.toLowerCase().startsWith(FALLBACK_LANGUAGE)) {
      return resolvedLanguage;
    }
  }

  return FALLBACK_LANGUAGE;
};

const syncLanguageSideEffects = (language: string) => {
  if (typeof window === 'undefined') return;

  const resolvedLanguage = resolveUiLanguage(language);
  window.document.documentElement.lang = resolvedLanguage;

  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, resolvedLanguage);
  } catch {
    // Ignore storage failures; language switching should still work in memory.
  }
};

i18n.on('languageChanged', syncLanguageSideEffects);

if (!i18n.isInitialized) {
  void i18n
    .use(HttpBackend)
    .use(initReactI18next)
    .init({
      lng: readInitialLanguage(),
      fallbackLng: FALLBACK_LANGUAGE,
      supportedLngs: UI_LANGUAGES.map((language) => language.code),
      load: 'languageOnly',
      ns: ['translation'],
      defaultNS: 'translation',
      backend: {
        loadPath: '/locales/{{lng}}/{{ns}}.json',
      },
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });
}

export default i18n;

// Expose for debugging / language switching in browser console
if (typeof window !== 'undefined') {
  syncLanguageSideEffects(i18n.resolvedLanguage || i18n.language || readInitialLanguage());
  (window as Window & { __i18n?: typeof i18n }).__i18n = i18n;
}
