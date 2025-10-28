/**
 * @fileoverview WebRTC 피어 연결 관리 스토어 (버퍼 관리 복원)
 * @module stores/usePeerConnectionStore
 */

import { create } from 'zustand';
import { produce } from 'immer';
import { WebRTCManager } from '@/services/webrtc';
import type { SignalData } from 'simple-peer';
import { useSignalingStore } from './useSignalingStore';
import { useChatStore, FileMetadata } from './useChatStore';
import { useSessionStore } from './useSessionStore';
import { 
  isValidFileSize, 
  isValidFileType, 
  calculateTotalChunks, 
  calculateOptimalChunkSize 
} from '@/lib/fileTransferUtils';
import { toast } from 'sonner';
import { useWhiteboardStore } from './useWhiteboardStore';

export interface PeerState {
  userId: string;
  nickname: string;
  stream?: MediaStream;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isSharingScreen: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'failed';
  transcript?: { text: string; isFinal: boolean; lang: string };
  isStreamingFile?: boolean;
}

interface ActiveTransfer {
  worker: Worker;
  isPaused: boolean;
  metrics: {
    progress: number;
    sendProgress: number;
    speed: number;
    eta: number;
    chunksAcked: number;
    chunksSent: number;
    totalChunks: number;
    lastUpdateTime: number;
    ackedSize: number;
    sentSize: number;
    averageSpeed?: number;
    totalTransferTime?: number;
  };
}

interface PeerConnectionEvents {
  onData: (peerId: string, data: any) => void;
}

interface PeerConnectionState {
  webRTCManager: WebRTCManager | null;
  peers: Map<string, PeerState>;
  activeTransfers: Map<string, ActiveTransfer>;
  originalStream: MediaStream | null;
}

interface PeerConnectionActions {
  initialize: (localStream: MediaStream, events: PeerConnectionEvents) => void;
  createPeer: (userId: string, nickname: string, initiator: boolean) => void;
  updateIceServers: (servers: RTCIceServer[]) => void;
  receiveSignal: (from: string, nickname: string, signal: SignalData) => void;
  removePeer: (userId: string) => void;
  sendToAllPeers: (message: any) => { successful: string[], failed: string[] };
  sendToPeer: (peerId: string, message: any) => boolean;
  cleanup: () => void;
  updatePeerMediaState: (userId: string, kind: 'audio' | 'video', enabled: boolean) => void;
  updatePeerStreamingState: (userId: string, isStreaming: boolean) => void;
  updatePeerScreenShareState: (userId: string, isSharing: boolean) => void;
  sendFile: (file: File) => Promise<void>;
  pauseFileTransfer: (transferId: string) => void;
  resumeFileTransfer: (transferId: string) => void;
  cancelFileTransfer: (transferId: string) => void;
  replaceSenderTrack: (kind: 'audio' | 'video', newTrack?: MediaStreamTrack) => Promise<boolean>;
}

// 버퍼 임계값 (16MB)
const BUFFER_HIGH_WATERMARK = 16 * 1024 * 1024;

export const usePeerConnectionStore = create<PeerConnectionState & PeerConnectionActions>(
  (set, get) => ({
    webRTCManager: null,
    peers: new Map(),
    activeTransfers: new Map(),
    originalStream: null,

    initialize: (localStream, events) => {
      const webRTCManager = new WebRTCManager(localStream, {
        onSignal: (peerId, signal) => useSignalingStore.getState().sendSignal(peerId, signal),
        onConnect: (peerId) =>
          set(
            produce((state) => {
              const peer = state.peers.get(peerId);
              if (peer) peer.connectionState = 'connected';
            })
          ),
        onStream: (peerId, stream) =>
          set(
            produce((state) => {
              const peer = state.peers.get(peerId);
              if (peer) peer.stream = stream;
            })
          ),
        onData: (peerId, data) => {
          try {
            const msg = JSON.parse(data);

            // ACK 처리
            if (msg.type === 'file-ack') {
              const transfer = get().activeTransfers.get(msg.payload.transferId);
              if (transfer) {
                transfer.worker.postMessage({ type: 'ack-received', payload: msg.payload });
              }
              return;
            }

            // 취소 처리
            if (msg.type === 'file-cancel') {
              useChatStore.getState().handleFileCancel(msg.payload.transferId);
              return;
            }

            // Whiteboard 메시지 처리
            if (msg.type === 'whiteboard-operation') {
              useWhiteboardStore.getState().addOperation(msg.payload);
              return;
            }

            if (msg.type === 'whiteboard-clear') {
              useWhiteboardStore.getState().clearOperations();
              return;
            }

            if (msg.type === 'whiteboard-delete') {
              msg.payload.operationIds.forEach((id: string) => {
                useWhiteboardStore.getState().removeOperation(id);
              });
              return;
            }

            if (msg.type === 'whiteboard-update') {
              useWhiteboardStore.getState().addOperation(msg.payload);
              return;
            }

            if (msg.type === 'whiteboard-background') {
              useWhiteboardStore.getState().setBackground(msg.payload);
              return;
            }
          } catch (e) {
            // JSON 파싱 실패 시 바이너리 데이터로 처리
          }

          events.onData(peerId, data);
        },
        onClose: (peerId) => get().removePeer(peerId),
        onError: (peerId, error) => {
          console.error(`[PeerConnection] Error on peer ${peerId}:`, error);
          set(
            produce((state) => {
              const peer = state.peers.get(peerId);
              if (peer) peer.connectionState = 'failed';
            })
          );
        },
      });

      set({ webRTCManager, originalStream: localStream });
    },

    createPeer: (userId, nickname, initiator) => {
      get().webRTCManager?.createPeer(userId, initiator);
      set(
        produce((state) => {
          state.peers.set(userId, {
            userId,
            nickname,
            audioEnabled: true,
            videoEnabled: true,
            isSharingScreen: false,
            connectionState: 'connecting',
            isStreamingFile: false,
          });
        })
      );
    },

    updateIceServers: (servers) => get().webRTCManager?.updateIceServers(servers),

    receiveSignal: (from, nickname, signal) => {
      const { webRTCManager, peers } = get();
      if (!webRTCManager) return;
      if (!peers.has(from)) {
        get().createPeer(from, nickname, false);
      }
      webRTCManager.receiveSignal(from, signal);
    },

    removePeer: (userId) => {
      get().webRTCManager?.removePeer(userId);
      set(
        produce((state) => {
          state.peers.delete(userId);
          if (state.peers.size === 0) {
            state.activeTransfers.forEach((_, transferId) => {
              get().cancelFileTransfer(transferId);
            });
          }
        })
      );
    },

    sendToAllPeers: (message) =>
      get().webRTCManager?.sendToAllPeers(message) ?? { successful: [], failed: [] },

    sendToPeer: (peerId, message) => get().webRTCManager?.sendToPeer(peerId, message) ?? false,

    sendFile: async (file: File) => {
      if (!isValidFileSize(file.size)) {
        toast.error('File is too large (max 4GB).');
        return;
      }
      if (!isValidFileType(file)) {
        toast.error('This file type is not allowed for security reasons.');
        return;
      }

      const { webRTCManager, peers } = get();
      if (!webRTCManager || peers.size === 0) {
        toast.warning('No peers connected to send the file.');
        return;
      }

      const transferId = `${file.name}-${file.size}-${Date.now()}`;
      const chunkSize = calculateOptimalChunkSize(file.size);
      const totalChunks = calculateTotalChunks(file.size, chunkSize);

      const fileMeta: FileMetadata = {
        transferId,
        name: file.name,
        size: file.size,
        type: file.type,
        totalChunks,
        chunkSize,
      };

      const { userId, nickname } = useSessionStore.getState().getSessionInfo()!;

      // 이미지 파일인 경우 미리보기 URL 생성
      let previewUrl: string | undefined;
      if (file.type.startsWith('image/')) {
        previewUrl = URL.createObjectURL(file);
      }

      await useChatStore.getState().addFileMessage(userId, nickname, fileMeta, true, previewUrl);
      get().sendToAllPeers(JSON.stringify({ type: 'file-meta', payload: fileMeta }));

      const worker = new Worker(new URL('../workers/file.worker.ts', import.meta.url), {
        type: 'module',
      });

      worker.onmessage = (event) => {
        const { type, payload } = event.data;
        const { webRTCManager: currentWebRTCManager, activeTransfers } = get();
        if (!currentWebRTCManager) return;

        switch (type) {
          case 'chunk-ready':
            currentWebRTCManager.sendToAllPeers(payload.chunk);
            
            // 버퍼 관리
            const peerIds = currentWebRTCManager.getConnectedPeerIds();
            let totalBufferedAmount = 0;
            peerIds.forEach(id => {
              totalBufferedAmount += currentWebRTCManager.getBufferedAmount(id) || 0;
            });
            
            worker.postMessage({
              type: 'set-sending-status',
              payload: { canSend: totalBufferedAmount < BUFFER_HIGH_WATERMARK }
            });
            break;

          case 'progress-update':
            set(
              produce((state) => {
                const transfer = state.activeTransfers.get(payload.transferId);
                if (transfer) {
                  transfer.metrics = {
                    progress: payload.totalSize > 0 ? payload.ackedSize / payload.totalSize : 0,
                    sendProgress: payload.totalSize > 0 ? payload.sentSize / payload.totalSize : 0,
                    speed: payload.speed,
                    eta: payload.eta,
                    chunksAcked: payload.ackedChunks,
                    chunksSent: payload.sentChunks,
                    totalChunks: payload.totalChunks,
                    lastUpdateTime: Date.now(),
                    ackedSize: payload.ackedSize,
                    sentSize: payload.sentSize,
                  };
                }
              })
            );
            break;

          case 'transfer-complete':
            console.log(`[PeerStore] Transfer complete: ${payload.transferId}`);
            set(
              produce((state) => {
                const transfer = state.activeTransfers.get(payload.transferId);
                if (transfer) {
                  transfer.metrics.progress = 1;
                  transfer.metrics.sendProgress = 1;
                  transfer.metrics.speed = 0;
                  transfer.metrics.eta = 0;
                  transfer.metrics.averageSpeed = payload.averageSpeed;
                  transfer.metrics.totalTransferTime = payload.totalTime;
                }
              })
            );

            useChatStore
              .getState()
              .updateFileTransferState(payload.transferId, { 
                isSending: false, 
                isComplete: true,
                averageSpeed: payload.averageSpeed,
                totalTransferTime: payload.totalTime * 1000
              });

            activeTransfers.get(payload.transferId)?.worker.terminate();
            activeTransfers.delete(payload.transferId);
            break;

          case 'transfer-cancelled':
          case 'transfer-error':
            console.error(`[PeerStore] Transfer failed/cancelled: ${payload.reason}`);
            activeTransfers.get(payload.transferId)?.worker.terminate();
            activeTransfers.delete(payload.transferId);
            useChatStore
              .getState()
              .updateFileTransferState(payload.transferId, { isSending: false, isCancelled: true });
            break;
        }
      };

      worker.postMessage({ type: 'start-transfer', payload: { file, transferId, chunkSize } });

      set(
        produce((state) => {
          state.activeTransfers.set(transferId, {
            worker,
            isPaused: false,
            metrics: {
              progress: 0,
              sendProgress: 0,
              speed: 0,
              eta: Infinity,
              chunksAcked: 0,
              chunksSent: 0,
              totalChunks,
              lastUpdateTime: 0,
              ackedSize: 0,
              sentSize: 0,
            },
          });
        })
      );

      toast.info(`Sending file: ${file.name}`);
    },

    pauseFileTransfer: (transferId) => {
      const transfer = get().activeTransfers.get(transferId);
      if (transfer && !transfer.isPaused) {
        transfer.worker.postMessage({ type: 'pause-transfer' });
        set(
          produce((state) => {
            state.activeTransfers.get(transferId)!.isPaused = true;
          })
        );
        toast.info('File transfer paused.');
      }
    },

    resumeFileTransfer: (transferId) => {
      const transfer = get().activeTransfers.get(transferId);
      if (transfer && transfer.isPaused) {
        transfer.worker.postMessage({ type: 'resume-transfer' });
        set(
          produce((state) => {
            state.activeTransfers.get(transferId)!.isPaused = false;
          })
        );
        toast.success('File transfer resumed.');
      }
    },

    cancelFileTransfer: (transferId: string) => {
      const transfer = get().activeTransfers.get(transferId);
      if (transfer) {
        transfer.worker.postMessage({ type: 'cancel-transfer' });
        get().sendToAllPeers(JSON.stringify({ type: 'file-cancel', payload: { transferId } }));
        set(
          produce((state) => {
            state.activeTransfers.delete(transferId);
          })
        );
        useChatStore
          .getState()
          .updateFileTransferState(transferId, { isSending: false, isCancelled: true });
        toast.error('File transfer cancelled.');
      }
    },

    cleanup: () => {
      get().webRTCManager?.destroyAll();
      get().activeTransfers.forEach((t) => t.worker.terminate());
      set({
        webRTCManager: null,
        peers: new Map(),
        activeTransfers: new Map(),
        originalStream: null,
      });
    },

    updatePeerMediaState: (userId, kind, enabled) =>
      set(
        produce((state) => {
          const peer = state.peers.get(userId);
          if (peer) {
            if (kind === 'audio') peer.audioEnabled = enabled;
            else if (kind === 'video') peer.videoEnabled = enabled;
          }
        })
      ),

    updatePeerStreamingState: (userId, isStreaming) =>
      set(
        produce((state) => {
          const peer = state.peers.get(userId);
          if (peer) peer.isStreamingFile = isStreaming;
        })
      ),

    updatePeerScreenShareState: (userId, isSharing) =>
      set(
        produce((state) => {
          const peer = state.peers.get(userId);
          if (peer) {
            peer.isSharingScreen = isSharing;
          }
        })
      ),

    replaceSenderTrack: async (kind, newTrack) => {
      const { webRTCManager } = get();
      if (!webRTCManager) {
        console.error('[PeerConnection] WebRTCManager not initialized');
        return false;
      }
      return webRTCManager.replaceSenderTrack(kind, newTrack);
    },
  })
);
