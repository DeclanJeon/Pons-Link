/**
 * @fileoverview 화이트보드 상태 관리 스토어 (v3.3 - 펜 도구 실시간 피드백 추가)
 * @module stores/useWhiteboardStore
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import type {
  DrawOperation,
  Tool,
  ToolOptions,
  Viewport,
  RemoteCursor,
  SelectionBox,
  CanvasBackground,
  ClipboardData,
  Point
} from '@/types/whiteboard.types';

interface WhiteboardState {
  // 작업 관리
  operations: Map<string, DrawOperation>;
  history: string[][];
  historyIndex: number;

  // 도구
  currentTool: Tool;
  toolOptions: ToolOptions;

  // 뷰포트
  viewport: Viewport;

  // 배경 설정
  background: CanvasBackground;

  // 선택
  selectedIds: Set<string>;
  selectionBox: SelectionBox | null;
  selectionRect: { x: number; y: number; width: number; height: number } | null;

  // 클립보드
  clipboard: ClipboardData | null;

  // 원격 커서
  remoteCursors: Map<string, RemoteCursor>;

  // 임시 상태
  isDrawing: boolean;
  currentOperationId: string | null;
  isPanMode: boolean;
  editingTextId: string | null;

  // 도형 그리기 임시 상태
  tempShape: { startPoint: Point; endPoint: Point } | null;
  
  // ✅ 펜 도구 실시간 경로 (추가)
  tempPath: Point[] | null;
}

interface WhiteboardActions {
  // 작업 관리
  addOperation: (operation: DrawOperation) => void;
  removeOperation: (id: string) => void;
  updateOperation: (id: string, updates: Partial<DrawOperation>) => void;
  clearOperations: () => void;

  // 히스토리
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  pushHistory: () => void;

  // 도구
  setTool: (tool: Tool) => void;
  setToolOptions: (options: Partial<ToolOptions>) => void;

  // 뷰포트
  setViewport: (viewport: Viewport) => void;
  resetViewport: () => void;

  // 배경 설정
  setBackground: (background: Partial<CanvasBackground>) => void;

  // 선택
  selectOperation: (id: string, multi?: boolean) => void;
  selectMultiple: (ids: string[]) => void;
  deselectAll: () => void;
  deleteSelected: () => void;
  setSelectionBox: (box: SelectionBox | null) => void;
  setSelectionRect: (rect: { x: number; y: number; width: number; height: number } | null) => void;

  // 클립보드
  copySelected: () => void;
  cutSelected: () => void;
  paste: () => void;

  // 원격 커서
  updateRemoteCursor: (cursor: RemoteCursor) => void;
  removeRemoteCursor: (userId: string) => void;
  cleanupOldCursors: () => void;

  // 임시 상태
  setIsDrawing: (isDrawing: boolean) => void;
  setCurrentOperationId: (id: string | null) => void;
  setIsPanMode: (isPan: boolean) => void;
  setEditingTextId: (id: string | null) => void;
  setTempShape: (shape: { startPoint: Point; endPoint: Point } | null) => void;
  
  // ✅ 펜 도구 임시 경로 (추가)
  setTempPath: (path: Point[] | null) => void;

  // 유틸리티
  getOperation: (id: string) => DrawOperation | undefined;
  getSelectedOperations: () => DrawOperation[];
}

const DEFAULT_VIEWPORT: Viewport = {
  x: 0,
  y: 0,
  scale: 1,
  width: 1920,
  height: 1080
};

const DEFAULT_TOOL_OPTIONS: ToolOptions = {
  strokeWidth: 5,
  strokeColor: '#3b82f6',
  fillColor: 'transparent',
  opacity: 1,
  fontSize: 16,
  fontFamily: 'Arial',
  textAlign: 'left'
};

const DEFAULT_BACKGROUND: CanvasBackground = {
  color: '#ffffff',
  gridType: 'none',
  gridSize: 20,
  gridColor: '#e5e7eb'
};

export const useWhiteboardStore = create<WhiteboardState & WhiteboardActions>()(
  devtools(
    immer((set, get) => ({
      // 초기 상태
      operations: new Map(),
      history: [[]],
      historyIndex: 0,
      currentTool: 'pen',
      toolOptions: DEFAULT_TOOL_OPTIONS,
      viewport: DEFAULT_VIEWPORT,
      background: DEFAULT_BACKGROUND,
      selectedIds: new Set(),
      selectionBox: null,
      selectionRect: null,
      clipboard: null,
      remoteCursors: new Map(),
      isDrawing: false,
      currentOperationId: null,
      isPanMode: false,
      editingTextId: null,
      tempShape: null,
      tempPath: null, // ✅ 초기화

      // 작업 관리
      addOperation: (operation) => set((state) => {
        if (state.operations.has(operation.id)) {
          console.warn(`[WhiteboardStore] Duplicate operation: ${operation.id}`);
          return;
        }

        state.operations.set(operation.id, operation);
        console.log(`[WhiteboardStore] Operation added: ${operation.id}, Total: ${state.operations.size}`);
      }),

      removeOperation: (id) => set((state) => {
        if (state.operations.delete(id)) {
          state.selectedIds.delete(id);
          console.log(`[WhiteboardStore] Operation removed: ${id}`);
        }
      }),

      updateOperation: (id, updates) => set((state) => {
        const operation = state.operations.get(id);
        if (operation) {
          const updatedOperation = { ...operation, ...updates } as DrawOperation;
          state.operations.set(id, updatedOperation);
        }
      }),

      clearOperations: () => set((state) => {
        state.operations.clear();
        state.history = [[]];
        state.historyIndex = 0;
        state.selectedIds.clear();
        console.log('[WhiteboardStore] All operations cleared');
      }),

      // 히스토리
      pushHistory: () => set((state) => {
        state.history = state.history.slice(0, state.historyIndex + 1);
        const currentOperationIds = Array.from(state.operations.keys());
        state.history.push(currentOperationIds);
        state.historyIndex = state.history.length - 1;
      }),

      undo: () => set((state) => {
        if (state.historyIndex > 0) {
          state.historyIndex--;
          const operationIds = state.history[state.historyIndex];
          
          const newOperations = new Map<string, DrawOperation>();
          operationIds.forEach(id => {
            const op = state.operations.get(id);
            if (op) newOperations.set(id, op);
          });
          
          state.operations = newOperations;
          state.selectedIds.clear();
          
          console.log(`[WhiteboardStore] Undo to index ${state.historyIndex}`);
        }
      }),

      redo: () => set((state) => {
        if (state.historyIndex < state.history.length - 1) {
          state.historyIndex++;
          const operationIds = state.history[state.historyIndex];
          
          const newOperations = new Map<string, DrawOperation>();
          operationIds.forEach(id => {
            const op = state.operations.get(id);
            if (op) newOperations.set(id, op);
          });
          
          state.operations = newOperations;
          state.selectedIds.clear();
          
          console.log(`[WhiteboardStore] Redo to index ${state.historyIndex}`);
        }
      }),

      canUndo: () => get().historyIndex > 0,
      canRedo: () => get().historyIndex < get().history.length - 1,

      // 도구
      setTool: (tool) => set((state) => {
        state.currentTool = tool;
        if (tool !== 'select') {
          state.selectedIds.clear();
        }
        console.log(`[WhiteboardStore] Tool changed to: ${tool}`);
      }),

      setToolOptions: (options) => set((state) => {
        state.toolOptions = { ...state.toolOptions, ...options };
      }),

      // 뷰포트
      setViewport: (viewport) => set((state) => {
        state.viewport = viewport;
      }),

      resetViewport: () => set((state) => {
        state.viewport = DEFAULT_VIEWPORT;
        console.log('[WhiteboardStore] Viewport reset');
      }),

      // 배경 설정
      setBackground: (background) => set((state) => {
        state.background = { ...state.background, ...background };
        console.log('[WhiteboardStore] Background updated:', state.background);
      }),

      // 선택
      selectOperation: (id, multi = false) => set((state) => {
        if (!multi) {
          state.selectedIds.clear();
        }
        state.selectedIds.add(id);
        console.log(`[WhiteboardStore] Selected: ${id}`);
      }),

      selectMultiple: (ids) => set((state) => {
        state.selectedIds.clear();
        ids.forEach(id => state.selectedIds.add(id));
        console.log(`[WhiteboardStore] Selected ${ids.length} operations`);
      }),

      deselectAll: () => set((state) => {
        state.selectedIds.clear();
        state.selectionBox = null;
      }),

      deleteSelected: () => set((state) => {
        state.selectedIds.forEach(id => {
          state.operations.delete(id);
        });
        
        console.log(`[WhiteboardStore] Deleted ${state.selectedIds.size} operations`);
        state.selectedIds.clear();
        
        get().pushHistory();
      }),

      setSelectionBox: (box) => set((state) => {
        state.selectionBox = box;
      }),

      setSelectionRect: (rect) => set((state) => {
        state.selectionRect = rect;
      }),

      // 클립보드
      copySelected: () => set((state) => {
        const operations = get().getSelectedOperations();
        if (operations.length > 0) {
          state.clipboard = {
            operations: operations.map(op => ({ ...op })),
            timestamp: Date.now()
          };
          console.log(`[WhiteboardStore] Copied ${operations.length} operations`);
        }
      }),

      cutSelected: () => set((state) => {
        get().copySelected();
        get().deleteSelected();
      }),

      paste: () => set((state) => {
        if (!state.clipboard) return;

        const { operations: clipboardOps } = state.clipboard;
        const offset = 20;

        clipboardOps.forEach(op => {
          const newOp = {
            ...op,
            id: `${op.id}-copy-${Date.now()}`,
            timestamp: Date.now()
          };

          if ('position' in newOp) {
            newOp.position = {
              x: newOp.position.x + offset,
              y: newOp.position.y + offset
            };
          }
          if ('startPoint' in newOp) {
            newOp.startPoint = {
              x: newOp.startPoint.x + offset,
              y: newOp.startPoint.y + offset
            };
            newOp.endPoint = {
              x: newOp.endPoint.x + offset,
              y: newOp.endPoint.y + offset
            };
          }
          if ('path' in newOp) {
            newOp.path = newOp.path.map(p => ({
              x: p.x + offset,
              y: p.y + offset,
              pressure: p.pressure
            }));
          }

          state.operations.set(newOp.id, newOp);
        });

        get().pushHistory();
        console.log(`[WhiteboardStore] Pasted ${clipboardOps.length} operations`);
      }),

      // 원격 커서
      updateRemoteCursor: (cursor) => set((state) => {
        state.remoteCursors.set(cursor.userId, cursor);
      }),

      removeRemoteCursor: (userId) => set((state) => {
        state.remoteCursors.delete(userId);
      }),

      cleanupOldCursors: () => set((state) => {
        const now = Date.now();
        const timeout = 5000;

        state.remoteCursors.forEach((cursor, userId) => {
          if (now - cursor.timestamp > timeout) {
            state.remoteCursors.delete(userId);
          }
        });
      }),

      // 임시 상태
      setIsDrawing: (isDrawing) => set((state) => {
        state.isDrawing = isDrawing;
      }),

      setCurrentOperationId: (id) => set((state) => {
        state.currentOperationId = id;
      }),

      setIsPanMode: (isPan) => set((state) => {
        state.isPanMode = isPan;
      }),

      setEditingTextId: (id) => set((state) => {
        state.editingTextId = id;
      }),

      setTempShape: (shape) => set((state) => {
        state.tempShape = shape;
      }),

      // ✅ 펜 도구 임시 경로 설정
      setTempPath: (path) => set((state) => {
        state.tempPath = path;
      }),

      // 유틸리티
      getOperation: (id) => {
        return get().operations.get(id);
      },

      getSelectedOperations: () => {
        const { operations, selectedIds } = get();
        return Array.from(selectedIds)
          .map(id => operations.get(id))
          .filter((op): op is DrawOperation => op !== undefined);
      }
    })),
    { name: 'WhiteboardStore' }
  )
);