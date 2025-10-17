// 📁 src/hooks/whiteboard/useWhiteboardTools.ts (v3.0 - 브로드캐스트 통합)

import { useState, useCallback, useRef } from 'react';
import { nanoid } from 'nanoid';
import { Tool, ToolOptions, Point, DrawOperation } from '@/types/whiteboard.types';
import { useSessionStore } from '@/stores/useSessionStore';
import { useWhiteboardCollaboration } from './useWhiteboardCollaboration';

const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
  const canvas = e.currentTarget;
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    pressure: e.pressure,
  };
};

export const useWhiteboardTools = (
  stateManager: ReturnType<typeof import('./useWhiteboardState').useWhiteboardState>,
  historyManager: ReturnType<typeof import('./useWhiteboardHistory').useWhiteboardHistory>
) => {
  const { context, isCanvasReady } = stateManager;
  const { addOperation } = historyManager;
  const { broadcastOperation } = useWhiteboardCollaboration(); // ✅ 추가

  const [currentTool, setTool] = useState<Tool>('pen');
  const [toolOptions, setToolOptions] = useState<ToolOptions>({
    strokeWidth: 5,
    strokeColor: '#3b82f6',
  });

  const isDrawing = useRef(false);
  const currentPath = useRef<Point[]>([]);
  const { userId } = useSessionStore.getState();

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isCanvasReady || !context || e.button !== 0) return;

    isDrawing.current = true;
    const point = getCanvasPoint(e);
    currentPath.current = [point];

    context.beginPath();
    context.moveTo(point.x, point.y);
    context.strokeStyle = toolOptions.strokeColor;
    context.lineWidth = toolOptions.strokeWidth;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    
    context.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';
  }, [isCanvasReady, context, currentTool, toolOptions]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !isCanvasReady || !context) return;

    const point = getCanvasPoint(e);
    currentPath.current.push(point);

    context.lineTo(point.x, point.y);
    context.stroke();
  }, [isCanvasReady, context]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !isCanvasReady) return;
    isDrawing.current = false;

    if (currentPath.current.length < 2) return;

    const newOperation: DrawOperation = {
      id: nanoid(),
      type: currentTool,
      path: [...currentPath.current],
      options: { ...toolOptions },
      userId: userId || 'local-user',
      timestamp: Date.now(),
    };

    // ✅ 로컬에 추가
    addOperation(newOperation);
    
    // ✅ 네트워크로 브로드캐스트
    broadcastOperation(newOperation);

    currentPath.current = [];
    if(context) context.globalCompositeOperation = 'source-over';
  }, [isCanvasReady, context, currentTool, toolOptions, userId, addOperation, broadcastOperation]);

  return {
    currentTool,
    setTool,
    toolOptions,
    setToolOptions,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
};