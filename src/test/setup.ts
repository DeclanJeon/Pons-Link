import '@testing-library/jest-dom/vitest';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const readTranslation = (language: string) => {
  const translationPath = resolve(process.cwd(), `public/locales/${language}/translation.json`);
  return JSON.parse(readFileSync(translationPath, 'utf-8'));
};

const en = readTranslation('en');
const ko = readTranslation('ko');
const ja = readTranslation('ja');

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: {
      en: { translation: en },
      ko: { translation: ko },
      ja: { translation: ja },
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

const memoryStorage = (() => {
  let store = new Map<string, string>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store = new Map<string, string>();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: memoryStorage,
  configurable: true,
});

Object.defineProperty(globalThis, 'localStorage', {
  value: memoryStorage,
  configurable: true,
});
