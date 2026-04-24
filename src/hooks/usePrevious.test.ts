import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePrevious } from './usePrevious';

describe('usePrevious', () => {
  it('returns undefined on first render', () => {
    const { result } = renderHook(() => usePrevious(42));
    expect(result.current).toBeUndefined();
  });

  it('returns previous value after update', () => {
    let value = 1;
    const { result, rerender } = renderHook(() => usePrevious(value));
    expect(result.current).toBeUndefined();

    value = 2;
    rerender();
    expect(result.current).toBe(1);

    value = 3;
    rerender();
    expect(result.current).toBe(2);
  });
});
