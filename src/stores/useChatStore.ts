import { create } from 'zustand';
import { produce } from 'immer';
import { saveChunk, getAndAssembleFile, deleteFileChunks } from '@/lib/db/indexedDBHelper';
import type { ChatMessage as TChatMessage, FileMetadata } from '@/types/chat.types';
import { sendChunkAck } from '../lib/ackDispatcher';

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
  ackedBytes: number;
  receivedBytes: number;
  startTime: number;
  lastUpdateTime: number;
  blobUrl?: string;
};

type ChatStore = {
  chatMessages: ChatMessage[];
  typingState: Map<string, string>;
  fileTransfers: Map<string, FileTransferState>;
  fileMetas: Map<string, FileMetadata>;
  addMessage: (m: ChatMessage) => void;
  setTypingState: (userId: string, nickname: string, isTyping: boolean) => void;
  addFileMessage: (senderId: string, senderNickname: string, meta: FileMetadata, isSender: boolean, previewUrl?: string) => Promise<void>;
  handleIncomingChunk: (peerId: string, buf: ArrayBuffer) => Promise<void>;
  updateFileTransferState: (transferId: string, patch: Partial<FileTransferState>) => void;
  handleFileCancel: (transferId: string) => void;
};

const assemblers = new Map<string, Worker>();
const seenChunks = new Map<string, Set<number>>();
const receivedBytesMap = new Map<string, number>();
const lastEmitMap = new Map<string, number>();

export const useChatStore = create<ChatStore>((set, get) => ({
  chatMessages: [],
  typingState: new Map(),
  fileTransfers: new Map(),
  fileMetas: new Map(),

  addMessage: (m) => set(produce((s: ChatStore) => { s.chatMessages.push(m); })),

  setTypingState: (userId, nickname, isTyping) => {
    set(produce((s: ChatStore) => {
      if (isTyping) s.typingState.set(userId, nickname);
      else s.typingState.delete(userId);
    }));
  },

  addFileMessage: async (senderId, senderNickname, meta, isSender, previewUrl) => {
    set(produce((s: ChatStore) => {
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
          ackedBytes: 0,
          receivedBytes: 0,
          startTime: 0,
          lastUpdateTime: 0,
          blobUrl: undefined
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
          previewUrl
        };
        s.chatMessages.push(msg);
      }
    }));
  },

  handleIncomingChunk: async (peerId, buf) => {
    const view = new DataView(buf);
    let offset = 0;
    const packetType = view.getUint8(offset); offset += 1;
    const idLen = view.getUint16(offset, false); offset += 2;
    const idBytes = new Uint8Array(buf, offset, idLen); offset += idLen;
    const transferId = new TextDecoder().decode(idBytes);

    if (packetType === 1) {
      const chunkIndex = view.getUint32(offset, false); offset += 4;
      const data = buf.slice(offset);

      sendChunkAck(peerId, transferId, chunkIndex);

      let chunkSet = seenChunks.get(transferId);
      if (!chunkSet) {
        chunkSet = new Set<number>();
        seenChunks.set(transferId, chunkSet);
      }
      if (chunkSet.has(chunkIndex)) return;
      chunkSet.add(chunkIndex);

      await saveChunk(transferId, chunkIndex, data);

      const prev = receivedBytesMap.get(transferId) || 0;
      const next = prev + (data as ArrayBuffer).byteLength;
      receivedBytesMap.set(transferId, next);

      const now = Date.now();
      const last = lastEmitMap.get(transferId) || 0;
      if (now - last < 120) return;
      lastEmitMap.set(transferId, now);

      const meta = get().fileMetas.get(transferId);
      set(produce((s: ChatStore) => {
        const t = s.fileTransfers.get(transferId);
        if (!t) return;
        if (t.startTime === 0) t.startTime = now;
        t.receivedBytes = next;
        const elapsed = Math.max(0.001, (now - t.startTime) / 1000);
        t.speed = t.receivedBytes / elapsed;
        if (meta) {
          t.progress = Math.min(1, t.receivedBytes / Math.max(1, meta.size));
          const remain = Math.max(0, meta.size - t.receivedBytes);
          t.eta = t.speed > 0 ? remain / t.speed : Infinity;
        }
        t.lastUpdateTime = now;
      }));
      return;
    }

    if (packetType === 2) {
      const meta = get().fileMetas.get(transferId);
      if (!meta) return;

      set(produce((s: ChatStore) => {
        const t = s.fileTransfers.get(transferId);
        if (t && !t.isComplete) t.isAssembling = true;
      }));

      if (assemblers.has(transferId)) return;

      const worker = new Worker(new URL('../workers/assemble.worker.ts', import.meta.url), { type: 'module' });
      assemblers.set(transferId, worker);

      worker.onmessage = async (evt: MessageEvent) => {
        const { type: mType, payload } = evt.data || {};
        if (mType === 'progress') {
          return;
        }
        if (mType === 'assembled') {
          const blob: Blob = payload.blob;
          const url = URL.createObjectURL(blob);
          const start = get().fileTransfers.get(transferId)?.startTime || Date.now();
          const end = Date.now();
          set(produce((s: ChatStore) => {
            const t = s.fileTransfers.get(transferId);
            if (!t) return;
            t.isAssembling = false;
            t.isComplete = true;
            t.progress = 1;
            t.speed = 0;
            t.eta = 0;
            t.totalTransferTime = end - start;
            t.averageSpeed = meta.size > 0 ? meta.size / Math.max(0.001, (end - start) / 1000) : 0;
            t.blobUrl = url;
          }));
          try { await deleteFileChunks(transferId); } catch {}
          worker.terminate();
          assemblers.delete(transferId);
          return;
        }
        if (mType === 'error') {
          const start = get().fileTransfers.get(transferId)?.startTime || Date.now();
          try {
            const blob = await getAndAssembleFile(transferId, meta.type);
            const url = blob ? URL.createObjectURL(blob) : undefined;
            const end = Date.now();
            set(produce((s: ChatStore) => {
              const t = s.fileTransfers.get(transferId);
              if (!t) return;
              t.isAssembling = false;
              t.isComplete = true;
              t.progress = 1;
              t.speed = 0;
              t.eta = 0;
              t.totalTransferTime = end - start;
              t.averageSpeed = meta.size > 0 ? meta.size / Math.max(0.001, (end - start) / 1000) : 0;
              t.blobUrl = url;
            }));
            try { await deleteFileChunks(transferId); } catch {}
          } finally {
            worker.terminate();
            assemblers.delete(transferId);
          }
          return;
        }
      };

      worker.postMessage({ type: 'assemble', payload: { transferId, mimeType: meta.type, totalChunks: meta.totalChunks } });
      return;
    }
  },

  updateFileTransferState: (transferId, patch) => {
    set(produce((s: ChatStore) => {
      const t = s.fileTransfers.get(transferId);
      if (!t) return;
      Object.assign(t, patch);
    }));
  },

  handleFileCancel: (transferId) => {
    set(produce((s: ChatStore) => {
      const t = s.fileTransfers.get(transferId);
      if (!t) return;
      t.isSending = false;
      t.isCancelled = true;
      t.isAssembling = false;
      t.speed = 0;
      t.eta = 0;
    }));
    const w = assemblers.get(transferId);
    if (w) {
      w.terminate();
      assemblers.delete(transferId);
    }
  }
}));
