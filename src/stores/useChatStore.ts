import { create } from 'zustand';
import { produce } from 'immer';
import type { ChatMessage as TChatMessage, FileMetadata } from '@/types/chat.types';
import { usePeerConnectionStore } from './usePeerConnectionStore';
import { saveFileFromOPFS } from '@/lib/fileTransfer/fileTransferUtils';
import { toast } from 'sonner';

// File System Access API 타입 정의
declare global {
  interface FileSystemHandle {
  readonly kind: 'file' | 'directory';
  readonly name: string;
  isSameEntry(other: FileSystemHandle): Promise<boolean>;
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface FileSystemFileHandle extends FileSystemHandle {
  readonly kind: 'file';
  getFile(): Promise<File>;
  createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
}

interface FileSystemCreateWritableOptions {
  keepExistingData?: boolean;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: Blob | BufferSource | WriteParams): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

interface WriteParams {
  type: 'write' | 'seek' | 'truncate';
  data?: string | Blob | BufferSource;
  position?: number;
  size?: number;
}

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

  interface Window {
    showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
  }

  interface SaveFilePickerOptions {
    id?: string;
    startIn?: FileSystemHandle;
    suggestedName?: string;
    types?: FilePickerAcceptType[];
  }

  interface FilePickerAcceptType {
    description?: string;
    accept: Record<string, string[]>;
  }
}

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
  awaitingHandle?: boolean; // ✅ 추가: 파일 핸들 대기 상태
  assembleProgress?: number;
  assemblePhase?: 'idle' | 'blob' | 'disk';
  finalizeActive?: boolean;
  finalizeProgress?: number;
  finalizeStage?: 'blob' | 'closing';
};

type ChatStore = {
  chatMessages: ChatMessage[];
  typingState: Map<string, string>;
  fileTransfers: Map<string, FileTransferState>;
  fileMetas: Map<string, FileMetadata>;
  receiverWorker: Worker | null;
  receivedChunksMap: Map<string, Set<number>>;
  initializedTransfers: Set<string>;
  unreadCount: number;
  isChatPanelOpen: boolean;
  addMessage: (m: ChatMessage) => void;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  deleteMessage: (messageId: string) => void;
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
  handleFileCancel: (transferId: string) => Promise<void>;
  initReceiverWorker: () => void;
  cleanupReceiverWorker: () => void;
  calculateChecksum: (data: ArrayBuffer) => Promise<string>;
  prepareFileHandle: (transferId: string) => Promise<boolean>; // ✅ 추가: 파일 핸들 준비 메서드
  setChatPanelOpen: (isOpen: boolean) => void;
  clearUnreadCount: () => void;
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

    receiverWorker.onmessage = async (e: MessageEvent) => {
      const { type, payload } = e.data;

      switch (type) {
        case 'ack': {
          const { transferId, chunkIndex, senderId } = payload;
          
          const peerStore = usePeerConnectionStore.getState();
          const ackMessage = JSON.stringify({
            type: 'file-ack',
            payload: { transferId, chunkIndex }
          });
          
          peerStore.sendToPeer(senderId, ackMessage);
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
          set(produce((state: ChatStore) => {
            const t = state.fileTransfers.get(payload.transferId);
            if (t) {
              t.isAssembling = true;
              t.assemblePhase = (state.fileMetas.get(payload.transferId)?.size || 0) >= 2 * 1024 * 1024 * 1024 ? 'disk' : 'blob';
              t.assembleProgress = 0;
            }
          }));
          break;
        }

        case 'assemble-progress': {
          const { transferId, progress } = payload;
          set(produce((state: ChatStore) => {
            const t = state.fileTransfers.get(transferId);
            if (t) {
              t.isAssembling = true;
              t.assemblePhase = 'blob';
              t.assembleProgress = Math.max(0, Math.min(1, progress));
            }
          }));
          break;
        }

        case 'finalize-start': {
          const { transferId, stage } = payload;
          set(produce((state: ChatStore) => {
            const t = state.fileTransfers.get(transferId);
            if (t) {
              t.finalizeActive = true;
              t.finalizeStage = stage || 'blob';
              t.finalizeProgress = 0;
            }
          }));
          break;
        }

        // ✅ Blob 방식 완료 (2GB 미만)
        case 'complete': {
          const { transferId, storageMode, tempFileName, fileName, fileType, url } = payload;
          
          set(produce((state: ChatStore) => {
            const transfer = state.fileTransfers.get(transferId);
            if (transfer) {
              transfer.isComplete = true;
              transfer.isAssembling = false;
              transfer.progress = 1;
              
              if (storageMode === 'blob') {
                transfer.blobUrl = url; // 작은 파일은 바로 미리보기 가능
                transfer.averageSpeed = payload.averageSpeed;
                transfer.totalTransferTime = payload.totalTime * 1000;
              }
              transfer.assembleProgress = 1;
              transfer.finalizeActive = false;
              transfer.finalizeProgress = 1;
            }
          }));

          // ✅ OPFS 모드일 경우: 자동으로 저장 대화상자 띄우기
          if (storageMode === 'opfs' && tempFileName) {
            toast.success('File received! Saving to disk...', { duration: 3000 });
            try {
              await saveFileFromOPFS(tempFileName, fileName, fileType);
              toast.success('File saved successfully');
            } catch (err) {
              toast.error('Failed to save file to disk');
            }
          } else {
             // Blob 모드 완료 알림
             console.log(`[Chat Store] Blob transfer complete: ${fileName}`);
          }
          
          // 송신자에게 완료 알림
          const meta = get().fileMetas.get(transferId);
          if (meta?.senderId) {
            usePeerConnectionStore.getState().sendToPeer(meta.senderId, JSON.stringify({
              type: 'file-receiver-complete',
              payload: { transferId }
            }));
          }
          break;
        }

        // ✅ 수정: request-file-handle 처리
        case 'request-file-handle': {
          const { transferId } = payload;
          set(produce((state: ChatStore) => {
            const t = state.fileTransfers.get(transferId);
            if (t) t.awaitingHandle = true;
          }));
          break;
        }

        // ✅ 대용량 파일 청크 쓰기 (이제 워커가 처리)
        case 'write-chunk': {
          // 이제 워커가 OPFS에 직접 쓰므로 메인 스레드에서 처리할 필요 없음
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

        case 'write-batch': {
          // 이제 워커가 OPFS에 직접 쓰므로 메인 스레드에서 처리할 필요 없음
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
    initializedTransfers: new Set(),
    unreadCount: 0,
    isChatPanelOpen: false,

    addMessage: (m) =>
      set(
        produce((s: ChatStore) => {
          // 답장 메시지인 경우 부모 메시지 정보 찾기
          if (m.parentId) {
            const parentMessage = s.chatMessages.find(msg => msg.id === m.parentId);
            if (parentMessage) {
              m.replyTo = parentMessage;
              // 부모 메시지에 답장 ID 추가
              if (!parentMessage.replies) {
                parentMessage.replies = [];
              }
              if (!parentMessage.replies.includes(m.id)) {
                parentMessage.replies.push(m.id);
              }
            }
          }

          s.chatMessages.push(m);

          if (!s.isChatPanelOpen) {
            s.unreadCount += 1;
          }
        })
      ),

    /**
     * 메시지 업데이트
     */
    updateMessage: (messageId, updates) =>
      set(
        produce((s: ChatStore) => {
          const index = s.chatMessages.findIndex(m => m.id === messageId);
          if (index !== -1) {
            s.chatMessages[index] = { ...s.chatMessages[index], ...updates };
          }
        })
      ),

    /**
     * 메시지 삭제
     */
    deleteMessage: (messageId) =>
      set(
        produce((s: ChatStore) => {
          s.chatMessages = s.chatMessages.filter(m => m.id !== messageId);
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
            
            if (!s.isChatPanelOpen && !isSender) {
              s.unreadCount += 1;
            }
          }

          if (!isSender && !s.initializedTransfers.has(meta.transferId)) {
            s.initializedTransfers.add(meta.transferId);
            s.receivedChunksMap.set(meta.transferId, new Set());
          }
        })
      );

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
        }
      }
    },

    handleIncomingChunk: async (peerId, buf) => {
      if (!receiverWorker) return;

      let arrayBuffer: ArrayBuffer;

      if (buf instanceof ArrayBuffer) {
        arrayBuffer = buf;
      } else if (ArrayBuffer.isView(buf)) {
        const view = buf as ArrayBufferView;
        const sourceBuffer = view.buffer;
        
        if (sourceBuffer instanceof SharedArrayBuffer) {
          arrayBuffer = new ArrayBuffer(view.byteLength);
          const sourceView = new Uint8Array(sourceBuffer, view.byteOffset, view.byteLength);
          const targetView = new Uint8Array(arrayBuffer);
          targetView.set(sourceView);
        } else {
          arrayBuffer = view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
        }
      } else {
        return;
      }

      if (arrayBuffer.byteLength < 3) return;

      const view = new DataView(arrayBuffer);
      let offset = 0;
      
      const packetType = view.getUint8(offset);
      offset += 1;

      const idLen = view.getUint16(offset, false);
      offset += 2;
      
      const idBytes = new Uint8Array(arrayBuffer, offset, idLen);
      offset += idLen;
      const transferId = new TextDecoder().decode(idBytes);

      if (packetType === 1) {
        const chunkIndex = view.getUint32(offset, false);
        
        receiverWorker.postMessage(
          {
            type: 'chunk',
            payload: {
              transferId,
              index: chunkIndex,
              data: arrayBuffer,
              senderId: peerId,
            },
          },
          [arrayBuffer]
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

    handleFileCancel: async (transferId: string) => {
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
    prepareFileHandle: async (transferId) => {
      // 이제 워커가 OPFS를 직접 사용하므로 이 함수는 더 이상 필요 없음
      return true;
    },

    setChatPanelOpen: (isOpen) => {
      set(
        produce((s: ChatStore) => {
          s.isChatPanelOpen = isOpen;
          if (isOpen) {
            s.unreadCount = 0;
          }
        })
      );
    },

    clearUnreadCount: () => {
      set(
        produce((s: ChatStore) => {
          s.unreadCount = 0;
        })
      );
    },
  };
});
