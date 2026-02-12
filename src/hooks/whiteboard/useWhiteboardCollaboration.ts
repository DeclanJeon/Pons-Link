  /**
   * @fileoverview 화이트보드 협업 기능 훅 (v3.1 - viewport 자동 브로드캐스트)
   * @module hooks/whiteboard/useWhiteboardCollaboration
   */

import { useCallback, useRef } from 'react';
import { throttle } from 'lodash';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useWhiteboardStore } from '@/stores/useWhiteboardStore';
import { isValidOperation } from '@/lib/whiteboard/utils';
import type { DrawOperation, RemoteCursor, CanvasBackground, Viewport } from '@/types/whiteboard.types';
import { toast } from 'sonner';

  const CURSOR_BROADCAST_INTERVAL = 100;

  export const useWhiteboardCollaboration = () => {
    const { userId, nickname } = useSessionStore.getState();
    const addOperation = useWhiteboardStore(state => state.addOperation);
    const updateOperation = useWhiteboardStore(state => state.updateOperation);
    const removeOperation = useWhiteboardStore(state => state.removeOperation);
    const pushHistory = useWhiteboardStore(state => state.pushHistory);
    const clearOperations = useWhiteboardStore(state => state.clearOperations);
    const updateRemoteCursor = useWhiteboardStore(state => state.updateRemoteCursor);
    const setBackground = useWhiteboardStore(state => state.setBackground);
    const undo = useWhiteboardStore(state => state.undo);
    const redo = useWhiteboardStore(state => state.redo);
    const setOperations = useWhiteboardStore(state => state.setOperations);
    const currentTool = useWhiteboardStore(state => state.currentTool);
    const viewport = useWhiteboardStore(state => state.viewport);
  const setRemoteViewport = useWhiteboardStore(state => state.setRemoteViewport);
  const isFollowMeEnabled = useWhiteboardStore(state => state.isFollowMeEnabled);

  const dragUpdateCache = useRef<Map<string, { x: number; y: number } | { position: { x: number; y: number } }>>(new Map());
  const viewportCache = useRef<{ x: number; y: number; scale: number } | null>(null);

  /**
   * 작업 브로드캐스트
   */
  const broadcastOperation = useCallback((operation: DrawOperation) => {
    if (!userId) {
      console.warn('[Collaboration] No userId, skipping broadcast');
      return;
    }

    if (!isValidOperation(operation)) {
      console.error('[Collaboration] Invalid operation, skipping broadcast');
      return;
    }

    const message = {
      type: 'whiteboard-operation',
      payload: operation
    };

    usePeerConnectionStore.getState().sendToAllPeers(JSON.stringify(message));
    console.log(`[Collaboration] Broadcasted operation ${operation.id}`);
  }, [userId]);

  /**
   * 작업 업데이트 브로드캐스트
   */
  const broadcastUpdate = useCallback((id: string, updates: Partial<DrawOperation>) => {
    if (!userId) return;

    const message = {
      type: 'whiteboard-update',
      payload: { id, updates }
    };

    usePeerConnectionStore.getState().sendToAllPeers(JSON.stringify(message));
  }, [userId]);

  /**
   * ✅ 캔버스 초기화 브로드캐스트 (모든 참가자의 캔버스 삭제)
   */
  const broadcastClear = useCallback(() => {
    if (!userId) {
      console.warn('[Collaboration] No userId, skipping broadcast');
      return;
    }

    const message = {
      type: 'whiteboard-clear',
      payload: {
        userId,
        timestamp: Date.now(),
        clearAll: true // ✅ 전체 삭제 플래그
      }
    };

    usePeerConnectionStore.getState().sendToAllPeers(JSON.stringify(message));
    console.log('[Collaboration] 🗑️ Broadcasted CLEAR ALL to all peers');
  }, [userId]);

  /**
   * 커서 위치 브로드캐스트
   */
  const broadcastCursorPosition = useCallback(
    throttle((x: number, y: number) => {
      if (!userId || !nickname) return;

      const cursor: RemoteCursor = {
        userId,
        nickname,
        position: { x, y },
        color: '#3b82f6',
        timestamp: Date.now(),
        tool: currentTool
      };

      const message = {
        type: 'whiteboard-cursor',
        payload: cursor
      };

      usePeerConnectionStore.getState().sendToAllPeers(JSON.stringify(message));
    }, CURSOR_BROADCAST_INTERVAL),
    [userId, nickname, currentTool]
  );

  /**
   * 선택된 작업 삭제 브로드캐스트
   */
  const broadcastDelete = useCallback((operationIds: string[]) => {
    if (!userId) return;

    const message = {
      type: 'whiteboard-delete',
      payload: { operationIds, userId }
    };

    usePeerConnectionStore.getState().sendToAllPeers(JSON.stringify(message));
  }, [userId]);

  /**
   * 배경 설정 브로드캐스트
   */
  const broadcastBackground = useCallback((background: CanvasBackground) => {
    if (!userId) return;

    const message = {
      type: 'whiteboard-background',
      payload: background
    };

    usePeerConnectionStore.getState().sendToAllPeers(JSON.stringify(message));
    console.log('[Collaboration] 🎨 Broadcasted background:', background);
  }, [userId]);

  const broadcastUndo = useCallback(() => {
    if (!userId) return;

    undo();

    const state = useWhiteboardStore.getState();
    const currentOps = Array.from(state.operations.entries());
    const syncMessage = {
      type: 'whiteboard-sync',
      payload: { 
        operations: currentOps,
        historyIndex: state.historyIndex
      }
    };
    
    usePeerConnectionStore.getState().sendToAllPeers(JSON.stringify(syncMessage));
    console.log('[Collaboration] ↩️ Broadcasted UNDO (Sync)');
  }, [userId, undo]);

  const broadcastRedo = useCallback(() => {
    if (!userId) return;

    redo();

    const state = useWhiteboardStore.getState();
    const currentOps = Array.from(state.operations.entries());
    const syncMessage = {
      type: 'whiteboard-sync',
      payload: { 
        operations: currentOps,
        historyIndex: state.historyIndex
      }
    };
    
    usePeerConnectionStore.getState().sendToAllPeers(JSON.stringify(syncMessage));
    console.log('[Collaboration] ↪️ Broadcasted REDO (Sync)');
  }, [userId, redo]);

  const broadcastWhiteboardOpen = useCallback(() => {
    if (!userId || !nickname) {
      console.warn('[Collaboration] No userId or nickname, skipping broadcast');
      return;
    }

    const message = {
      type: 'whiteboard-open',
      payload: {
        userId,
        nickname,
        timestamp: Date.now()
      }
    };

    usePeerConnectionStore.getState().sendToAllPeers(JSON.stringify(message));
    console.log(`[Collaboration] 📋 Broadcasted whiteboard open by ${nickname}`);
  }, [userId, nickname]);

  const broadcastDragUpdate = useCallback((operationId: string, updates: { x: number; y: number } | { position: { x: number; y: number } }) => {
    if (!userId) return;

    const cached = dragUpdateCache.current.get(operationId);

    if (cached) {
      const isSamePosition =
        'x' in updates && 'x' in cached && cached.x === updates.x &&
        'y' in updates && 'y' in cached && cached.y === updates.y;

      if ('position' in updates && 'position' in cached) {
        const isSamePosition2 =
          updates.position.x === cached.position.x &&
          updates.position.y === cached.position.y;
        if (isSamePosition2) return;
      }

      if (isSamePosition) return;
    }

    dragUpdateCache.current.set(operationId, updates);

    const message = {
      type: 'whiteboard-drag-update',
      payload: {
        userId,
        operationId,
        updates,
        timestamp: Date.now()
      }
    };

    usePeerConnectionStore.getState().sendToAllPeers(JSON.stringify(message));
  }, [userId]);

  /**
   * 원격 작업 수신 처리
   */
  const handleRemoteOperation = useCallback((operation: DrawOperation) => {
    if (!isValidOperation(operation)) {
      console.error('[Collaboration] Invalid remote operation:', operation);
      return;
    }

    console.log(`[Collaboration] Received remote operation: ${operation.id}`);
    addOperation(operation);
    pushHistory();
  }, [addOperation, pushHistory]);

  const handleRemoteUpdate = useCallback((payload: { id: string; updates: Partial<DrawOperation> }) => {
    console.log(`[Collaboration] Received remote update for ${payload.id}`);
    updateOperation(payload.id, payload.updates);
    pushHistory();
  }, [updateOperation, pushHistory]);

  /**
   * ✅ 원격 초기화 수신 처리 (수정됨)
   */
  const handleRemoteClear = useCallback((payload: { userId: string; timestamp: number; clearAll?: boolean }) => {
    console.log(`[Collaboration] 🗑️ Received remote clear from ${payload.userId}`);
    
    if (payload.clearAll) {
      // 전체 삭제
      clearOperations();
      console.log('[Collaboration] ✅ Cleared ALL operations (remote)');
    } else {
      // 특정 사용자 작업만 삭제 (향후 확장 가능)
      const operations = useWhiteboardStore.getState().operations;
      const toDelete = Array.from(operations.values())
        .filter(op => op.userId === payload.userId)
        .map(op => op.id);
      
      toDelete.forEach(id => {
        useWhiteboardStore.getState().removeOperation(id);
      });
      
      console.log(`[Collaboration] ✅ Cleared ${toDelete.length} operations from ${payload.userId}`);
    }
  }, [clearOperations]);

  const handleRemoteUndo = useCallback((payload: { userId: string; timestamp: number }) => {
    console.log(`[Collaboration] ↩️ Received remote undo from ${payload.userId}`);
    undo();
  }, [undo]);

  const handleRemoteRedo = useCallback((payload: { userId: string; timestamp: number }) => {
    console.log(`[Collaboration] ↪️ Received remote redo from ${payload.userId}`);
    redo();
  }, [redo]);

  /**
   * 원격 커서 수신 처리
   */
  const handleRemoteCursor = useCallback((cursor: RemoteCursor) => {
    updateRemoteCursor(cursor);
  }, [updateRemoteCursor]);

  /**
   * 뷰포트 브로드캐스트 (캐시 비교 포함)
   */
  const broadcastViewport = useCallback((viewport: Viewport) => {
    if (!userId || !nickname) return;

    const cached = viewportCache.current;

    if (cached) {
      const isSamePosition =
        Math.abs(cached.x - viewport.x) < 1 &&
        Math.abs(cached.y - viewport.y) < 1 &&
        Math.abs(cached.scale - viewport.scale) < 0.01;

      if (isSamePosition) return;
    }

    viewportCache.current = viewport;

    const isFollowMe = useWhiteboardStore.getState().isFollowMeEnabled;
    const followedUserId = useWhiteboardStore.getState().followedUserId;

    if (isFollowMe && !followedUserId) {
      console.log('[Collaboration] 🖥️ Skipping viewport broadcast - Follow Me enabled but no user to follow');
      return;
    }

    const message = {
      type: 'whiteboard-viewport',
      payload: {
        userId,
        nickname,
        viewport,
        timestamp: Date.now()
      }
    };

    usePeerConnectionStore.getState().sendToAllPeers(JSON.stringify(message));
    console.log(`[Collaboration] 🖥️ Broadcasted viewport by ${nickname}:`, viewport);
  }, [userId, nickname]);

  const broadcastFollowStart = useCallback(() => {
    if (!userId || !nickname) return;

    const message = {
      type: 'whiteboard-follow-start',
      payload: { userId, nickname }
    };

    usePeerConnectionStore.getState().sendToAllPeers(JSON.stringify(message));
    console.log(`[Collaboration] 📢 Broadcasted follow start by ${nickname}`);
  }, [userId, nickname]);

  const handleRemoteFollowStart = useCallback((payload: { userId: string; nickname: string }) => {
    console.log(`[Collaboration] 📢 Received follow start from ${payload.nickname}`);

    toast.info(`${payload.nickname}님이 당신을 따르고 있습니다.`);
  }, []);

  const handleRemoteFollowStop = useCallback((payload: { userId: string }) => {
    console.log(`[Collaboration] 🛑 Received follow stop from ${payload.userId}`);
  }, []);

  const handleRemoteFollowViewport = useCallback((payload: { userId: string; nickname: string; viewport: Viewport }) => {
    console.log(`[Collaboration] 🖥️ Received follow viewport from ${payload.nickname}:`, payload.viewport);

    setRemoteViewport(payload.viewport, { userId: payload.userId, nickname: payload.nickname });
  }, [setRemoteViewport]);

  return {
    broadcastOperation,
    broadcastUpdate,
    broadcastClear,
    broadcastUndo,
    broadcastRedo,
    broadcastCursorPosition,
    broadcastDelete,
    broadcastBackground,
    broadcastWhiteboardOpen,
    broadcastDragUpdate,
    broadcastViewport,
    handleRemoteOperation,
    handleRemoteUpdate,
    handleRemoteClear,
    handleRemoteUndo,
    handleRemoteRedo,
    handleRemoteCursor,
    broadcastFollowStart,
    handleRemoteFollowStart,
    handleRemoteFollowViewport,
    handleRemoteFollowStop
  };
};
