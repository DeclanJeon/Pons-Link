import { describe, expect, it } from 'vitest';
import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { blendReframePosition, mapFaceLandmarksToReframePosition } from './cameraReframe';

describe('camera reframe helpers', () => {
  it('maps face landmarks into a bounded object-position target', () => {
    const result = {
      faceLandmarks: [[
        { x: 0.2, y: 0.35, z: 0 },
        { x: 0.3, y: 0.45, z: 0 },
        { x: 0.4, y: 0.55, z: 0 },
      ]],
    } as FaceLandmarkerResult;

    expect(mapFaceLandmarksToReframePosition(result)).toEqual({ x: 30, y: 37 });
  });

  it('smooths object-position changes to avoid jitter', () => {
    expect(blendReframePosition({ x: 50, y: 44 }, { x: 70, y: 24 }, 0.5)).toEqual({
      x: 60,
      y: 34,
    });
  });
});
