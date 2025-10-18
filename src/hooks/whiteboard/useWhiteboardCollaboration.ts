/**
 * @fileoverview 화이트보드 협업 기능 훅 (v3.1 - Clear 브로드캐스트 수정)
 * @module hooks/whiteboard/useWhiteboardCollaboration
 */

import { useCallback } from 'react';
import { throttle } from 'lodash';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useWhiteboardStore } from '@/stores/useWhiteboardStore';
import { isValidOperation } from '@/lib/whiteboard/utils';
import type { DrawOperation, RemoteCursor, CanvasBackground } from '@/types/whiteboard.types';

const CURSOR_BROADCAST_INTERVAL = 100;

export const useWhiteboardCollaboration = () => {
  const { sendToAllPeers } = usePeerConnectionStore.getState();
  const { userId, nickname } = useSessionStore.getState();
  const addOperation = useWhiteboardStore(state => state.addOperation);
  const updateOperation = useWhiteboardStore(state => state.updateOperation);
  const clearOperations = useWhiteboardStore(state => state.clearOperations);
  const updateRemoteCursor = useWhiteboardStore(state => state.updateRemoteCursor);
  const setBackground = useWhiteboardStore(state => state.setBackground);
  const currentTool = useWhiteboardStore(state => state.currentTool);

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

    sendToAllPeers(JSON.stringify(message));
    console.log(`[Collaboration] Broadcasted operation ${operation.id}`);
  }, [sendToAllPeers, userId]);

  /**
   * 작업 업데이트 브로드캐스트
   */
  const broadcastUpdate = useCallback((id: string, updates: Partial<DrawOperation>) => {
    if (!userId) return;

    const message = {
      type: 'whiteboard-update',
      payload: { id, updates }
    };

    sendToAllPeers(JSON.stringify(message));
  }, [sendToAllPeers, userId]);

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

    sendToAllPeers(JSON.stringify(message));
    console.log('[Collaboration] 🗑️ Broadcasted CLEAR ALL to all peers');
  }, [sendToAllPeers, userId]);

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

      sendToAllPeers(JSON.stringify(message));
    }, CURSOR_BROADCAST_INTERVAL),
    [sendToAllPeers, userId, nickname, currentTool]
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

    sendToAllPeers(JSON.stringify(message));
  }, [sendToAllPeers, userId]);

  /**
   * 배경 설정 브로드캐스트
   */
  const broadcastBackground = useCallback((background: CanvasBackground) => {
    if (!userId) return;

    const message = {
      type: 'whiteboard-background',
      payload: background
    };

    sendToAllPeers(JSON.stringify(message));
    console.log('[Collaboration] 🎨 Broadcasted background:', background);
  }, [sendToAllPeers, userId]);

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
  }, [addOperation]);

  /**
   * 원격 업데이트 수신 처리
   */
  const handleRemoteUpdate = useCallback((payload: { id: string; updates: Partial<DrawOperation> }) => {
    console.log(`[Collaboration] Received remote update for ${payload.id}`);
    updateOperation(payload.id, payload.updates);
  }, [updateOperation]);

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

  /**
   * 원격 커서 수신 처리
   */
  const handleRemoteCursor = useCallback((cursor: RemoteCursor) => {
    updateRemoteCursor(cursor);
  }, [updateRemoteCursor]);

  /**
   * 원격 삭제 수신 처리
   */
  const handleRemoteDelete = useCallback((payload: { operationIds: string[]; userId: string }) => {
    console.log(`[Collaboration] Received remote delete from ${payload.userId}`);
    payload.operationIds.forEach(id => {
      useWhiteboardStore.getState().removeOperation(id);
    });
  }, []);

  /**
   * 원격 배경 수신 처리
   */
  const handleRemoteBackground = useCallback((background: CanvasBackground) => {
    console.log('[Collaboration] 🎨 Received remote background update:', background);
    setBackground(background);
  }, [setBackground]);

  return {
    broadcastOperation,
    broadcastUpdate,
    broadcastClear,
    broadcastCursorPosition,
    broadcastDelete,
    broadcastBackground,
    handleRemoteOperation,
    handleRemoteUpdate,
    handleRemoteClear,
    handleRemoteCursor,
    handleRemoteDelete,
    handleRemoteBackground
  };
};
