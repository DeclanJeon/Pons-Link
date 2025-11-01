import { create } from 'zustand';
import { produce } from 'immer';
import type { ChatMessage as TChatMessage, FileMetadata } from '@/types/chat.types';

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
};

export const useChatStore = create<ChatStore>((set, get) => {
  let receiverWorker: Worker | null = null;

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
          
          // ✅ 핵심 수정: ACK를 송신자에게 WebRTC로 전송!
          import('@/stores/usePeerConnectionStore').then(({ usePeerConnectionStore }) => {
            const peerStore = usePeerConnectionStore.getState();
            
            // ACK 메시지 생성
            const ackMessage = JSON.stringify({
              type: 'file-ack',
              payload: { transferId, chunkIndex }
            });
            
            // 송신자에게 ACK 전송
            if (senderId) {
              peerStore.sendToPeer(senderId, ackMessage);
            }
          });
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
        })
      );

      // ✅ 수정: 수신자만 초기화 (중복 방지)
      if (!isSender && receiverWorker) {
        receiverWorker.postMessage({
          type: 'init-transfer',
          payload: {
            transferId: meta.transferId,
            totalChunks: meta.totalChunks,
            totalSize: meta.size,
          },
        });
      }
    },

    handleIncomingChunk: async (peerId, buf) => {
      if (!receiverWorker) {
        console.error('[Chat Store] Receiver worker not initialized');
        return;
      }

      const view = new DataView(buf);
      let offset = 0;

      const packetType = view.getUint8(offset);
      offset += 1;

      const idLen = view.getUint16(offset, false);
      offset += 2;

      const idBytes = new Uint8Array(buf, offset, idLen);
      offset += idLen;

      const transferId = new TextDecoder().decode(idBytes);

      if (packetType === 1) {
        const chunkIndex = view.getUint32(offset, false);
        offset += 4;

        const data = buf.slice(offset);

        receiverWorker.postMessage(
          {
            type: 'chunk',
            payload: {
              transferId,
              index: chunkIndex,
              data,
              senderId: peerId // ✅ 송신자 ID 전달
            },
          },
          [data]
        );
      } else if (packetType === 2) {
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

    handleFileCancel: (transferId) => {
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
  };
});
