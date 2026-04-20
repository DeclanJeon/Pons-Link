import { beforeEach, describe, expect, it } from 'vitest';
import { useSelfUnderstandingStore } from './useSelfUnderstandingStore';

describe('useSelfUnderstandingStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSelfUnderstandingStore.setState({
      coreInput: {
        birthDate: '',
        birthTimeMode: 'unknown',
        timezoneOrBirthplace: 'Asia/Seoul',
        currentFocus: 'traits',
      },
      result: null,
      savedInsights: [],
      hydrated: true,
    });
  });

  it('generates a result and saves an insight with local-first persistence', () => {
    const store = useSelfUnderstandingStore.getState();

    store.updateCoreInput({
      birthDate: '1995-08-17',
      currentFocus: 'relationships',
    });

    const result = useSelfUnderstandingStore.getState().generateResult();
    expect(result.overview.summary.length).toBeGreaterThan(0);

    useSelfUnderstandingStore.getState().saveInsight({
      id: result.overview.id,
      category: 'home',
      summary: result.overview.summary,
    });

    const nextState = useSelfUnderstandingStore.getState();
    expect(nextState.result?.overview.summary).toEqual(result.overview.summary);
    expect(nextState.savedInsights[0]?.summary).toEqual(result.overview.summary);

    nextState.resetAll();

    const resetState = useSelfUnderstandingStore.getState();
    expect(resetState.result).toBeNull();
    expect(resetState.savedInsights).toEqual([]);
  });
});
