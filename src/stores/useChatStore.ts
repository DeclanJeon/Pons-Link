import { create } from 'zustand';
import { produce } from 'immer';
import type { ChatMessage as TChatMessage, FileMetadata } from '@/types/chat.types';
import { usePeerConnectionStore } from './usePeerConnectionStore';

export type ChatMessage = TChatMessage;

type FileTransferState = {
  isSending: boolean;
  isComplete: boolean;
  isCancelled: boolean;
  isAssembling: boolean;
  progress: number;
  speed: number;
  eta: number;
  averageSpeed: number;
  totalTransferTime: number;
  receivedBytes: number;
  startTime: number;
  blobUrl?: string;
};

type ChatStore = {
  chatMessages: ChatMessage[];
  typingState: Map<string, string>;
  fileTransfers: Map<string, FileTransferState>;
  fileMetas: Map<string, FileMetadata>;
  receiverWorker: Worker | null;
  receivedChunksMap: Map<string, Set<number>>;
  initializedTransfers: Set<string>; // ✅ 추가
  addMessage: (m: ChatMessage) => void;
  setTypingState: (userId: string, nickname: string, isTyping: boolean) => void;
  addFileMessage: (
    senderId: string,
    senderNickname: string,
    meta: FileMetadata,
    isSender: boolean,
    previewUrl?: string
  ) => Promise<void>;
  handleIncomingChunk: (peerId: string, buf: ArrayBuffer) => Promise<void>;
  updateFileTransferState: (transferId: string, patch: Partial<FileTransferState>) => void;
  handleFileCancel: (transferId: string) => void;
  initReceiverWorker: () => void;
  cleanupReceiverWorker: () => void;
  calculateChecksum: (data: ArrayBuffer) => Promise<string>;
};

export const useChatStore = create<ChatStore>((set, get) => {
  let receiverWorker: Worker | null = null;

  const calculateChecksum = async (data: ArrayBuffer): Promise<string> => {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const initReceiverWorker = () => {
    if (receiverWorker) return;

    receiverWorker = new Worker(
      new URL('../workers/file-receiver.worker.ts', import.meta.url),
      { type: 'module' }
    );

    receiverWorker.onmessage = (e: MessageEvent) => {
      const { type, payload } = e.data;

      switch (type) {
        case 'ack': {
          const { transferId, chunkIndex, senderId } = payload;
          
          const peerStore = usePeerConnectionStore.getState();
          const ackMessage = JSON.stringify({
            type: 'file-ack',
            payload: { transferId, chunkIndex }
          });
          
          const success = peerStore.sendToPeer(senderId, ackMessage);
          
          if (!success) {
            console.warn(`[Chat Store] ⚠️ ACK failed for chunk ${chunkIndex}`);
          }
          break;
        }

        case 'progress': {
          set(
            produce((state: ChatStore) => {
              const transfer = state.fileTransfers.get(payload.transferId);
              if (transfer) {
                transfer.progress = payload.progress;
                transfer.speed = payload.speed;
                transfer.eta = payload.eta;
                transfer.receivedBytes = payload.received;
              }
            })
          );
          break;
        }

        case 'assembling': {
          set(
            produce((state: ChatStore) => {
              const transfer = state.fileTransfers.get(payload.transferId);
              if (transfer) {
                transfer.isAssembling = true;
              }
            })
          );
          break;
        }

        case 'complete': {
          set(
            produce((state: ChatStore) => {
              const transfer = state.fileTransfers.get(payload.transferId);
              if (transfer) {
                transfer.isComplete = true;
                transfer.isAssembling = false;
                transfer.blobUrl = payload.url;
                transfer.averageSpeed = payload.averageSpeed;
                transfer.totalTransferTime = payload.totalTime * 1000;
              }
            })
          );
          
          // ✅ 송신자에게 완료 알림 전송
          const meta = get().fileMetas.get(payload.transferId);
          if (meta && meta.senderId) {
            const peerStore = usePeerConnectionStore.getState();
            const completeMessage = JSON.stringify({
              type: 'file-receiver-complete',
              payload: { transferId: payload.transferId }
            });
            
            peerStore.sendToPeer(meta.senderId, completeMessage);
            console.log(`[Chat Store] 📢 Notified sender of completion: ${payload.transferId}`);
          }
          break;
        }

        case 'error': {
          console.error(`[Chat Store] Receiver error: ${payload.message}`);
          set(
            produce((state: ChatStore) => {
              const transfer = state.fileTransfers.get(payload.transferId);
              if (transfer) {
                transfer.isCancelled = true;
                transfer.isAssembling = false;
              }
            })
          );
          break;
        }

        case 'cancelled': {
          set(
            produce((state: ChatStore) => {
              const transfer = state.fileTransfers.get(payload.transferId);
              if (transfer) {
                transfer.isCancelled = true;
                transfer.isAssembling = false;
              }
            })
          );
          break;
        }
      }
    };

    receiverWorker.onerror = (error) => {
      console.error('[Chat Store] Receiver worker error:', error);
    };

    set({ receiverWorker });
  };

  const cleanupReceiverWorker = () => {
    if (receiverWorker) {
      receiverWorker.terminate();
      receiverWorker = null;
      set({ receiverWorker: null });
    }
  };

  initReceiverWorker();

  return {
    chatMessages: [],
    typingState: new Map(),
    fileTransfers: new Map(),
    fileMetas: new Map(),
    receiverWorker,
    receivedChunksMap: new Map(),
    initializedTransfers: new Set(), // ✅ 추가

    addMessage: (m) =>
      set(
        produce((s: ChatStore) => {
          s.chatMessages.push(m);
        })
      ),

    setTypingState: (userId, nickname, isTyping) => {
      set(
        produce((s: ChatStore) => {
          if (isTyping) s.typingState.set(userId, nickname);
          else s.typingState.delete(userId);
        })
      );
    },

    addFileMessage: async (senderId, senderNickname, meta, isSender, previewUrl) => {
      // ✅ produce 안에서 모든 상태 수정
      set(
        produce((s: ChatStore) => {
          const existed = s.fileMetas.has(meta.transferId);
          s.fileMetas.set(meta.transferId, meta);

          if (!s.fileTransfers.has(meta.transferId)) {
            s.fileTransfers.set(meta.transferId, {
              isSending: isSender,
              isComplete: false,
              isCancelled: false,
              isAssembling: false,
              progress: 0,
              speed: 0,
              eta: Infinity,
              averageSpeed: 0,
              totalTransferTime: 0,
              receivedBytes: 0,
              startTime: Date.now(),
              blobUrl: undefined,
            });
          }

          if (!existed) {
            const msg: ChatMessage = {
              id: `${meta.transferId}_${Date.now()}`,
              type: meta.type.startsWith('image/') ? 'image' : 'file',
              senderId,
              senderNickname,
              timestamp: Date.now(),
              fileMeta: meta,
              previewUrl,
            };
            s.chatMessages.push(msg);
          }

          // ✅ 수신자만 초기화 (produce 안에서)
          if (!isSender && !s.initializedTransfers.has(meta.transferId)) {
            s.initializedTransfers.add(meta.transferId);
            s.receivedChunksMap.set(meta.transferId, new Set());
          }
        })
      );

      // ✅ Worker 메시지는 produce 밖에서 (비동기 작업)
      if (!isSender && receiverWorker) {
        const state = get();
        if (state.initializedTransfers.has(meta.transferId)) {
          receiverWorker.postMessage({
            type: 'init-transfer',
            payload: {
              transferId: meta.transferId,
              totalChunks: meta.totalChunks,
              totalSize: meta.size,
              senderId: meta.senderId,
              mimeType: meta.type,
              fileName: meta.name,
              originalChecksum: meta.checksum,
            },
          });
          
          console.log(`[Chat Store] ✅ Receiver initialized for ${meta.transferId}`);
        }
      }
    },

    handleIncomingChunk: async (peerId, buf) => {
      if (!receiverWorker) {
        console.error('[Chat Store] Receiver worker not initialized');
        return;
      }

      // ✅ ArrayBuffer 변환
      let arrayBuffer: ArrayBuffer;

      if (buf instanceof ArrayBuffer) {
        arrayBuffer = buf;
      } else if (ArrayBuffer.isView(buf)) {
        const view = buf as ArrayBufferView;
        const sourceBuffer = view.buffer;
        const byteLength = view.byteLength;
        arrayBuffer = new ArrayBuffer(byteLength);
        const sourceView = new Uint8Array(sourceBuffer, view.byteOffset, byteLength);
        const targetView = new Uint8Array(arrayBuffer);
        targetView.set(sourceView);
      } else {
        console.error('[Chat Store] Invalid buffer type:', typeof buf);
        return;
      }

      if (arrayBuffer.byteLength < 3) {
        console.error('[Chat Store] Packet too small:', arrayBuffer.byteLength);
        return;
      }

      const view = new DataView(arrayBuffer);
      let offset = 0;
      
      // 패킷 타입 읽기
      const packetType = view.getUint8(offset);
      offset += 1;

      // transferId 길이 읽기
      const idLen = view.getUint16(offset, false);
      offset += 2;
      
      // transferId 읽기
      const idBytes = new Uint8Array(arrayBuffer, offset, idLen);
      offset += idLen;
      const transferId = new TextDecoder().decode(idBytes);

      if (packetType === 1) {
        // ✅ 청크 인덱스 파싱
        const chunkIndex = view.getUint32(offset, false);
        offset += 4;
        
        console.log(`[Chat Store] 📥 Received chunk ${chunkIndex} for ${transferId}`);
        
        // ✅ 파싱된 인덱스와 함께 전달
        receiverWorker.postMessage(
          {
            type: 'chunk',
            payload: {
              transferId,
              index: chunkIndex, // ✅ 파싱된 인덱스 전달
              data: arrayBuffer,
              senderId: peerId,
            },
          },
          [arrayBuffer]
        );
      } else if (packetType === 2) {
        // 조립 요청
        console.log(`[Chat Store] 🔧 Assembly request for ${transferId}`);
        
        const meta = get().fileMetas.get(transferId);
        if (meta) {
          receiverWorker.postMessage({
            type: 'assemble',
            payload: {
              transferId,
              mimeType: meta.type,
              fileName: meta.name,
            },
          });
        }
      }
    },

    updateFileTransferState: (transferId, patch) => {
      set(
        produce((s: ChatStore) => {
          const t = s.fileTransfers.get(transferId);
          if (t) {
            Object.assign(t, patch);
          }
        })
      );
    },

    handleFileCancel: (transferId: string) => {
      if (receiverWorker) {
        receiverWorker.postMessage({
          type: 'cancel',
          payload: { transferId },
        });
      }

      set(
        produce((s: ChatStore) => {
          const t = s.fileTransfers.get(transferId);
          if (t) {
            t.isSending = false;
            t.isCancelled = true;
            t.isAssembling = false;
            t.speed = 0;
            t.eta = 0;
          }
        })
      );
    },

    initReceiverWorker,
    cleanupReceiverWorker,
    calculateChecksum,
  };
});
