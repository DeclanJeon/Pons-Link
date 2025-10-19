/**
 * @fileoverview Perfect Freehand 통합
 * @module lib/whiteboard/stroke
 */

import getStroke from 'perfect-freehand';
import type { Point } from '@/types/whiteboard.types';

/**
 * Perfect Freehand 옵션
 */
export interface StrokeOptions {
  size?: number;
  thinning?: number;
  smoothing?: number;
  streamline?: number;
  easing?: (t: number) => number;
  start?: {
    taper?: number | boolean;
    easing?: (t: number) => number;
    cap?: boolean;
  };
  end?: {
    taper?: number | boolean;
    easing?: (t: number) => number;
    cap?: boolean;
  };
  simulatePressure?: boolean;
}

/**
 * 기본 스트로크 옵션
 */
export const DEFAULT_STROKE_OPTIONS: StrokeOptions = {
  size: 8,
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
  easing: (t) => t,
  start: {
    taper: 0,
    easing: (t) => t,
    cap: true
  },
  end: {
    taper: 0,
    easing: (t) => t,
    cap: true
  },
  simulatePressure: true
};

/**
 * Point 배열을 Perfect Freehand 입력 형식으로 변환
 */
export function pointsToStrokeInput(points: Point[]): number[][] {
  return points.map(p => [p.x, p.y, p.pressure ?? 0.5]);
}

/**
 * Perfect Freehand 결과를 SVG path로 변환
 */
export function strokeToSvgPath(stroke: number[][]): string {
  if (stroke.length === 0) return '';

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q']
  );

  d.push('Z');
  return d.join(' ');
}

/**
 * Perfect Freehand 결과를 Konva Line points 형식으로 변환
 */
export function strokeToKonvaPoints(stroke: number[][]): number[] {
  return stroke.flatMap(([x, y]) => [x, y]);
}

/**
 * Point 배열로부터 부드러운 스트로크 생성
 */
export function createSmoothStroke(
  points: Point[],
  options: Partial<StrokeOptions> = {}
): number[] {
  if (points.length === 0) return [];

  const input = pointsToStrokeInput(points);
  const mergedOptions = { ...DEFAULT_STROKE_OPTIONS, ...options };
  const stroke = getStroke(input, mergedOptions);

  return strokeToKonvaPoints(stroke);
}

/**
 * 압력 감지 여부 확인
 */
export function hasPressure(points: Point[]): boolean {
  return points.some(p => p.pressure !== undefined && p.pressure !== 0.5);
}

/**
 * 스트로크 옵션 생성 (도구 설정 기반)
 */
export function getStrokeOptions(
  strokeWidth: number,
  hasPressureData: boolean
): StrokeOptions {
  return {
    ...DEFAULT_STROKE_OPTIONS,
    size: strokeWidth,
    simulatePressure: !hasPressureData,
    thinning: hasPressureData ? 0.7 : 0.5
  };
}
