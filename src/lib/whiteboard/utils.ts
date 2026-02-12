/**
 * @fileoverview 화이트보드 유틸리티 함수 (v3.4 - 좌표 변환 완전 수정)
 * @module lib/whiteboard/utils
 */

import type { Point, Viewport, DrawOperation } from '@/types/whiteboard.types';

/**
 * 두 점 사이의 거리 계산
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 점이 뷰포트 내에 있는지 확인
 */
export function isPointInViewport(point: Point, viewport: Viewport): boolean {
  const viewportLeft = -viewport.x;
  const viewportRight = -viewport.x + viewport.width / viewport.scale;
  const viewportTop = -viewport.y;
  const viewportBottom = -viewport.y + viewport.height / viewport.scale;

  return (
    point.x >= viewportLeft &&
    point.x <= viewportRight &&
    point.y >= viewportTop &&
    point.y <= viewportBottom
  );
}

/**
 * 점이 사각형 안에 있는지 확인
 */
export function isPointInRect(
  point: Point,
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * 작업이 뷰포트와 교차하는지 확인
 */
export function isOperationInViewport(
  operation: DrawOperation,
  viewport: Viewport
): boolean {
  if (operation.type === 'path' || operation.type === 'eraser') {
    return operation.path.some(point => isPointInViewport(point, viewport));
  }

  if (operation.type === 'rectangle' || operation.type === 'circle' || operation.type === 'arrow') {
    return isPointInViewport(operation.startPoint, viewport) || 
           isPointInViewport(operation.endPoint, viewport);
  }

  if (operation.type === 'text') {
    return isPointInViewport(operation.position, viewport);
  }

  if (operation.type === 'image') {
    return isPointInViewport(operation.position, viewport);
  }

  return false;
}

/**
 * 경로 단순화 (Douglas-Peucker 알고리즘)
 */
export function simplifyPath(points: Point[], tolerance: number = 2): Point[] {
  if (points.length <= 2) return points;

  const sqTolerance = tolerance * tolerance;

  function getSqSegDist(p: Point, p1: Point, p2: Point): number {
    let x = p1.x;
    let y = p1.y;
    let dx = p2.x - x;
    let dy = p2.y - y;

    if (dx !== 0 || dy !== 0) {
      const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);

      if (t > 1) {
        x = p2.x;
        y = p2.y;
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }

    dx = p.x - x;
    dy = p.y - y;

    return dx * dx + dy * dy;
  }

  function simplifyDouglasPeucker(points: Point[], sqTolerance: number): Point[] {
    const len = points.length;
    const markers = new Uint8Array(len);
    let first = 0;
    let last = len - 1;
    const stack: number[] = [];
    let newPoints: Point[] = [];
    let i: number;
    let maxSqDist: number;
    let sqDist: number;
    let index: number;

    markers[first] = markers[last] = 1;

    while (last) {
      maxSqDist = 0;

      for (i = first + 1; i < last; i++) {
        sqDist = getSqSegDist(points[i], points[first], points[last]);

        if (sqDist > maxSqDist) {
          index = i;
          maxSqDist = sqDist;
        }
      }

      if (maxSqDist > sqTolerance) {
        markers[index] = 1;
        stack.push(first, index, index, last);
      }

      last = stack.pop()!;
      first = stack.pop()!;
    }

    for (i = 0; i < len; i++) {
      if (markers[i]) {
        newPoints.push(points[i]);
      }
    }

    return newPoints;
  }

  return simplifyDouglasPeucker(points, sqTolerance);
}

/**
 * 좌표 검증
 */
export function isValidPoint(point: Point): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Math.abs(point.x) <= 1000000 &&
    Math.abs(point.y) <= 1000000
  );
}

/**
 * 작업 검증
 */
export function isValidOperation(operation: DrawOperation): boolean {
  if (!operation.id || !operation.userId || !operation.timestamp) {
    return false;
  }

  if (operation.type === 'path' || operation.type === 'eraser') {
    return (
      Array.isArray(operation.path) &&
      operation.path.length > 0 &&
      operation.path.length <= 100000 &&
      operation.path.every(isValidPoint)
    );
  }

  if (operation.type === 'rectangle' || operation.type === 'circle' || operation.type === 'arrow') {
    return (
      isValidPoint(operation.startPoint) &&
      isValidPoint(operation.endPoint)
    );
  }

  if (operation.type === 'text') {
    return (
      isValidPoint(operation.position) &&
      typeof operation.text === 'string' &&
      operation.text.length <= 100000
    );
  }

  if (operation.type === 'image') {
    return (
      isValidPoint(operation.position) &&
      typeof operation.src === 'string' &&
      operation.src.length > 0
    );
  }

  return false;
}

/**
 * 사용자별 고유 색상 생성
 */
export function getUserColor(userId: string): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'
  ];

  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * 바운딩 박스 계산
 */
export function getBoundingBox(operations: DrawOperation[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  if (operations.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  operations.forEach(op => {
    if (op.type === 'path' || op.type === 'eraser') {
      op.path.forEach(point => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
    } else if (op.type === 'rectangle' || op.type === 'circle' || op.type === 'arrow') {
      minX = Math.min(minX, op.startPoint.x, op.endPoint.x);
      minY = Math.min(minY, op.startPoint.y, op.endPoint.y);
      maxX = Math.max(maxX, op.startPoint.x, op.endPoint.x);
      maxY = Math.max(maxY, op.startPoint.y, op.endPoint.y);
    } else if (op.type === 'text') {
      minX = Math.min(minX, op.position.x);
      minY = Math.min(minY, op.position.y);
      maxX = Math.max(maxX, op.position.x + (op.width || 100));
      maxY = Math.max(maxY, op.position.y + (op.height || 50));
    } else if (op.type === 'image') {
      minX = Math.min(minX, op.position.x);
      minY = Math.min(minY, op.position.y);
      maxX = Math.max(maxX, op.position.x + (op.width || 100));
      maxY = Math.max(maxY, op.position.y + (op.height || 50));
    }
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * 스테이지 좌표를 실제 월드 좌표로 변환
 * 
 * @description
 * Konva Stage의 x, y는 캔버스를 이동시키는 offset입니다.
 * - stage.x > 0: 캔버스가 오른쪽으로 이동 (왼쪽 영역이 보임)
 * - stage.x < 0: 캔버스가 왼쪽으로 이동 (오른쪽 영역이 보임)
 * 
 * 화면 좌표 -> 월드 좌표 변환:
 * worldX = (screenX - stage.x) / scale
 * worldY = (screenY - stage.y) / scale
 */
export function stageToReal(
  stagePoint: Point,
  viewport: Viewport
): Point {
  return {
    x: (stagePoint.x - viewport.x * viewport.scale) / viewport.scale,
    y: (stagePoint.y - viewport.y * viewport.scale) / viewport.scale
  };
}

/**
 * 실제 월드 좌표를 스테이지 좌표로 변환
 */
export function realToStage(
  realPoint: Point,
  viewport: Viewport
): Point {
  return {
    x: realPoint.x * viewport.scale + viewport.x * viewport.scale,
    y: realPoint.y * viewport.scale + viewport.y * viewport.scale
  };
}
