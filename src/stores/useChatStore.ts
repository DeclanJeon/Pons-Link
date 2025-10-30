/**
 * @fileoverview 채팅 메시지 관리 Zustand 스토어 (조립 상태 추가)
 * @module stores/useChatStore
 */

import { create } from 'zustand';
import { produce } from 'immer';
import { usePeerConnectionStore } from './usePeerConnectionStore';
import { initDB, saveChunk, getAndAssembleFile, deleteFileChunks } from '@/lib/db/indexedDBHelper';
import { toast } from 'sonner';

export interface FileMetadata {
  transferId: string;
  name: string;
  size: number;
  type: string;
  totalChunks: number;
  chunkSize: number;
  url?: string;
}

export interface FileTransferProgress {
  progress: number;
  isSending: boolean;
  isReceiving: boolean;
  isComplete: boolean;
  isAssembling: boolean; // ✅ 추가: 파일 조립 중 상태
  isCancelled?: boolean;
  blobUrl?: string;
  senderId: string;
  receivedChunks: Set<number>;
  endSignalReceived: boolean;
  lastActivityTime: number;
  lastReceivedSize: number;
  speed: number;
  eta: number;
  averageSpeed: number;
  totalTransferTime: number;
}

export type MessageType = 'text' | 'file' | 'image' | 'gif';

export interface ChatMessage {
  id: string;
  type: MessageType;
  text?: string;
  fileMeta?: FileMetadata;
  senderId: string;
  senderNickname: string;
  timestamp: number;
  previewUrl?: string;
}

const HEADER_TYPE_OFFSET = 0;
const HEADER_ID_LEN_OFFSET = 1;
const HEADER_ID_OFFSET = 3;

function parseChunkHeader(
buffer: ArrayBuffer
): { type: number; transferId: string; chunkIndex?: number; data?: ArrayBuffer } | null {
try {
    if (buffer.byteLength < HEADER_ID_OFFSET) return null;

  const view = new DataView(buffer);
  const type = view.getUint8(HEADER_TYPE_OFFSET);
   
    // Validate type is either 1 (data chunk) or 2 (end signal)
  if (type !== 1 && type !== 2) return null;
    
  // Check if we have enough bytes for the ID length field
  if (buffer.byteLength < HEADER_ID_LEN_OFFSET + 2) return null;
    
  const idLength = view.getUint16(HEADER_ID_LEN_OFFSET, false);

// Validate ID length is reasonable (e.g., not too large)
    if (idLength > 1000 || idLength < 0) return null;

const headerBaseSize = HEADER_ID_OFFSET + idLength;
    
if (buffer.byteLength < headerBaseSize) return null;

const transferIdBytes = new Uint8Array(buffer, HEADER_ID_OFFSET, idLength);
  const transferId = new TextDecoder().decode(transferIdBytes);

  if (type === 1) {
      const dataHeaderSize = headerBaseSize + 4;
      if (buffer.byteLength < dataHeaderSize) return null;

      const chunkIndex = view.getUint32(headerBaseSize, false);
      const data = buffer.slice(dataHeaderSize);

      return { type, transferId, chunkIndex, data };
    } else if (type === 2) {
      return { type, transferId };
    }

    return null;
 } catch (error) {
    console.warn('[ChatStore] Error parsing chunk header:', error);
    return null;
 }
}

interface ChatState {
  chatMessages: ChatMessage[];
  isTyping: Map<string, string>;
  fileTransfers: Map<string, FileTransferProgress>;
  pendingChunks: Map<string, ArrayBuffer[]>;
}

interface ChatActions {
  addMessage: (message: ChatMessage) => void;
  addFileMessage: (
    senderId: string,
    senderNickname: string,
    fileMeta: FileMetadata,
    isLocal?: boolean,
    previewUrl?: string
  ) => Promise<void>;
  handleIncomingChunk: (peerId: string, receivedData: ArrayBuffer | Uint8Array) => Promise<void>;
  checkAndAssembleIfComplete: (transferId: string) => Promise<void>;
  setTypingState: (userId: string, nickname: string, isTyping: boolean) => void;
  clearChat: () => void;
  updateFileTransferState: (transferId: string, updates: Partial<FileTransferProgress>) => void;
  handleFileCancel: (transferId: string) => Promise<void>;
}

export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  chatMessages: [],
  isTyping: new Map(),
  fileTransfers: new Map(),
  pendingChunks: new Map(),

  addMessage: (message) =>
    set(
      produce((state: ChatState) => {
        if (!state.chatMessages.some((msg) => msg.id === message.id)) {
          state.chatMessages.push(message);
        }
      })
    ),

  addFileMessage: async (senderId, senderNickname, fileMeta, isLocal = false, previewUrl) => {
    if (get().fileTransfers.has(fileMeta.transferId)) return;

    const newFileMessage: ChatMessage = {
      id: fileMeta.transferId,
      type: fileMeta.type.startsWith('image/') ? 'image' : 'file',
      fileMeta,
      senderId,
      senderNickname,
      timestamp: Date.now(),
      previewUrl,
    };

    const newTransferProgress: FileTransferProgress = {
      progress: 0,
      isSending: isLocal,
      isReceiving: !isLocal,
      isComplete: false,
      isAssembling: false, // ✅ 초기값
      isCancelled: false,
      senderId,
      receivedChunks: new Set(),
      endSignalReceived: false,
      lastActivityTime: Date.now(),
      lastReceivedSize: 0,
      speed: 0,
      eta: Infinity,
      averageSpeed: 0,
      totalTransferTime: 0,
    };

    set(
      produce((state: ChatState) => {
        state.chatMessages.push(newFileMessage);
        state.fileTransfers.set(fileMeta.transferId, newTransferProgress);
      })
    );

    if (!isLocal) {
      await initDB();
      const pending = get().pendingChunks.get(fileMeta.transferId);
      if (pending) {
        console.log(`[ChatStore] Processing ${pending.length} pending chunks`);
        for (const chunk of pending) {
          await get().handleIncomingChunk(senderId, chunk);
        }
        set(
          produce((state) => {
            state.pendingChunks.delete(fileMeta.transferId);
          })
        );
      }
    }
  },

  handleIncomingChunk: async (peerId, receivedData) => {
    // Check if the received data is a text message (JSON) instead of binary chunk
    if (receivedData instanceof ArrayBuffer) {
      // It's binary data, likely a file transfer chunk
      const chunkBuffer = receivedData;
      const parsed = parseChunkHeader(chunkBuffer);
      if (!parsed) {
        // This might be other binary data that's not a file transfer chunk
        // Log with more details for debugging
        console.debug('[ChatStore] Received binary data that is not a file transfer chunk');
        return;
      }
      
      const { type, transferId, chunkIndex, data } = parsed;
      const { fileTransfers, checkAndAssembleIfComplete } = get();
      
      if (!fileTransfers.has(transferId)) {
        set(
          produce((state: ChatState) => {
            if (!state.pendingChunks.has(transferId)) state.pendingChunks.set(transferId, []);
            state.pendingChunks.get(transferId)!.push(chunkBuffer);
          })
        );
        return;
      }
      
      const transfer = fileTransfers.get(transferId)!;
      if (transfer.isComplete || transfer.isCancelled) return;
      
      if (type === 1 && typeof chunkIndex === 'number' && data) {
        if (transfer.receivedChunks.has(chunkIndex)) return;
        
        try {
          await saveChunk(transferId, chunkIndex, data);
          
          // ACK 전송
          usePeerConnectionStore.getState().sendToPeer(
            peerId,
            JSON.stringify({
              type: 'file-ack',
              payload: { transferId, chunkIndex }
            })
          );
          
          set(
            produce((state: ChatState) => {
              const currentTransfer = state.fileTransfers.get(transferId);
              const message = state.chatMessages.find((m) => m.id === transferId);
              
              if (currentTransfer && message?.fileMeta) {
                currentTransfer.receivedChunks.add(chunkIndex);
                
                const now = Date.now();
                const elapsed = (now - currentTransfer.lastActivityTime) / 1000;
                const receivedBytesSinceLastUpdate = data.byteLength;
                
                if (elapsed > 0.05) {
                  const instantaneousSpeed = receivedBytesSinceLastUpdate / elapsed;
                  currentTransfer.speed = instantaneousSpeed;
                  
                  const totalReceived = currentTransfer.lastReceivedSize + receivedBytesSinceLastUpdate;
                  const remainingBytes = message.fileMeta.size - totalReceived;
                  currentTransfer.eta = instantaneousSpeed > 0 ? remainingBytes / instantaneousSpeed : Infinity;
                }
                
                currentTransfer.progress = currentTransfer.receivedChunks.size / message.fileMeta.totalChunks;
                currentTransfer.lastReceivedSize += data.byteLength;
                currentTransfer.lastActivityTime = now;
              }
            })
          );
        } catch (error) {
          console.error(`[ChatStore] Failed to save chunk ${chunkIndex}:`, error);
        }
      } else if (type === 2) {
        if (!transfer.endSignalReceived) {
          set(
            produce((state: ChatState) => {
              state.fileTransfers.get(transferId)!.endSignalReceived = true;
            })
          );
          console.log(`[ChatStore] End signal received for ${transferId}`);
          setTimeout(() => checkAndAssembleIfComplete(transferId), 500);
        }
      }
    } else if (receivedData instanceof Uint8Array) {
      // It's a Uint8Array, convert to ArrayBuffer
      const chunkBuffer = receivedData.buffer.slice(receivedData.byteOffset, receivedData.byteOffset + receivedData.byteLength);
      const parsed = parseChunkHeader(chunkBuffer);
      if (!parsed) {
        // This might be other binary data that's not a file transfer chunk
        console.debug('[ChatStore] Received binary data that is not a file transfer chunk');
        return;
      }
      
      const { type, transferId, chunkIndex, data } = parsed;
      const { fileTransfers, checkAndAssembleIfComplete } = get();
      
      if (!fileTransfers.has(transferId)) {
        set(
          produce((state: ChatState) => {
            if (!state.pendingChunks.has(transferId)) state.pendingChunks.set(transferId, []);
            state.pendingChunks.get(transferId)!.push(chunkBuffer);
          })
        );
        return;
      }
      
      const transfer = fileTransfers.get(transferId)!;
      if (transfer.isComplete || transfer.isCancelled) return;
      
      if (type === 1 && typeof chunkIndex === 'number' && data) {
        if (transfer.receivedChunks.has(chunkIndex)) return;
        
        try {
          await saveChunk(transferId, chunkIndex, data);
          
          // ACK 전송
          usePeerConnectionStore.getState().sendToPeer(
            peerId,
            JSON.stringify({
              type: 'file-ack',
              payload: { transferId, chunkIndex }
            })
          );
          
          set(
            produce((state: ChatState) => {
              const currentTransfer = state.fileTransfers.get(transferId);
              const message = state.chatMessages.find((m) => m.id === transferId);
              
              if (currentTransfer && message?.fileMeta) {
                currentTransfer.receivedChunks.add(chunkIndex);
                
                const now = Date.now();
                const elapsed = (now - currentTransfer.lastActivityTime) / 1000;
                const receivedBytesSinceLastUpdate = data.byteLength;
                
                if (elapsed > 0.05) {
                  const instantaneousSpeed = receivedBytesSinceLastUpdate / elapsed;
                  currentTransfer.speed = instantaneousSpeed;
                  
                  const totalReceived = currentTransfer.lastReceivedSize + receivedBytesSinceLastUpdate;
                  const remainingBytes = message.fileMeta.size - totalReceived;
                  currentTransfer.eta = instantaneousSpeed > 0 ? remainingBytes / instantaneousSpeed : Infinity;
                }
                
                currentTransfer.progress = currentTransfer.receivedChunks.size / message.fileMeta.totalChunks;
                currentTransfer.lastReceivedSize += data.byteLength;
                currentTransfer.lastActivityTime = now;
              }
            })
          );
        } catch (error) {
          console.error(`[ChatStore] Failed to save chunk ${chunkIndex}:`, error);
        }
      } else if (type === 2) {
        if (!transfer.endSignalReceived) {
          set(
            produce((state: ChatState) => {
              state.fileTransfers.get(transferId)!.endSignalReceived = true;
            })
          );
          console.log(`[ChatStore] End signal received for ${transferId}`);
          setTimeout(() => checkAndAssembleIfComplete(transferId), 500);
        }
      }
    } else {
      // This is likely a text message, not a file transfer chunk
      // We should not be handling text messages in this function
      // This might indicate a problem with how messages are routed
      console.warn('[ChatStore] handleIncomingChunk received non-binary data:', receivedData);
    }


  },

  checkAndAssembleIfComplete: async (transferId: string) => {
    const { fileTransfers, chatMessages } = get();
    const transfer = fileTransfers.get(transferId);
    const message = chatMessages.find((m) => m.id === transferId);

    if (!transfer || !message?.fileMeta || transfer.isComplete || transfer.isCancelled) return;

    const isReadyToAssemble =
      transfer.endSignalReceived && transfer.receivedChunks.size >= message.fileMeta.totalChunks;

    if (isReadyToAssemble) {
      console.log(`[ChatStore] Assembling file: ${transferId}`);
      
      // ✅ 조립 시작 상태 표시
      set(
        produce((state: ChatState) => {
          const t = state.fileTransfers.get(transferId);
          if (t) {
            t.isAssembling = true;
            t.isReceiving = false;
            t.speed = 0;
            t.eta = 0;
          }
        })
      );

      try {
        const blob = await getAndAssembleFile(transferId, message.fileMeta.type);

        if (blob && Math.abs(blob.size - message.fileMeta.size) < 1024) {
          const totalTransferTime = Date.now() - message.timestamp;
          const averageSpeed = totalTransferTime > 0 ? message.fileMeta.size / (totalTransferTime / 1000) : 0;

          set(
            produce((state: ChatState) => {
              const t = state.fileTransfers.get(transferId);
              if (t) {
                t.isComplete = true;
                t.isAssembling = false; // ✅ 조립 완료
                t.isReceiving = false;
                t.progress = 1;
                t.blobUrl = URL.createObjectURL(blob);
                t.speed = 0;
                t.eta = 0;
                t.averageSpeed = averageSpeed;
                t.totalTransferTime = totalTransferTime;
              }
            })
          );

          toast.success(`파일 "${message.fileMeta.name}" 수신 완료!`);
          await deleteFileChunks(transferId);
        } else {
          throw new Error(`Assembly failed or size mismatch`);
        }
      } catch (error) {
        console.error(`[ChatStore] File assembly error:`, error);
        
        set(
          produce((state: ChatState) => {
            const t = state.fileTransfers.get(transferId);
            if (t) {
              t.isAssembling = false;
              t.isReceiving = false;
              t.isCancelled = true;
            }
          })
        );
        
        toast.error(`파일 조립 실패: ${message.fileMeta.name}`);
      }
    }
  },

  setTypingState: (userId, nickname, isTyping) =>
    set(
      produce((state: ChatState) => {
        if (isTyping) state.isTyping.set(userId, nickname);
        else state.isTyping.delete(userId);
      })
    ),

  updateFileTransferState: (transferId, updates) => {
    set(
      produce((state: ChatState) => {
        const transfer = state.fileTransfers.get(transferId);
        if (transfer) {
          Object.assign(transfer, updates);
        }
      })
    );
  },

  handleFileCancel: async (transferId: string) => {
    console.log(`[ChatStore] Handling cancellation for ${transferId}`);
    const transfer = get().fileTransfers.get(transferId);

    if (transfer && !transfer.isComplete && !transfer.isCancelled) {
      get().updateFileTransferState(transferId, {
        isReceiving: false,
        isSending: false,
        isAssembling: false,
        isCancelled: true,
      });
      toast.info('파일 전송이 취소되었습니다.');
      await deleteFileChunks(transferId);
    }
  },

  clearChat: () => {
    get().fileTransfers.forEach(async (transfer, transferId) => {
      if (transfer.blobUrl) URL.revokeObjectURL(transfer.blobUrl);
      await deleteFileChunks(transferId);
    });

    get().chatMessages.forEach((msg) => {
      if (msg.previewUrl) {
        URL.revokeObjectURL(msg.previewUrl);
      }
    });

    set({
      chatMessages: [],
      isTyping: new Map(),
      fileTransfers: new Map(),
      pendingChunks: new Map(),
    });
  },
}));
