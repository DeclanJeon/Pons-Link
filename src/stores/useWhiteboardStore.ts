// 📁 src/stores/useWhiteboardStore.ts (v3.0 - P2P 통신 완전 통합)

import { create } from 'zustand';
import { DrawOperation } from '@/types/whiteboard.types';

/**
 * Whiteboard 이벤트 수신 핸들러 타입
 */
interface WhiteboardEventHandlers {
  onRemoteOperation: ((op: DrawOperation) => void) | null;
  onRemoteClear: (() => void) | null;
}

interface WhiteboardStoreState {
  // 이벤트 핸들러 (Context에서 등록)
  handlers: WhiteboardEventHandlers;
}

interface WhiteboardStoreActions {
  // Context가 자신의 렌더링 함수를 등록
  registerHandlers: (
    onOperation: (op: DrawOperation) => void,
    onClear: () => void
  ) => void;
  
  // PeerConnectionStore가 수신한 메시지를 전달
  handleRemoteOperation: (op: DrawOperation) => void;
  handleRemoteClear: () => void;
  
  // 핸들러 정리
  clearHandlers: () => void;
}

export const useWhiteboardStore = create<WhiteboardStoreState & WhiteboardStoreActions>((set, get) => ({
  handlers: {
    onRemoteOperation: null,
    onRemoteClear: null,
  },

  registerHandlers: (onOperation, onClear) => {
    console.log('[WhiteboardStore] Handlers registered');
    set({
      handlers: {
        onRemoteOperation: onOperation,
        onRemoteClear: onClear,
      }
    });
  },

  handleRemoteOperation: (op) => {
    const { handlers } = get();
    if (handlers.onRemoteOperation) {
      console.log(`[WhiteboardStore] Forwarding remote operation: ${op.id}`);
      handlers.onRemoteOperation(op);
    } else {
      console.warn('[WhiteboardStore] No handler registered for remote operation');
    }
  },

  handleRemoteClear: () => {
    const { handlers } = get();
    if (handlers.onRemoteClear) {
      console.log('[WhiteboardStore] Forwarding remote clear');
      handlers.onRemoteClear();
    } else {
      console.warn('[WhiteboardStore] No handler registered for remote clear');
    }
  },

  clearHandlers: () => {
    console.log('[WhiteboardStore] Handlers cleared');
    set({
      handlers: {
        onRemoteOperation: null,
        onRemoteClear: null,
      }
    });
  },
}));
