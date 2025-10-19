/**
 * @fileoverview 화이트보드 Context (v3.8 - 배경 상태 Context 제거)
 * @module contexts/WhiteboardContext
 */

import React, { createContext, useContext, useMemo, useEffect, useRef } from 'react';
import type Konva from 'konva';
import type { WhiteboardContextValue } from '@/types/whiteboard.types';
import { useWhiteboardState } from '@/hooks/whiteboard/useWhiteboardState';
import { useWhiteboardTools } from '@/hooks/whiteboard/useWhiteboardTools';
import { useWhiteboardCollaboration } from '@/hooks/whiteboard/useWhiteboardCollaboration';
import { useWhiteboardStore } from '@/stores/useWhiteboardStore';

const WhiteboardContext = createContext<WhiteboardContextValue | null>(null);

export const WhiteboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const stateManager = useWhiteboardState();
  const toolsManager = useWhiteboardTools();
  const collaboration = useWhiteboardCollaboration();

  // Zustand 스토어 상태
  const currentTool = useWhiteboardStore(state => state.currentTool);
  const setTool = useWhiteboardStore(state => state.setTool);
  const toolOptions = useWhiteboardStore(state => state.toolOptions);
  const setToolOptions = useWhiteboardStore(state => state.setToolOptions);
  const operations = useWhiteboardStore(state => state.operations);
  const undo = useWhiteboardStore(state => state.undo);
  const redo = useWhiteboardStore(state => state.redo);
  const canUndo = useWhiteboardStore(state => state.canUndo());
  const canRedo = useWhiteboardStore(state => state.canRedo());
  const clearCanvas = useWhiteboardStore(state => state.clearOperations);
  const selectedIds = useWhiteboardStore(state => state.selectedIds);
  const selectOperation = useWhiteboardStore(state => state.selectOperation);
  const deselectAll = useWhiteboardStore(state => state.deselectAll);
  const deleteSelected = useWhiteboardStore(state => state.deleteSelected);
  const copySelected = useWhiteboardStore(state => state.copySelected);
  const cutSelected = useWhiteboardStore(state => state.cutSelected);
  const paste = useWhiteboardStore(state => state.paste);
  const remoteCursors = useWhiteboardStore(state => state.remoteCursors);
  const addOperation = useWhiteboardStore(state => state.addOperation);
  const removeOperation = useWhiteboardStore(state => state.removeOperation);
  const updateOperation = useWhiteboardStore(state => state.updateOperation);
  
  // ✅ background는 Context에서 제거 (컴포넌트에서 직접 구독)
  const setBackground = useWhiteboardStore(state => state.setBackground);
  
  const isPanMode = useWhiteboardStore(state => state.isPanMode);
  const setIsPanMode = useWhiteboardStore(state => state.setIsPanMode);
  const editingTextId = useWhiteboardStore(state => state.editingTextId);
  const setEditingTextId = useWhiteboardStore(state => state.setEditingTextId);

  // Refs
  const layerRef = useRef<Konva.Layer>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const contextValue = useMemo<WhiteboardContextValue>(() => ({
    // Stage 참조
    stageRef: stateManager.stageRef,
    containerRef: stateManager.containerRef,
    layerRef,
    transformerRef,
    isReady: stateManager.isReady,

    // 뷰포트
    viewport: stateManager.viewport,
    setViewport: stateManager.setViewport,
    resetViewport: stateManager.resetViewport,

    setBackground,

    // 도구
    currentTool,
    setTool,
    toolOptions,
    setToolOptions,

    // 작업 관리
    operations,
    addOperation,
    removeOperation,
    updateOperation,

    // 히스토리
    undo,
    redo,
    canUndo,
    canRedo,
    clearCanvas: () => {
      clearCanvas();
      collaboration.broadcastClear();
    },

    // 선택
    selectedIds,
    selectOperation,
    deselectAll,
    deleteSelected: () => {
      const ids = Array.from(selectedIds);
      deleteSelected();
      collaboration.broadcastDelete(ids);
    },
    copySelected,
    cutSelected,
    paste,

    // 원격 커서
    remoteCursors,

    // 팬 모드
    isPanMode,
    setIsPanMode,

    // 이벤트 핸들러
    handleStageMouseDown: toolsManager.handleStageMouseDown,
    handleStageMouseMove: toolsManager.handleStageMouseMove,
    handleStageMouseUp: toolsManager.handleStageMouseUp,
    handleStageTouchStart: toolsManager.handleStageTouchStart,
    handleStageTouchMove: toolsManager.handleStageTouchMove,
    handleStageTouchEnd: toolsManager.handleStageTouchEnd,
    handleWheel: toolsManager.handleWheel,
    handleKeyDown: toolsManager.handleKeyDown,
    handleKeyUp: toolsManager.handleKeyUp,

    // 텍스트 편집
    startTextEdit: (id: string) => {
      setEditingTextId(id);
    },
    endTextEdit: () => {
      setEditingTextId(null);
    },
    editingTextId
  }), [
    stateManager,
    toolsManager,
    collaboration,
    currentTool,
    setTool,
    toolOptions,
    setToolOptions,
    operations,
    addOperation,
    removeOperation,
    updateOperation,
    undo,
    redo,
    canUndo,
    canRedo,
    clearCanvas,
    selectedIds,
    selectOperation,
    deselectAll,
    deleteSelected,
    copySelected,
    cutSelected,
    paste,
    remoteCursors,
    setBackground,
    isPanMode,
    setIsPanMode,
    editingTextId
  ]);

  return (
    <WhiteboardContext.Provider value={contextValue}>
      {children}
    </WhiteboardContext.Provider>
  );
};

export const useWhiteboard = (): WhiteboardContextValue => {
  const context = useContext(WhiteboardContext);

  if (!context) {
    throw new Error(
      'FATAL ERROR: useWhiteboard() must be used within a <WhiteboardProvider>. ' +
      'Ensure your component tree is correctly wrapped.'
    );
  }

  return context;
};