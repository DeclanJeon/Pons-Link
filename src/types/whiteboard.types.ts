// 📁 src/types/whiteboard.types.ts

/**
 * @fileoverview 화이트보드 기능의 모든 핵심 타입을 정의하는 유전자 지도입니다.
 * @module types/whiteboard
 * @description 이 파일은 화이트보드 시스템의 데이터 구조와 인터페이스를 정의하여,
 *              프로젝트 전체의 타입 안정성과 일관성을 보장합니다.
 *              - Point: 모든 좌표의 기본 단위
 *              - Tool: 사용 가능한 도구의 종류 (확장 가능)
 *              - DrawOperation: 실행 취소/다시 실행 및 동기화의 기본 단위 (Command Pattern)
 */

/**
 * 2D 좌표를 나타내는 기본 인터페이스.
 * @property {number} x - x축 좌표.
 * @property {number} y - y축 좌표.
 * @property {number} [pressure] - 터치 압력 (0-1), 스타일러스 펜 지원을 위함.
 */
export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

/**
 * 사용 가능한 도구의 종류를 정의하는 타입.
 * 새로운 도구를 추가할 때 여기에 타입을 추가해야 합니다.
 */
export type Tool = 'pen' | 'eraser' | 'select'; // 초기 단계에서는 3가지만 정의

/**
 * 모든 도구에 적용될 수 있는 공통 옵션.
 */
export interface ToolOptions {
  strokeWidth: number;
  strokeColor: string;
  // 추후 확장: opacity, lineDash 등
}

/**
 * 사용자의 단일 그리기 행위를 나타내는 객체 (Command Pattern).
 * 이 객체는 히스토리 스택에 저장되며, 네트워크를 통해 전송됩니다.
 * @property {string} id - 각 작업을 식별하는 고유 ID (nanoid 사용).
 * @property {Tool} type - 작업을 생성한 도구의 종류.
 * @property {Point[]} path - 펜/지우개 도구의 경우, 그려진 경로의 좌표 배열.
 * @property {ToolOptions} options - 작업이 실행될 때의 도구 옵션.
 * @property {string} userId - 작업을 실행한 사용자의 ID.
 * @property {number} timestamp - 작업 완료 시점의 타임스탬프.
 */
export interface DrawOperation {
  id: string;
  type: Tool;
  path: Point[];
  options: ToolOptions;
  userId: string;
  timestamp: number;
}

/**
 * WhiteboardContext가 제공하는 값의 전체 인터페이스.
 * 모든 화이트보드 하위 컴포넌트와 훅은 이 타입을 통해 상호작용합니다.
 */
export interface WhiteboardContextValue {
  // 캔버스 참조 및 상태
 canvasRef: React.RefObject<HTMLCanvasElement> | null;
  isCanvasReady: boolean;

  // 도구 상태 및 제어
  currentTool: Tool;
  setTool: (tool: Tool) => void;
  toolOptions: ToolOptions;
  setToolOptions: (options: Partial<ToolOptions>) => void;

  // 그리기 액션
 handlePointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  handlePointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;

  // 히스토리 제어
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearCanvas: () => void;

  // 협업 기능 (Phase 3)
  sendLocalOperation?: (operation: DrawOperation) => void;
  sendLocalClear?: () => void;
}
