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
  handleFileCancel: (transferId: string) => Promise<void>;
  initReceiverWorker: () => void;
  cleanupReceiverWorker: () => void;
  calculateChecksum: (data: ArrayBuffer) => Promise<string>;
  prepareFileHandle: (transferId: string) => Promise<boolean>; // ✅ 추가: 파일 핸들 준비 메서드
};

export const useChatStore = create<ChatStore>((set, get) => {
  let receiverWorker: Worker | null = null;
  
  const SIZE_THRESHOLD = 2 * 1024 * 1024 * 1024; // 2GB
  
  // 대용량 파일 다운로드 스트림 관리
  const downloadStreams = new Map<string, {
    stream: FileSystemWritableFileStream;
    receivedChunks: number;
    writtenChunks: number;
    totalChunks: number;
    fileName: string;
    startTime: number;
    queue: Uint8Array[];
    bufferedBytes: number;
    flushing: boolean;
    pendingClose: boolean;
    lastUpdate: number;
  }>();

  const DISK_FLUSH_BYTES = 16 * 1024 * 1024;
  const DISK_FLUSH_MAX_CHUNKS = 128;
  const PROGRESS_UPDATE_INTERVAL = 300;

  // Finalizing 타이머 관리
  const finalizeTimers = new Map<string, number>();
  const startFinalizeTicker = (transferId: string) => {
    if (finalizeTimers.has(transferId)) return;
    const id = window.setInterval(() => {
      set(produce((state: ChatStore) => {
        const t = state.fileTransfers.get(transferId);
        if (t) t.finalizeProgress = Math.min(0.95, (t.finalizeProgress || 0) + 0.02);
      }));
    }, 200);
    finalizeTimers.set(transferId, id);
  };
  const stopFinalizeTicker = (transferId: string) => {
    const id = finalizeTimers.get(transferId);
    if (id) {
      clearInterval(id);
      finalizeTimers.delete(transferId);
    }
  };

  const calculateChecksum = async (data: ArrayBuffer): Promise<string> => {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const flushToDisk = async (transferId: string) => {
    const s = downloadStreams.get(transferId);
    if (!s || s.flushing) return;
    s.flushing = true;
    try {
      while (s.queue.length > 0) {
        const count = s.queue.length;
        // Convert Uint8Array to ArrayBuffer to fix TypeScript compatibility issue
        const buffers = s.queue.map(u8 => {
          const newBuffer = new ArrayBuffer(u8.byteLength);
          new Uint8Array(newBuffer).set(u8);
          return newBuffer;
        });
        const blob = new Blob(buffers, { type: 'application/octet-stream' });
        s.queue = [];
        s.bufferedBytes = 0;
        await s.stream.write(blob);
        s.writtenChunks += count;

        const ap = s.writtenChunks / s.totalChunks;
        const now = Date.now();
        if (now - s.lastUpdate >= PROGRESS_UPDATE_INTERVAL || s.writtenChunks === s.totalChunks) {
          set(produce((state: ChatStore) => {
            const t = state.fileTransfers.get(transferId);
            if (t) {
              t.assemblePhase = 'disk';
              t.assembleProgress = Math.max(0, Math.min(1, ap));
            }
          }));
          s.lastUpdate = now;
        }
      }

      if (s.pendingClose && s.writtenChunks >= s.totalChunks) {
        set(produce((state: ChatStore) => {
          const t = state.fileTransfers.get(transferId);
          if (t) {
            t.finalizeActive = true;
            t.finalizeStage = 'closing';
            t.finalizeProgress = t.finalizeProgress ?? 0;
          }
        }));
        startFinalizeTicker(transferId);
        await s.stream.close();
        stopFinalizeTicker(transferId);
        downloadStreams.delete(transferId);
        set(produce((state: ChatStore) => {
          const t = state.fileTransfers.get(transferId);
          if (t) {
            t.isComplete = true;
            t.isAssembling = false;
            t.progress = 1;
            t.assembleProgress = 1;
            t.finalizeActive = false;
            t.finalizeProgress = 1;
          }
        }));
        const meta = get().fileMetas.get(transferId);
        if (meta?.senderId) {
          const pc = usePeerConnectionStore.getState();
          pc.sendToPeer(meta.senderId, JSON.stringify({ type: 'file-receiver-complete', payload: { transferId } }));
        }
      }
    } finally {
      const s2 = downloadStreams.get(transferId);
      if (s2) s2.flushing = false;
    }
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
          startFinalizeTicker(payload.transferId);
          break;
        }

        // ✅ Blob 방식 완료 (2GB 미만)
        case 'complete': {
          stopFinalizeTicker(payload.transferId);
          set(
            produce((state: ChatStore) => {
              const transfer = state.fileTransfers.get(payload.transferId);
              if (transfer) {
                transfer.isComplete = true;
                transfer.isAssembling = false;
                transfer.blobUrl = payload.url;
                transfer.averageSpeed = payload.averageSpeed;
                transfer.totalTransferTime = payload.totalTime * 1000;
                transfer.assembleProgress = 1;
                transfer.finalizeActive = false;
                transfer.finalizeProgress = 1;
              }
            })
          );
          
          // 송신자에게 완료 알림
          const meta = get().fileMetas.get(payload.transferId);
          if (meta && meta.senderId) {
            const peerStore = usePeerConnectionStore.getState();
            const completeMessage = JSON.stringify({
              type: 'file-receiver-complete',
              payload: { transferId: payload.transferId }
            });
            
            peerStore.sendToPeer(meta.senderId, completeMessage);
          }
          
          console.log(`[Chat Store] ✅ File transfer complete: ${payload.name}`);
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

        // ✅ 대용량 파일 청크 쓰기
        case 'write-chunk': {
          const { transferId, data, isLast } = payload;
          const s = downloadStreams.get(transferId);
          if (!s) break;
          s.queue.push(new Uint8Array(data));
          s.bufferedBytes += (data as ArrayBuffer).byteLength;
          s.receivedChunks++;

          if (s.bufferedBytes >= DISK_FLUSH_BYTES || s.queue.length >= DISK_FLUSH_MAX_CHUNKS) {
            void flushToDisk(transferId);
          }
          if (isLast) {
            s.pendingClose = true;
            void flushToDisk(transferId);
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

        case 'write-batch': {
          const { transferId, parts, isLastBatch } = payload as { transferId: string; parts: ArrayBuffer[]; isLastBatch: boolean };
          const s = downloadStreams.get(transferId);
          if (!s) break;
          for (const ab of parts) {
            const u8 = new Uint8Array(ab);
            s.queue.push(u8);
            s.bufferedBytes += u8.byteLength;
            s.receivedChunks++;
          }
          if (s.bufferedBytes >= DISK_FLUSH_BYTES || s.queue.length >= DISK_FLUSH_MAX_CHUNKS || isLastBatch) {
            if (isLastBatch) s.pendingClose = true;
            void flushToDisk(transferId);
          }
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

      const stream = downloadStreams.get(transferId);
      if (stream) {
        try { await stream.stream.close(); } catch {}
        downloadStreams.delete(transferId);
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
      const meta = get().fileMetas.get(transferId);
      if (!meta) return false;
      try {
        const ext = `.${(meta.name.split('.').pop() || 'bin').toLowerCase()}`;
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: meta.name,
          types: [{ description: 'File', accept: { [meta.type || 'application/octet-stream']: [ext] } }]
        });
        const stream: FileSystemWritableFileStream = await (handle as any).createWritable();
        downloadStreams.set(transferId, {
          stream,
          receivedChunks: 0,
          writtenChunks: 0,
          totalChunks: meta.totalChunks,
          fileName: meta.name,
          startTime: Date.now(),
          queue: [],
          bufferedBytes: 0,
          flushing: false,
          pendingClose: false,
          lastUpdate: 0
        });
        if (receiverWorker) {
          receiverWorker.postMessage({ type: 'file-handle-ready', payload: { transferId } });
        }
        set(produce((state: ChatStore) => {
          const t = state.fileTransfers.get(transferId);
          if (t) t.awaitingHandle = false;
        }));
        return true;
      } catch {
        set(produce((state: ChatStore) => {
          const t = state.fileTransfers.get(transferId);
          if (t) t.awaitingHandle = true;
        }));
        return false;
      }
    },
  };
});
