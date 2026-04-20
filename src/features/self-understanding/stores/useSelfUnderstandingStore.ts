import { create } from 'zustand';
import { generateSelfUnderstandingResult } from '../lib/mockInterpreter';
import { clearSelfUnderstandingStorage, loadCoreInput, loadResult, loadSavedInsights, saveCoreInput, saveResult, saveSavedInsights } from '../lib/storage';
import { DEFAULT_CORE_INPUT, type SavedInsight, type SelfUnderstandingCoreInput, type SelfUnderstandingResult } from '../types/selfUnderstanding';

interface SelfUnderstandingState {
  coreInput: SelfUnderstandingCoreInput;
  result: SelfUnderstandingResult | null;
  savedInsights: SavedInsight[];
  hydrated: boolean;
  hydrateFromStorage: () => void;
  updateCoreInput: (patch: Partial<SelfUnderstandingCoreInput>) => void;
  generateResult: () => SelfUnderstandingResult;
  saveInsight: (insight: Omit<SavedInsight, 'savedAt'>) => void;
  resetAll: () => void;
}

export const useSelfUnderstandingStore = create<SelfUnderstandingState>((set, get) => ({
  coreInput: DEFAULT_CORE_INPUT,
  result: null,
  savedInsights: [],
  hydrated: false,
  hydrateFromStorage: () => {
    const storedInput = loadCoreInput();
    const storedResult = loadResult();
    const storedSavedInsights = loadSavedInsights();

    set({
      coreInput: storedInput ?? DEFAULT_CORE_INPUT,
      result: storedResult,
      savedInsights: storedSavedInsights,
      hydrated: true,
    });
  },
  updateCoreInput: (patch) => {
    const nextInput = { ...get().coreInput, ...patch };
    saveCoreInput(nextInput);
    set({ coreInput: nextInput });
  },
  generateResult: () => {
    const result = generateSelfUnderstandingResult(get().coreInput);
    saveResult(result);
    set({ result });
    return result;
  },
  saveInsight: (insight) => {
    const nextInsights = [
      { ...insight, savedAt: new Date().toISOString() },
      ...get().savedInsights.filter((item) => item.id !== insight.id),
    ].slice(0, 20);

    saveSavedInsights(nextInsights);
    set({ savedInsights: nextInsights });
  },
  resetAll: () => {
    clearSelfUnderstandingStorage();
    set({
      coreInput: DEFAULT_CORE_INPUT,
      result: null,
      savedInsights: [],
      hydrated: true,
    });
  },
}));
