/**
 * @fileoverview 화이트보드 타입 정의 (v3.1 - background Context 제거)
 * @module types/whiteboard
 */

import type Konva from "konva";

/**
 * 2D 좌표 및 압력 정보
 */
export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

/**
 * 사용 가능한 도구 종류
 */
export type Tool =
  | "pen"
  | "eraser"
  | "select"
  | "rectangle"
  | "circle"
  | "arrow"
  | "text"
  | "laser"
  | "pan"; // 추가: 팬 도구

/**
 * 도구 옵션
 */
export interface ToolOptions {
  strokeWidth: number;
  strokeColor: string;
  fillColor?: string;
  opacity?: number;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: "left" | "center" | "right";
}

/**
 * 캔버스 배경 설정
 */
export interface CanvasBackground {
  color: string;
  gridType: "none" | "dots" | "lines";
  gridSize: number;
  gridColor: string;
}

/**
 * 그리기 작업 타입
 */
export type DrawOperationType =
  | "path"
  | "rectangle"
  | "circle"
  | "arrow"
  | "text"
  | "eraser"
  | "laser"
  | "image";

/**
 * 그리기 작업 기본 인터페이스
 */
export interface BaseDrawOperation {
  id: string;
  type: DrawOperationType;
  userId: string;
  timestamp: number;
  options: ToolOptions;
  isSelected?: boolean;
  x?: number; // Konva 호환
  y?: number; // Konva 호환
  rotation?: number; // 회전 각도
  scaleX?: number; // X축 스케일
  scaleY?: number; // Y축 스케일
}

/**
 * 경로 기반 작업 (펜, 지우개)
 */
export interface PathOperation extends BaseDrawOperation {
  type: "path" | "eraser";
  path: Point[];
  smoothedPath?: number[];
}

/**
 * 도형 작업
 */
export interface ShapeOperation extends BaseDrawOperation {
  type: "rectangle" | "circle" | "arrow";
  startPoint: Point;
  endPoint: Point;
  width?: number;
  height?: number;
  radius?: number;
}

/**
 * 텍스트 작업
 */
export interface TextOperation extends BaseDrawOperation {
  type: "text";
  position: Point;
  text: string;
  width?: number;
  height?: number;
  isEditing?: boolean; // 편집 모드 여부
}

/**
 * 레이저 포인터 작업
 */
export interface LaserOperation extends BaseDrawOperation {
  type: "laser";
  path: Point[];
  expiresAt: number; // 자동 삭제 시간
}

export interface ImageOperation extends BaseDrawOperation {
  type: "image";
  position: Point;
  src: string;
  width: number;
  height: number;
}

export type DrawOperation =
  | PathOperation
  | ShapeOperation
  | TextOperation
  | LaserOperation
  | ImageOperation;

/**
 * 뷰포트 정보
 */
export interface Viewport {
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
}

/**
 * 원격 커서 정보
 */
export interface RemoteCursor {
  userId: string;
  nickname: string;
  position: Point;
  color: string;
  timestamp: number;
  tool?: Tool; // 현재 사용 중인 도구
}

/**
 * 선택 영역
 */
export interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  operationIds: string[];
}

/**
 * 클립보드 데이터
 */
export interface ClipboardData {
  operations: DrawOperation[];
  timestamp: number;
}

/**
 * 화이트보드 Context 값
 */
export interface WhiteboardContextValue {
  // Stage 참조
  stageRef: React.RefObject<Konva.Stage>;
  containerRef: React.RefObject<HTMLDivElement>; // 추가
  layerRef: React.RefObject<Konva.Layer>;
  transformerRef: React.RefObject<Konva.Transformer>;
  isReady: boolean;

  // 뷰포트
  viewport: Viewport;
  setViewport: (viewport: Viewport) => void;
  resetViewport: () => void;

  // 배경 설정
  setBackground: (background: Partial<CanvasBackground>) => void;

  // 도구
  currentTool: Tool;
  setTool: (tool: Tool) => void;
  toolOptions: ToolOptions;
  setToolOptions: (options: Partial<ToolOptions>) => void;

  // 작업 관리
  operations: Map<string, DrawOperation>;
  addOperation: (operation: DrawOperation) => void;
  removeOperation: (id: string) => void;
  updateOperation: (id: string, updates: Partial<DrawOperation>) => void;

  // 히스토리

  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearCanvas: () => void;

  // 선택
  selectedIds: Set<string>;
  selectOperation: (id: string, multi?: boolean) => void;
  deselectAll: () => void;
  deleteSelected: () => void;
  copySelected: () => void;
  cutSelected: () => void;
  paste: () => void;
  pasteImage: (imageSrc: string, callback?: (imageId: string) => void) => void;

  // 원격 커서
  remoteCursors: Map<string, RemoteCursor>;

  // 팬 모드
  isPanMode: boolean;
  setIsPanMode: (isPan: boolean) => void;

  // 이벤트 핸들러
  handleStageMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  handleStageMouseMove: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  handleStageMouseUp: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  handleStageTouchStart: (e: Konva.KonvaEventObject<TouchEvent>) => void;
  handleStageTouchMove: (e: Konva.KonvaEventObject<TouchEvent>) => void;
  handleStageTouchEnd: (e: Konva.KonvaEventObject<TouchEvent>) => void;
  handleWheel: (e: Konva.KonvaEventObject<WheelEvent>) => void;
  handleKeyDown: (e: KeyboardEvent) => void;
  handleKeyUp: (e: KeyboardEvent) => void;

  // 텍스트 편집
  startTextEdit: (id: string) => void;
  endTextEdit: () => void;
  editingTextId: string | null;
}

/**
 * 네트워크 메시지 타입
 */
export type WhiteboardMessage =
  | { type: "whiteboard-operation"; payload: DrawOperation }
  | {
      type: "whiteboard-update";
      payload: { id: string; updates: Partial<DrawOperation> };
    }
  | { type: "whiteboard-clear"; payload: { userId: string; timestamp: number } }
  | { type: "whiteboard-cursor"; payload: RemoteCursor }
  | {
      type: "whiteboard-delete";
      payload: { operationIds: string[]; userId: string };
    }
  | { type: "whiteboard-background"; payload: CanvasBackground }
  | {
      type: "whiteboard-follow-start";
      payload: { userId: string; nickname: string };
    }
  | {
      type: "whiteboard-follow-viewport";
      payload: { userId: string; nickname: string; viewport: Viewport };
    }
  | { type: "whiteboard-follow-stop"; payload: { userId: string } };
