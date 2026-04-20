import { beforeEach, describe, expect, it } from 'vitest';
import { clearSelfUnderstandingStorage, loadCoreInput, loadResult, loadSavedInsights, saveCoreInput, saveResult, saveSavedInsights } from './storage';
import type { SelfUnderstandingCoreInput, SelfUnderstandingResult } from '../types/selfUnderstanding';

describe('self-understanding storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists and restores core input, result, and saved insights', () => {
    const coreInput: SelfUnderstandingCoreInput = {
      birthDate: '1995-08-17',
      birthTimeMode: 'unknown',
      timezoneOrBirthplace: 'Asia/Seoul',
      currentFocus: 'traits',
    };

    const result: SelfUnderstandingResult = {
      generatedAt: '2026-04-20T12:00:00.000Z',
      overview: { id: 'ov', label: '나의 핵심 요약', summary: '요약 문장' },
      strengths: [],
      traits: [],
      relationships: [],
      growth: [],
    };

    const savedInsights = [
      { id: 'ov', category: 'home' as const, summary: '요약 문장', savedAt: '2026-04-20T12:00:00.000Z' },
    ];

    saveCoreInput(coreInput);
    saveResult(result);
    saveSavedInsights(savedInsights);

    expect(loadCoreInput()).toEqual(coreInput);
    expect(loadResult()).toEqual(result);
    expect(loadSavedInsights()).toEqual(savedInsights);

    clearSelfUnderstandingStorage();

    expect(loadCoreInput()).toBeNull();
    expect(loadResult()).toBeNull();
    expect(loadSavedInsights()).toEqual([]);
  });
});
