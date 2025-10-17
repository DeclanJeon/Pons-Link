// 📁 src/hooks/whiteboard/useWhiteboardCollaboration.ts (v3.0 - 실제 전송 구현)

import { useCallback } from 'react';
import { throttle } from 'lodash';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { DrawOperation, Point } from '@/types/whiteboard.types';

const CURSOR_BROADCAST_INTERVAL = 50;

export const useWhiteboardCollaboration = () => {
  const { sendToAllPeers } = usePeerConnectionStore.getState();
  const { userId, nickname } = useSessionStore.getState();

  const broadcastOperation = useCallback((operation: DrawOperation) => {
    if (!userId) {
      console.warn('[Collaboration] No userId, skipping broadcast');
      return;
    }

    const message = {
      type: 'whiteboard-operation',
      payload: operation,
    };
    
    const result = sendToAllPeers(JSON.stringify(message));
    console.log(`[Collaboration] Broadcasted operation ${operation.id}:`, result);
  }, [sendToAllPeers, userId]);

  const broadcastClear = useCallback(() => {
    if (!userId) {
      console.warn('[Collaboration] No userId, skipping broadcast');
      return;
    }
    
    const message = {
      type: 'whiteboard-clear',
      payload: { userId },
    };
    
    const result = sendToAllPeers(JSON.stringify(message));
    console.log('[Collaboration] Broadcasted clear:', result);
  }, [sendToAllPeers, userId]);

  const broadcastCursorPosition = useCallback(
    throttle((point: Point) => {
      if (!userId) return;

      const message = {
        type: 'whiteboard-cursor',
        payload: {
          userId,
          nickname,
          point,
        },
      };
      sendToAllPeers(JSON.stringify(message));
    }, CURSOR_BROADCAST_INTERVAL),
    [sendToAllPeers, userId, nickname]
  );

  return {
    broadcastOperation,
    broadcastClear,
    broadcastCursorPosition,
  };
};
