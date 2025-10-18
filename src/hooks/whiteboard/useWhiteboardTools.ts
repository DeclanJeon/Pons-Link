/**
 * @fileoverview 화이트보드 도구 관리 훅 (v3.2 - 드래그 선택 + 도형 수정)
 * @module hooks/whiteboard/useWhiteboardTools
 */

import { useCallback, useRef } from 'react';
import { nanoid } from 'nanoid';
import type Konva from 'konva';
import { useWhiteboardStore } from '@/stores/useWhiteboardStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useWhiteboardCollaboration } from './useWhiteboardCollaboration';
import { createSmoothStroke, hasPressure, getStrokeOptions } from '@/lib/whiteboard/stroke';
import { stageToReal, simplifyPath, isPointInRect } from '@/lib/whiteboard/utils';
import type { Point, PathOperation, ShapeOperation, TextOperation } from '@/types/whiteboard.types';
import { toast } from 'sonner';

export const useWhiteboardTools = () => {
  const currentTool = useWhiteboardStore(state => state.currentTool);
  const toolOptions = useWhiteboardStore(state => state.toolOptions);
  const viewport = useWhiteboardStore(state => state.viewport);
  const addOperation = useWhiteboardStore(state => state.addOperation);
  const setIsDrawing = useWhiteboardStore(state => state.setIsDrawing);
  const setCurrentOperationId = useWhiteboardStore(state => state.setCurrentOperationId);
  const isPanMode = useWhiteboardStore(state => state.isPanMode);
  const setIsPanMode = useWhiteboardStore(state => state.setIsPanMode);
  const selectedIds = useWhiteboardStore(state => state.selectedIds);
  const selectOperation = useWhiteboardStore(state => state.selectOperation);
  const selectMultiple = useWhiteboardStore(state => state.selectMultiple);
  const deselectAll = useWhiteboardStore(state => state.deselectAll);
  const pushHistory = useWhiteboardStore(state => state.pushHistory);
  const setViewport = useWhiteboardStore(state => state.setViewport);
  const editingTextId = useWhiteboardStore(state => state.editingTextId);
  const setEditingTextId = useWhiteboardStore(state => state.setEditingTextId);
  const updateOperation = useWhiteboardStore(state => state.updateOperation);
  const setSelectionRect = useWhiteboardStore(state => state.setSelectionRect);
  const setTempShape = useWhiteboardStore(state => state.setTempShape);
  const operations = useWhiteboardStore(state => state.operations);

  const { userId } = useSessionStore.getState();
  const { broadcastOperation, broadcastCursorPosition } = useWhiteboardCollaboration();

  const currentPath = useRef<Point[]>([]);
  const startPoint = useRef<Point | null>(null);
  const isPanning = useRef<boolean>(false);
  const lastPanPoint = useRef<Point | null>(null);
  const isSpacePressed = useRef<boolean>(false);
  const selectionStartPoint = useRef<Point | null>(null);

  /**
   * 마우스 다운 핸들러
   */
  const handleStageMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (editingTextId) return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    const realPos = stageToReal(pointerPos, viewport);

    // 팬 모드
    if (isPanMode || isSpacePressed.current) {
      isPanning.current = true;
      lastPanPoint.current = pointerPos;
      stage.container().style.cursor = 'grabbing';
      return;
    }

    // 선택 도구 - 드래그 선택 시작
    if (currentTool === 'select') {
      const clickedOnEmpty = e.target === stage;
      
      if (clickedOnEmpty) {
        deselectAll();
        selectionStartPoint.current = realPos;
        setIsDrawing(true);
      }
      return;
    }

    // 텍스트 도구
    if (currentTool === 'text') {
      const textId = nanoid();
      const textOp: TextOperation = {
        id: textId,
        type: 'text',
        userId: userId || 'local',
        timestamp: Date.now(),
        options: toolOptions,
        position: realPos,
        text: 'Double-click to edit',
        width: 200,
        height: 50
      };

      addOperation(textOp);
      pushHistory();
      
      setTimeout(() => {
        setEditingTextId(textId);
      }, 50);
      
      return;
    }

    // 도형 도구 - 시작점 저장
    if (currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'arrow') {
      setIsDrawing(true);
      startPoint.current = realPos;
      setTempShape({ startPoint: realPos, endPoint: realPos });
      return;
    }

    // 그리기 시작
    setIsDrawing(true);
    currentPath.current = [realPos];
    startPoint.current = realPos;

    console.log(`[Tools] Mouse down at (${realPos.x}, ${realPos.y}), tool: ${currentTool}`);
  }, [
    currentTool,
    viewport,
    isPanMode,
    toolOptions,
    userId,
    addOperation,
    setIsDrawing,
    deselectAll,
    editingTextId,
    setEditingTextId,
    pushHistory,
    setTempShape
  ]);

  /**
   * 마우스 이동 핸들러 (도형 그리기 수정)
   */
  const handleStageMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;

    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    // 좌표 변환 (중요!)
    const realPos = stageToReal(pointerPos, viewport);

    // 원격 커서 브로드캐스트
    broadcastCursorPosition(realPos.x, realPos.y);

    // 팬 모드 드래그
    if (isPanning.current && lastPanPoint.current) {
      const dx = pointerPos.x - lastPanPoint.current.x;
      const dy = pointerPos.y - lastPanPoint.current.y;

      setViewport({
        ...viewport,
        x: viewport.x + dx / viewport.scale,
        y: viewport.y + dy / viewport.scale
      });

      lastPanPoint.current = pointerPos;
      return;
    }

    if (!useWhiteboardStore.getState().isDrawing) return;

    // 선택 도구 - 드래그 선택 영역 업데이트
    if (currentTool === 'select' && selectionStartPoint.current) {
      const startX = Math.min(selectionStartPoint.current.x, realPos.x);
      const startY = Math.min(selectionStartPoint.current.y, realPos.y);
      const width = Math.abs(realPos.x - selectionStartPoint.current.x);
      const height = Math.abs(realPos.y - selectionStartPoint.current.y);

      setSelectionRect({ x: startX, y: startY, width, height });
      return;
    }

    // 도형 도구 - 임시 도형 업데이트 (실시간)
    if ((currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'arrow') && startPoint.current) {
      setTempShape({ startPoint: startPoint.current, endPoint: realPos });
      
      // 레이어 강제 재렌더링
      const layer = useWhiteboardStore.getState().operations;
      if (layer) {
        // Konva 레이어 업데이트 트리거
        const stage = e.target.getStage();
        stage?.batchDraw();
      }
      
      return;
    }

    // 경로 기반 도구
    if (currentTool === 'pen' || currentTool === 'eraser' || currentTool === 'laser') {
      currentPath.current.push(realPos);
    }
  }, [currentTool, viewport, setViewport, broadcastCursorPosition, setSelectionRect, setTempShape]);


  /**
   * 마우스 업 핸들러
   */
  const handleStageMouseUp = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // 팬 종료
    if (isPanning.current) {
      isPanning.current = false;
      lastPanPoint.current = null;
      const stage = e.target.getStage();
      if (stage) {
        stage.container().style.cursor = isPanMode ? 'grab' : 'crosshair';
      }
      return;
    }

    if (!useWhiteboardStore.getState().isDrawing) return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    const realPos = stageToReal(pointerPos, viewport);

    setIsDrawing(false);

    // 선택 도구 - 드래그 선택 완료
    if (currentTool === 'select' && selectionStartPoint.current) {
      const selectionRect = useWhiteboardStore.getState().selectionRect;
      
      if (selectionRect) {
        // 선택 영역 내의 모든 작업 찾기
        const selectedOps: string[] = [];
        
        operations.forEach((op, id) => {
          let isInside = false;

          if (op.type === 'path' || op.type === 'eraser') {
            isInside = op.path.some(p => 
              isPointInRect(p, selectionRect)
            );
          } else if (op.type === 'rectangle' || op.type === 'circle' || op.type === 'arrow') {
            isInside = isPointInRect(op.startPoint, selectionRect) || 
                       isPointInRect(op.endPoint, selectionRect);
          } else if (op.type === 'text') {
            isInside = isPointInRect(op.position, selectionRect);
          }

          if (isInside) {
            selectedOps.push(id);
          }
        });

        selectMultiple(selectedOps);
      }

      setSelectionRect(null);
      selectionStartPoint.current = null;
      return;
    }

    // 도형 도구 - 도형 생성
    if ((currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'arrow') && startPoint.current) {
      const operation: ShapeOperation = {
        id: nanoid(),
        type: currentTool,
        userId: userId || 'local',
        timestamp: Date.now(),
        options: toolOptions,
        startPoint: startPoint.current,
        endPoint: realPos
      };

      addOperation(operation);
      pushHistory();
      broadcastOperation(operation);
      setTempShape(null);

      console.log(`[Tools] Created ${currentTool} shape`);
      
      startPoint.current = null;
      return;
    }

    // 경로 기반 도구
    if (currentTool === 'pen' || currentTool === 'eraser') {
      if (currentPath.current.length < 2) {
        currentPath.current = [];
        return;
      }

      const simplifiedPath = simplifyPath(currentPath.current, 2);
      const hasPressureData = hasPressure(simplifiedPath);
      const strokeOptions = getStrokeOptions(toolOptions.strokeWidth, hasPressureData);
      const smoothedPath = createSmoothStroke(simplifiedPath, strokeOptions);

      const operation: PathOperation = {
        id: nanoid(),
        type: currentTool === 'pen' ? 'path' : 'eraser',
        userId: userId || 'local',
        timestamp: Date.now(),
        options: toolOptions,
        path: simplifiedPath,
        smoothedPath
      };

      addOperation(operation);
      pushHistory();
      broadcastOperation(operation);

      console.log(`[Tools] Created ${currentTool} operation with ${simplifiedPath.length} points`);
    }

    currentPath.current = [];
    startPoint.current = null;
  }, [
    currentTool,
    viewport,
    toolOptions,
    userId,
    addOperation,
    setIsDrawing,
    isPanMode,
    pushHistory,
    broadcastOperation,
    setSelectionRect,
    setTempShape,
    selectMultiple,
    operations
  ]);

  /**
   * 터치 이벤트 핸들러
   */
  const handleStageTouchStart = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    handleStageMouseDown(e as any);
  }, [handleStageMouseDown]);

  const handleStageTouchMove = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    handleStageMouseMove(e as any);
  }, [handleStageMouseMove]);

  const handleStageTouchEnd = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    handleStageMouseUp(e as any);
  }, [handleStageMouseUp]);

  /**
   * 휠 이벤트 핸들러
   */
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    const stage = e.target.getStage();
    if (!stage) return;

    const oldScale = viewport.scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x / oldScale) + viewport.x,
      y: (pointer.y / oldScale) + viewport.y
    };

    const scaleBy = 1.05;
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    const clampedScale = Math.max(0.1, Math.min(5, newScale));

    const newViewport = {
      ...viewport,
      scale: clampedScale,
      x: mousePointTo.x - (pointer.x / clampedScale),
      y: mousePointTo.y - (pointer.y / clampedScale)
    };

    setViewport(newViewport);
  }, [viewport, setViewport]);

  /**
   * 키보드 다운 핸들러
   */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space' && !isSpacePressed.current) {
      e.preventDefault();
      isSpacePressed.current = true;
      setIsPanMode(true);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault();
      useWhiteboardStore.getState().copySelected();
      toast.success('Copied to clipboard');
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
      e.preventDefault();
      useWhiteboardStore.getState().cutSelected();
      toast.success('Cut to clipboard');
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      e.preventDefault();
      useWhiteboardStore.getState().paste();
      toast.success('Pasted from clipboard');
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (!editingTextId) {
        e.preventDefault();
        useWhiteboardStore.getState().deleteSelected();
        return;
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      useWhiteboardStore.getState().undo();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
      e.preventDefault();
      useWhiteboardStore.getState().redo();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      const allIds = Array.from(useWhiteboardStore.getState().operations.keys());
      selectMultiple(allIds);
      return;
    }
  }, [editingTextId, selectMultiple, setIsPanMode]);

  /**
   * 키보드 업 핸들러
   */
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space') {
      isSpacePressed.current = false;
      setIsPanMode(false);
    }
  }, [setIsPanMode]);

  return {
    handleStageMouseDown,
    handleStageMouseMove,
    handleStageMouseUp,
    handleStageTouchStart,
    handleStageTouchMove,
    handleStageTouchEnd,
    handleWheel,
    handleKeyDown,
    handleKeyUp
  };
};