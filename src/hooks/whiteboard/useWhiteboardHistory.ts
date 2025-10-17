// 📁 src/hooks/whiteboard/useWhiteboardHistory.ts (v3.0 - 네트워크 통합)

import { useState, useCallback, useEffect } from 'react';
import { DrawOperation } from '@/types/whiteboard.types';
import { useWhiteboardStore } from '@/stores/useWhiteboardStore';

const redrawOperation = (ctx: CanvasRenderingContext2D, op: DrawOperation) => {
  if (!op.path || op.path.length === 0) return;

  ctx.beginPath();
  ctx.moveTo(op.path[0].x, op.path[0].y);
  
  ctx.strokeStyle = op.options.strokeColor;
  ctx.lineWidth = op.options.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = op.type === 'eraser' ? 'destination-out' : 'source-over';

  for (let i = 1; i < op.path.length; i++) {
    ctx.lineTo(op.path[i].x, op.path[i].y);
  }
  ctx.stroke();
  
  ctx.globalCompositeOperation = 'source-over';
};

export const useWhiteboardHistory = (
  stateManager: ReturnType<typeof import('./useWhiteboardState').useWhiteboardState>
) => {
  const { context, dimensions, isCanvasReady } = stateManager;

  const [operations, setOperations] = useState<DrawOperation[]>([]);
  const [history, setHistory] = useState<DrawOperation[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const redrawCanvas = useCallback((opsToDraw: DrawOperation[]) => {
    if (!context || !dimensions.width || !dimensions.height) return;
    
    context.clearRect(0, 0, context.canvas.width / (window.devicePixelRatio||1), context.canvas.height / (window.devicePixelRatio||1));
    
    opsToDraw.forEach(op => redrawOperation(context, op));
  }, [context, dimensions]);

  const addOperation = useCallback((op: DrawOperation) => {
    if (operations.some(existingOp => existingOp.id === op.id)) {
      console.warn(`[History] Duplicate operation ignored: ${op.id}`);
      return;
    }

    const newOps = [...operations, op];
    setOperations(newOps);

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newOps);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    if (context) {
      redrawOperation(context, op);
    }
  }, [operations, history, historyIndex, context]);

  const clearCanvas = useCallback(() => {
    setOperations([]);

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    if (context) {
      redrawCanvas([]);
    }
  }, [history, historyIndex, context, redrawCanvas]);

  // ✅ 핵심: WhiteboardStore에 핸들러 등록
  useEffect(() => {
    console.log('[History] Registering handlers with WhiteboardStore');
    
    useWhiteboardStore.getState().registerHandlers(
      (remoteOp: DrawOperation) => {
        console.log(`[History] Received remote operation: ${remoteOp.id}`);
        addOperation(remoteOp);
      },
      () => {
        console.log('[History] Received remote clear');
        clearCanvas();
      }
    );

    return () => {
      console.log('[History] Unregistering handlers');
      useWhiteboardStore.getState().clearHandlers();
    };
  }, [addOperation, clearCanvas]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;

    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    const opsToRestore = history[newIndex];
    setOperations(opsToRestore);
    redrawCanvas(opsToRestore);
  }, [history, historyIndex, redrawCanvas]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;

    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    const opsToRestore = history[newIndex];
    setOperations(opsToRestore);
    redrawCanvas(opsToRestore);
  }, [history, historyIndex, redrawCanvas]);

  return {
    operations,
    addOperation,
    undo,
    redo,
    clearCanvas,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
  };
};
