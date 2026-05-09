import { describe, expect, it } from 'vitest';
import { VIDEO_DISPLAY_OPTIONS } from './videoDisplayOptions';

describe('VIDEO_DISPLAY_OPTIONS', () => {
  it('exposes center face as an explicit camera framing mode', () => {
    expect(VIDEO_DISPLAY_OPTIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: 'reframe',
          label: 'Center Face',
        }),
      ]),
    );
  });
});
