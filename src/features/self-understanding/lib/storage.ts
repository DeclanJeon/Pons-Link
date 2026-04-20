import type { SavedInsight, SelfUnderstandingCoreInput, SelfUnderstandingResult } from '../types/selfUnderstanding';

const CORE_INPUT_KEY = 'pons.self-understanding.core-input';
const RESULT_KEY = 'pons.self-understanding.result';
const SAVED_INSIGHTS_KEY = 'pons.self-understanding.saved-insights';

const isBrowser = () => typeof window !== 'undefined';

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export const storageKeys = {
  CORE_INPUT_KEY,
  RESULT_KEY,
  SAVED_INSIGHTS_KEY,
};

export const loadCoreInput = (): SelfUnderstandingCoreInput | null => readJson<SelfUnderstandingCoreInput | null>(CORE_INPUT_KEY, null);
export const saveCoreInput = (value: SelfUnderstandingCoreInput) => writeJson(CORE_INPUT_KEY, value);

export const loadResult = (): SelfUnderstandingResult | null => readJson<SelfUnderstandingResult | null>(RESULT_KEY, null);
export const saveResult = (value: SelfUnderstandingResult) => writeJson(RESULT_KEY, value);

export const loadSavedInsights = (): SavedInsight[] => readJson<SavedInsight[]>(SAVED_INSIGHTS_KEY, []);
export const saveSavedInsights = (value: SavedInsight[]) => writeJson(SAVED_INSIGHTS_KEY, value);

export const clearSelfUnderstandingStorage = () => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(CORE_INPUT_KEY);
  window.localStorage.removeItem(RESULT_KEY);
  window.localStorage.removeItem(SAVED_INSIGHTS_KEY);
};
