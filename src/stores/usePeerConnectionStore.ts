import { create } from 'zustand';
import { produce } from 'immer';
import { WebRTCManager } from '@/services/webrtc';
import type { SignalData } from 'simple-peer';
import { useSignalingStore } from './useSignalingStore';
import { useChatStore } from './useChatStore';
import type { FileMetadata } from '@/types/chat.types';
import { useSessionStore } from './useSessionStore';
import { isValidFileSize, isValidFileType, calculateTotalChunks, calculateOptimalChunkSize } from '@/lib/fileTransfer/fileTransferUtils';
import { toast } from 'sonner';
import { useWhiteboardStore } from './useWhiteboardStore';
import { nanoid } from 'nanoid';

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
  initializedTransfers: Set<string>; // ✅ 초기화 플래그 추가
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

const BUFFER_HIGH_WATERMARK = 16 * 1024 * 1024;

// ✅ 파일 체크섬 계산 함수
async function calculateFileChecksum(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const usePeerConnectionStore = create<PeerConnectionState & PeerConnectionActions>((set, get) => ({
  webRTCManager: null,
  peers: new Map(),
  activeTransfers: new Map(),
  originalStream: null,
  initializedTransfers: new Set(), // ✅ 초기화 플래그 초기화

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
        const run = async () => {
          if (typeof data === 'string') {
            try {
              const msg = JSON.parse(data);
              if (msg?.type === 'file-cancel') {
                useChatStore.getState().handleFileCancel(msg.payload.transferId);
                return;
              }
              if (msg?.type === 'file-meta') {
                const peer = get().peers.get(peerId);
                const nickname = peer?.nickname || 'Unknown';
                useChatStore.getState().addFileMessage(peerId, nickname, msg.payload, false);
                return;
              }
              if (msg?.type === 'whiteboard-operation') {
                useWhiteboardStore.getState().addOperation(msg.payload);
                return;
              }
              if (msg?.type === 'whiteboard-clear') {
                useWhiteboardStore.getState().clearOperations();
                return;
              }
              if (msg?.type === 'whiteboard-delete') {
                msg.payload.operationIds.forEach((id: string) => useWhiteboardStore.getState().removeOperation(id));
                return;
              }
              if (msg?.type === 'whiteboard-update') {
                useWhiteboardStore.getState().addOperation(msg.payload);
                return;
              }
              if (msg?.type === 'whiteboard-background') {
                useWhiteboardStore.getState().setBackground(msg.payload);
                return;
              }
            } catch {}
            events.onData(peerId, data);
            return;
          }

          let u8: Uint8Array | null = null;
          if (data instanceof ArrayBuffer) {
            u8 = new Uint8Array(data);
          } else if (ArrayBuffer.isView(data)) {
            const view = data as ArrayBufferView;
            // ✅ SharedArrayBuffer를 새로운 ArrayBuffer로 복사
            const sourceBuffer = view.buffer;
            const byteLength = view.byteLength;
            const arrayBuffer = new ArrayBuffer(byteLength);
            const sourceView = new Uint8Array(sourceBuffer, view.byteOffset, byteLength);
            const targetView = new Uint8Array(arrayBuffer);
            targetView.set(sourceView);
            u8 = new Uint8Array(arrayBuffer);
          } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
            const ab = await data.arrayBuffer();
            u8 = new Uint8Array(ab);
          }

          if (u8 && u8.byteLength) {
            const typeByte = u8[0];
            if (typeByte === 1 || typeByte === 2) {
              const buf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
              useChatStore.getState().handleIncomingChunk(peerId, buf as ArrayBuffer);
              return;
            }
            try {
              const text = new TextDecoder().decode(u8);
              const msg = JSON.parse(text);
              if (msg?.type === 'file-ack') {
                const { transferId, chunkIndex } = msg.payload;
                const transfer = get().activeTransfers.get(transferId);
                
                if (transfer) {
                  // ✅ 중복 ACK 체크
                  const metrics = transfer.metrics;
                  if (chunkIndex < metrics.chunksAcked) {
                    console.warn(`[ACK] Duplicate or out-of-order ACK for chunk ${chunkIndex}`);
                    return;
                  }
                  
                  transfer.worker.postMessage({
                    type: 'ack-received',
                    payload: { chunkIndex },
                  });
                }
                return;
              }
              if (msg?.type === 'file-cancel') {
                useChatStore.getState().handleFileCancel(msg.payload.transferId);
                return;
              }
              if (msg?.type === 'file-meta') {
                const peer = get().peers.get(peerId);
                const nickname = peer?.nickname || 'Unknown';
                
                // ✅ 중복 방지 플래그 확인
                const chatStore = useChatStore.getState();
                
                if (!chatStore.initializedTransfers.has(msg.payload.transferId)) {
                  // ✅ 먼저 플래그 설정 (동기)
                  set(produce((state) => {
                    state.initializedTransfers.add(msg.payload.transferId);
                  }));
                  
                  // ✅ 그 다음 초기화 (비동기)
                  chatStore.addFileMessage(
                    peerId,
                    nickname,
                    msg.payload,
                    false
                  ).then(() => {
                    console.log(`[PeerConnectionStore] ✅ File meta processed: ${msg.payload.transferId}`);
                  });
                } else {
                  console.warn(`[PeerConnectionStore] ⚠️ Duplicate file-meta: ${msg.payload.transferId}`);
                }
                return;
              }
              if (msg?.type === 'whiteboard-operation') {
                useWhiteboardStore.getState().addOperation(msg.payload);
                return;
              }
              if (msg?.type === 'whiteboard-clear') {
                useWhiteboardStore.getState().clearOperations();
                return;
              }
              if (msg?.type === 'whiteboard-delete') {
                msg.payload.operationIds.forEach((id: string) => useWhiteboardStore.getState().removeOperation(id));
                return;
              }
              if (msg?.type === 'whiteboard-update') {
                useWhiteboardStore.getState().addOperation(msg.payload);
                return;
              }
              if (msg?.type === 'whiteboard-background') {
                useWhiteboardStore.getState().setBackground(msg.payload);
                return;
              }
              if (msg?.type === 'file-receiver-complete') {
                // ✅ 수신자 조립 완료 처리
                const { transferId } = msg.payload;
                const transfer = get().activeTransfers.get(transferId);
                
                if (transfer) {
                  console.log(`[PeerConnectionStore] 🎊 Receiver confirmed completion: ${transferId}`);
                  
                  // 송신자 워커에게 수신자 완료 알림
                  transfer.worker.postMessage({
                    type: 'receiver-complete',
                    payload: { transferId }
                  });
                }
                return;
              }
            } catch {}
          }

          events.onData(peerId, data);
        };
        void run();
      },
      onClose: (peerId) => get().removePeer(peerId),
      onError: (peerId) => {
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

  sendToAllPeers: (message) => get().webRTCManager?.sendToAllPeers(message) ?? { successful: [], failed: [] },

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
    if (!webRTCManager) {
      toast.error('WebRTC not initialized');
      return;
    }

    const connectedPeers = Array.from(peers.entries()).filter(([_, peer]) => peer.connectionState === 'connected');
    if (connectedPeers.length === 0) {
      toast.warning('No peers connected to send the file.');
      return;
    }

    const transferId = `t_${Date.now()}_${nanoid(10)}`;
    const initialChunkSize = calculateOptimalChunkSize(file.size);
    const peerIds = webRTCManager.getConnectedPeerIds();
    const maxSizes = peerIds.map((id) => webRTCManager.getMaxMessageSize(id) ?? 16 * 1024);
    const minPeerMax = maxSizes.length > 0 ? Math.min(...maxSizes) : 16 * 1024;
    const idLen = new TextEncoder().encode(transferId).length;
    const headerSize = 1 + 2 + idLen + 4 + 4 + 2 + 64; // ✅ 체크섬 필드 추가
    const safety = 16;
    let chunkSize = Math.max(
      1024,
      Math.min(initialChunkSize, Math.max(1024, minPeerMax - headerSize - safety))
    );
    
    if (!isFinite(chunkSize) || chunkSize <= 0) {
      chunkSize = 16 * 1024;
    }

    const { userId, nickname } = useSessionStore.getState().getSessionInfo()!;
    
    // ✅ 올바른 totalChunks 계산
    const totalChunks = Math.ceil(file.size / chunkSize);
    
    // ✅ 원본 파일 체크섬 계산
    const originalChecksum = await calculateFileChecksum(file);
    console.log(`[PeerConnectionStore] 📊 Original file checksum: ${originalChecksum}`);
    
    // ✅ 검증 로그
    const lastChunkSize = file.size - (totalChunks - 1) * chunkSize;
    console.log(`[PeerConnectionStore] 📊 File transfer setup:`, {
      fileName: file.name,
      fileSize: file.size,
      chunkSize,
      totalChunks,
      lastChunkIndex: totalChunks - 1,
      lastChunkSize,
      calculatedTotalSize: (totalChunks - 1) * chunkSize + lastChunkSize,
      match: (totalChunks - 1) * chunkSize + lastChunkSize === file.size,
    });

    const fileMeta: FileMetadata = {
      transferId,
      name: file.name,
      size: file.size,
      type: file.type,
      totalChunks,
      chunkSize,
      senderId: userId,
      checksum: originalChecksum, // ✅ 체크섬 추가
    };

    let previewUrl: string | undefined;
    if (file.type.startsWith('image/')) {
      previewUrl = URL.createObjectURL(file);
    }

    await useChatStore.getState().addFileMessage(userId, nickname, fileMeta, true, previewUrl);

    const metaMsg = JSON.stringify({ type: 'file-meta', payload: fileMeta });
    get().sendToAllPeers(metaMsg);
    await new Promise((r) => setTimeout(r, 1000));

    const worker = new Worker(new URL('../workers/file-sender.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event) => {
      const { type, payload } = event.data;
      const { webRTCManager: currentWebRTCManager } = get();
      if (!currentWebRTCManager) return;

      switch (type) {
        case 'chunk-ready': {
          const { chunk, chunkIndex } = payload;
          
          console.log(`[PeerConnectionStore] 📤 Sending chunk ${chunkIndex}/${totalChunks - 1}`);
          
          // ✅ 백프레셔 체크를 재귀 함수로 변경
          const BUFFER_THRESHOLD = 4 * 1024 * 1024; // 4MB로 감소
          const MAX_RETRIES = 50; // 최대 5초 대기
          
          const checkBufferAndSend = (retries = 0) => {
            const peerIds = currentWebRTCManager.getConnectedPeerIds();
            const bufferedAmounts = peerIds.map(id =>
              currentWebRTCManager.getBufferedAmount(id) || 0
            );
            const maxBuffered = Math.max(...bufferedAmounts, 0);
            
            if (maxBuffered > BUFFER_THRESHOLD && retries < MAX_RETRIES) {
              console.warn(`[PeerConnectionStore] ⚠️ Buffer full (${maxBuffered} bytes), retry ${retries + 1}/${MAX_RETRIES}`);
              setTimeout(() => checkBufferAndSend(retries + 1), 100);
              return;
            }
            
            // ✅ 버퍼에 여유가 있거나 재시도 한도 초과 시 전송
            currentWebRTCManager.sendToAllPeers(chunk);
            
            if (payload.isLastChunk) {
              console.log(`[PeerConnectionStore] 🏁 Last chunk ${chunkIndex} sent`);
              
              // ✅ 조립 요청 패킷 전송
              const idBytes = new TextEncoder().encode(transferId);
              const endPacket = new ArrayBuffer(1 + 2 + idBytes.length);
              const view = new DataView(endPacket);
              view.setUint8(0, 2); // 패킷 타입 2 = 조립 요청
              view.setUint16(1, idBytes.length, false);
              new Uint8Array(endPacket, 3).set(idBytes);
              
              setTimeout(() => {
                currentWebRTCManager.sendToAllPeers(endPacket);
              }, 500); // 마지막 청크 후 0.5초 대기
            }
          };
          
          checkBufferAndSend();
          break;
        }

        case 'progress': {
          set(
            produce((state) => {
              const transfer = state.activeTransfers.get(payload.transferId);
              if (transfer) {
                transfer.metrics = {
                  progress: payload.progress,
                  sendProgress: payload.progress,
                  speed: payload.speed,
                  eta: payload.eta,
                  chunksAcked: payload.chunksSent,
                  chunksSent: payload.chunksSent,
                  totalChunks: transfer.metrics.totalChunks,
                  lastUpdateTime: Date.now(),
                  ackedSize: payload.bytesSent,
                  sentSize: payload.bytesSent,
                };
              }
            })
          );
          break;
        }

        case 'complete': {
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

          useChatStore.getState().updateFileTransferState(payload.transferId, {
            isSending: false,
            isComplete: true,
            averageSpeed: payload.averageSpeed,
            totalTransferTime: payload.totalTime * 1000,
          });

          const transferToCleanup = get().activeTransfers.get(payload.transferId);
          if (transferToCleanup) {
            transferToCleanup.worker.terminate();
            set(
              produce((state) => {
                state.activeTransfers.delete(payload.transferId);
              })
            );
          }

          toast.success(`File sent: ${file.name}`);
          break;
        }

        case 'cancelled':
        case 'error': {
          const failedTransfer = get().activeTransfers.get(payload.transferId);
          if (failedTransfer) {
            failedTransfer.worker.terminate();
            set(
              produce((state) => {
                state.activeTransfers.delete(payload.transferId);
              })
            );
          }

          useChatStore.getState().updateFileTransferState(payload.transferId, {
            isSending: false,
            isCancelled: true,
          });
          break;
        }
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

    console.log('[sendFile] Transfer started:', {
      transferId,
      fileName: file.name,
      size: file.size,
      chunkSize,
      totalChunks,
      lastChunkIndex: totalChunks - 1,
    });
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
      initializedTransfers: new Set(), // ✅ 초기화 플래그 리셋
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
      return false;
    }
    return webRTCManager.replaceSenderTrack(kind, newTrack);
  },
}));
