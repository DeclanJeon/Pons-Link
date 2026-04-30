import { useChatStore } from '@/stores/useChatStore';
import { useFileStreamingStore } from '@/stores/useFileStreamingStore';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { SignalingEvents, useSignalingStore } from '@/stores/useSignalingStore';
import { useSubtitleStore } from '@/stores/useSubtitleStore';
import { useTranscriptionStore } from '@/stores/useTranscriptionStore';
import { useUIManagementStore } from '@/stores/useUIManagementStore';
import { useWhiteboardStore } from '@/stores/useWhiteboardStore';
import { useCoWatchStore } from '@/stores/useCoWatchStore';
import { RoomType } from '@/types/room.types';
import { produce } from 'immer';
import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { toast } from 'sonner';
import { useSessionStore } from '@/stores/useSessionStore';
import { useRoomUpgradeStore } from '@/stores/useRoomUpgradeStore';
import { normalizeYouTubeURL } from '@/lib/cowatch/url-validator';
import type { ChatMessage, FileMetadata } from '@/types/chat.types';
import type { CanvasBackground, DrawOperation, RemoteCursor } from '@/types/whiteboard.types';
import { PONSCAST_METADATA_EVENT, PONSCAST_STREAM_END_EVENT, type PonsCastStreamMetadata } from '@/lib/ponscast/protocol';
import { buildRoomFullFallbackUrl } from './roomFullFallbackUrl';

interface RoomParams {
  roomId: string;
  userId: string;
  nickname: string;
  localStream: MediaStream;
  roomType?: RoomType;
}

type SubtitleStatePayload = Parameters<ReturnType<typeof useSubtitleStore.getState>['receiveSubtitleState']>[0];
type SubtitleTrackMetaPayload = Parameters<ReturnType<typeof useSubtitleStore.getState>['receiveTrackMeta']>[0];
type SubtitleTrackChunkPayload = Parameters<ReturnType<typeof useSubtitleStore.getState>['receiveTrackChunk']>[0];
type SubtitleRemoteEnablePayload = Parameters<ReturnType<typeof useSubtitleStore.getState>['receiveRemoteEnable']>[0];

type ChannelMessage =
  | { type: 'chat'; payload: ChatMessage }
  | { type: 'typing-state'; payload: { isTyping: boolean } }
  | { type: 'whiteboard-operation'; payload: DrawOperation }
  | { type: 'whiteboard-cursor'; payload: RemoteCursor }
  | { type: 'whiteboard-clear'; payload: Record<string, never> }
  | { type: 'whiteboard-delete'; payload: { operationIds: string[] } }
  | { type: 'whiteboard-update'; payload: { id: string; updates: Partial<DrawOperation> } }
  | { type: 'whiteboard-undo'; payload: { userId: string; timestamp: number } }
  | { type: 'whiteboard-redo'; payload: { userId: string; timestamp: number } }
  | { type: 'whiteboard-sync'; payload: { operations: [string, DrawOperation][]; historyIndex?: number } }
  | { type: 'whiteboard-drag-update'; payload: { operationId: string; updates: Partial<DrawOperation> } }
  | { type: 'whiteboard-background'; payload: Partial<CanvasBackground> }
  | { type: 'file-meta'; payload: FileMetadata; data?: FileMetadata }
  | { type: 'file-ack'; payload: { transferId: string; chunkIndex: number } }
  | { type: 'transcription'; payload: { text: string; isFinal: boolean; lang: string; provider?: string; translatedText?: string; translatedLang?: string } }
  | { type: 'subtitle-sync'; payload: { currentTime: number; cueId: string | null; activeTrackId: string | null; timestamp: number } }
  | { type: 'subtitle-seek'; payload: { currentTime: number; timestamp: number } }
  | { type: 'subtitle-state'; payload: SubtitleStatePayload }
  | { type: 'subtitle-track-meta'; payload: SubtitleTrackMetaPayload }
  | { type: 'subtitle-track-chunk'; payload: SubtitleTrackChunkPayload }
  | { type: 'subtitle-remote-enable'; payload: SubtitleRemoteEnablePayload }
  | { type: 'file-streaming-state'; payload: { isStreaming: boolean; fileType: string } }
  | { type: 'screen-share-state'; payload: { isSharing: boolean } }
  | { type: 'clickcap-capture-state'; payload: { isSharing: boolean } }
  | { type: 'pdf-metadata'; payload: { currentPage: number; totalPages: number; fileName: string } }
  | { type: 'pdf-page-change'; payload: { currentPage: number; totalPages: number; scale: number; rotation: number } }
  | { type: 'cowatch-control'; payload: { cmd: 'play' | 'pause' | 'seek' | 'mute' | 'unmute' | 'volume' | 'captions' | 'rate'; time?: number; volume?: number; captions?: boolean; rate?: number } }
  | { type: 'cowatch-load'; payload: { url: string; ownerId: string; ownerName: string; tabId: string; provider?: 'youtube'; title?: string; timestamp?: number } }
  | { type: 'cowatch-activate'; payload: { tabId: string } }
  | { type: 'cowatch-close'; payload: { tabId: string } }
  | { type: 'cowatch-close-request'; payload: { tabId: string } }
  | { type: 'cowatch-host'; payload: { hostId: string } }
  | { type: 'cowatch-state'; payload: { tabId: string | null; playing: boolean; currentTime: number; duration: number; muted: boolean; volume: number; captions: boolean; rate: number } }
  | { type: 'ponscast'; payload: { action: 'next' | 'prev' | 'jump'; index?: number } }
  | { type: 'ponscast-stream-meta'; payload: PonsCastStreamMetadata }
  | { type: 'ponscast-stream-end'; payload: { streamId?: string; endedAt?: number } };

function isChannelMessage(obj: unknown): obj is ChannelMessage {
  return obj !== null && typeof obj === 'object' && typeof (obj as { type: unknown }).type === 'string';
}

type RealtimeEnvelope = {
  __rt: 'v1';
  msgId: string;
  seq: number;
  epoch: string;
  sentAt: number;
  payload: unknown;
};

function isRealtimeEnvelope(value: unknown): value is RealtimeEnvelope {
  if (!value || typeof value !== 'object') return false;
  const envelope = value as Partial<RealtimeEnvelope>;
  return envelope.__rt === 'v1'
    && typeof envelope.msgId === 'string'
    && typeof envelope.seq === 'number'
    && typeof envelope.epoch === 'string';
}

// 메시지 핸들러 맵으로 분기 최적화
type MessageHandler = (peerId: string, payload: unknown, senderNickname: string) => void;

const createMessageHandlers = (
  pendingCoWatchStateRef: MutableRefObject<Map<string, { playing: boolean; currentTime: number; duration: number; muted: boolean; volume: number; captions: boolean; rate: number }>>
): Record<string, MessageHandler> => ({
  'cowatch-control': (peerId, payload) => {
    const { cmd, time, volume, captions, rate } = (payload || {}) as { cmd?: string; time?: number; volume?: number; captions?: boolean; rate?: number };
    const store = useCoWatchStore.getState();

    if (!store.activeTabId) {
      return;
    }
    
    const handlers: Record<string, () => void> = {
      'play': () => store.applyRemote({ playing: true }),
      'pause': () => store.applyRemote({ playing: false }),
      'seek': () => typeof time === 'number' && store.applyRemote({ currentTime: time }),
      'mute': () => store.applyRemote({ muted: true }),
      'unmute': () => store.applyRemote({ muted: false }),
      'volume': () => typeof volume === 'number' && store.applyRemote({ volume }),
      'captions': () => store.applyRemote({ captions: !!captions }),
      'rate': () => typeof rate === 'number' && store.applyRemote({ rate })
    };
    
    handlers[cmd]?.();
  },
  
  'cowatch-load': (peerId, payload) => {
    const store = useCoWatchStore.getState();
    const ui = useUIManagementStore.getState();
    const { url, ownerId, ownerName, provider, title, tabId, timestamp } = (payload || {}) as { url?: string; ownerId?: string; ownerName?: string; provider?: 'youtube'; title?: string; tabId?: string; timestamp?: number };
    
    if (!url || !ownerId) {
      console.warn('[RoomOrchestrator] Invalid cowatch-load payload:', payload);
      return;
    }
    
    const me = useSessionStore.getState().userId;
    
    if (ownerId === me) {
      console.log('[RoomOrchestrator] Ignoring own cowatch-load message');
      return;
    }
    
    console.log('[RoomOrchestrator] Received cowatch-load from peer:', {
      from: peerId,
      url,
      ownerId,
      ownerName,
      tabId,
      timestamp: timestamp ? new Date(timestamp).toISOString() : 'N/A',
      currentPanel: ui.activePanel
    });
    
    const NOTIFICATION_COOLDOWN = 2000;
    const now = Date.now();
    
    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeYouTubeURL(url);
    } catch (error) {
      console.error('[RoomOrchestrator] Failed to normalize URL:', error);
      normalizedUrl = url;
    }
    
    const lastNotificationKey = `cowatch-notify-${normalizedUrl}-${ownerId}`;
    const lastNotificationTime = sessionStorage.getItem(lastNotificationKey);
    const isCoWatchPanelOpen = ui.activePanel === 'cowatch';
    
    const timeSinceLastNotification = lastNotificationTime
      ? now - parseInt(lastNotificationTime)
      : Infinity;
    
    const shouldNotify = timeSinceLastNotification > NOTIFICATION_COOLDOWN;
    
    console.log('[RoomOrchestrator] Notification check:', {
      shouldNotify,
      timeSinceLastNotification,
      cooldown: NOTIFICATION_COOLDOWN,
      lastNotificationKey
    });
    
    const existingTab = store.tabs.find(tab => {
      try {
        const tabNormalizedUrl = normalizeYouTubeURL(tab.url);
        return tabNormalizedUrl === normalizedUrl && tab.ownerId === ownerId;
      } catch {
        return tab.url === url && tab.ownerId === ownerId;
      }
    });
    
    let newTabId: string;
    
    if (existingTab) {
      console.log('[RoomOrchestrator] Tab already exists:', existingTab.id);
      newTabId = existingTab.id;
      
      if (title && existingTab.title !== title) {
        store.updateTabMeta(existingTab.id, { title });
      }
      
      if (!shouldNotify) {
        const pendingState = pendingCoWatchStateRef.current.get(existingTab.id);
        if (pendingState) {
          store.applyRemote(pendingState);
          pendingCoWatchStateRef.current.delete(existingTab.id);
        }
        console.log('[RoomOrchestrator] Skipping notification (cooldown active)');
        return;
      }
    } else {
      console.log('[RoomOrchestrator] Creating new tab from remote');
      newTabId = store.addTabFromRemote(normalizedUrl, ownerId, ownerName || 'Unknown', provider || 'youtube');
      
      if (title) {
        store.updateTabMeta(newTabId, { title });
      }
    }

    const pendingState = pendingCoWatchStateRef.current.get(newTabId);
    if (pendingState) {
      store.applyRemote(pendingState);
      pendingCoWatchStateRef.current.delete(newTabId);
    }
    
    if (!store.hostId) {
      console.log('[RoomOrchestrator] Setting initial host:', ownerId);
      store.setHost(ownerId || me || '');
    }
    
    if (shouldNotify) {
      const name = ownerName || 'Someone';
      const videoTitle = title || 'a video';
      
      sessionStorage.setItem(lastNotificationKey, now.toString());
      
      console.log('[RoomOrchestrator] Showing notification:', {
        name,
        videoTitle,
        isCoWatchPanelOpen,
        tabId: newTabId
      });
      
      try {
        if (isCoWatchPanelOpen) {
          console.log('[RoomOrchestrator] Calling toast.success...');
          const toastId = toast.success(`${name} loaded "${videoTitle}"`, {
            duration: 4000,
            position: 'top-right',
            action: {
              label: 'Switch',
              onClick: () => {
                console.log('[Toast] Switch button clicked, activating tab:', newTabId);
                store.setActiveTab(newTabId);
              }
            }
          });
          console.log('[RoomOrchestrator] Toast displayed with ID:', toastId);
        } else {
          console.log('[RoomOrchestrator] Calling toast...');
          const toastId = toast(`${name} invited you to watch "${videoTitle}"`, {
            duration: 6000,
            position: 'top-center',
            action: {
              label: 'Join CoWatch',
              onClick: () => {
                console.log('[Toast] Join button clicked, opening panel and activating tab:', newTabId);
                ui.setActivePanel('cowatch');
                setTimeout(() => {
                  store.setActiveTab(newTabId);
                }, 150);
              }
            }
          });
          console.log('[RoomOrchestrator] Toast displayed with ID:', toastId);
        }
      } catch (error) {
        console.error('[RoomOrchestrator] Failed to show toast:', error);
      }
    } else {
      console.log('[RoomOrchestrator] Notification skipped (cooldown):', {
        timeSinceLastNotification,
        cooldown: NOTIFICATION_COOLDOWN
      });
    }
  },
  
  'cowatch-state': (peerId, payload) => {
    const store = useCoWatchStore.getState();
    const me = useSessionStore.getState().userId;
    
    // 호스트는 무시
    if (store.role === 'host' && store.hostId === me) return;
    
    const { tabId, ...mediaState } = (payload || {}) as { tabId?: string | null; playing?: boolean; currentTime?: number; duration?: number; muted?: boolean; volume?: number; captions?: boolean; rate?: number };

    if (tabId) {
      const tab = store.tabs.find(t => t.id === tabId);
      if (!tab) {
        pendingCoWatchStateRef.current.set(tabId, mediaState);
        return;
      }
    }
    
    // 탭 전환 필요 시에만
    if (tabId && store.activeTabId !== tabId) {
      const tab = store.tabs.find(t => t.id === tabId);
      if (tab) store.setActiveTab(tabId);
    }
    
    // 미디어 상태 적용
    store.applyRemote(mediaState);
  }
});

// ICE servers가 준비될 때까지 짧게 대기한다. TURN이 늦으면 STUN으로 먼저 연결을 시작한다.
const waitForIceServers = (timeout = 1500): Promise<boolean> => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    const effectiveTimeout = isMobile ? Math.max(timeout, 2500) : timeout;
    const fallbackReadyDelay = isMobile ? 600 : 250;
    
    const check = () => {
      const { iceServersReady, iceServers } = useSignalingStore.getState();
      
      if (iceServersReady && iceServers && iceServers.length > 0) {
        const hasTurn = iceServers.some(server => {
          const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
          return urls.some(url => url.startsWith('turn:') || url.startsWith('turns:'));
        });
        
        if (hasTurn || !isMobile || Date.now() - startTime >= fallbackReadyDelay) {
          console.log(`[RoomOrchestrator] ✅ ICE servers ready (${isMobile ? 'Mobile' : 'Desktop'}, TURN: ${hasTurn})`);
          resolve(true);
          return;
        }
        
        // 모바일인데 TURN이 없으면 더 기다림
        if (Date.now() - startTime < effectiveTimeout) {
          setTimeout(check, 200);
          return;
        }
      }
      
      if (Date.now() - startTime > effectiveTimeout) {
        console.warn(`[RoomOrchestrator] ⚠️ ICE servers timeout (${isMobile ? 'Mobile' : 'Desktop'}), proceeding with available servers`);
        resolve(false);
        return;
      }
      
      setTimeout(check, 100);
    };
    
    check();
  });
};

export const useRoomOrchestrator = (params: RoomParams | null) => {
  const { connect, disconnect } = useSignalingStore();
  const {
    initialize: initPeerConnection,
    cleanup: cleanupPeerConnection,
    createPeer,
    receiveSignal,
    removePeer,
    updatePeerMediaState,
    updatePeerStreamingState,
    updatePeerScreenShareState,
    updatePeerClickCapState
  } = usePeerConnectionStore();
  const { addMessage, setTypingState, handleIncomingChunk, addFileMessage } = useChatStore();
  const { incrementUnreadMessageCount, setMainContentParticipant } = useUIManagementStore();
  const {
    cleanup: cleanupTranscription,
    handleIncomingTranscription,
  } = useTranscriptionStore();
  const {
    receiveSubtitleState,
    receiveSubtitleSync,
    receiveRemoteEnable,
    receiveTrackMeta,
    receiveTrackChunk
  } = useSubtitleStore();
  const { isStreaming: isLocalStreaming } = useFileStreamingStore();
  const inboundSeenRef = useRef<Map<string, number>>(new Map());
  const inboundSeqRef = useRef<Map<string, number>>(new Map());
  const pendingCoWatchStateRef = useRef<Map<string, { playing: boolean; currentTime: number; duration: number; muted: boolean; volume: number; captions: boolean; rate: number }>>(new Map());
  const pendingWhiteboardUpdatesRef = useRef<Map<string, Array<{ updates: Partial<DrawOperation> }>>>(new Map());
  
  // 메시지 핸들러 맵 생성 (한 번만 생성)
  const messageHandlers = useMemo(() => createMessageHandlers(pendingCoWatchStateRef), []);
  
  const handleChannelMessage = useCallback((peerId: string, data: ArrayBuffer | string) => {
    let dataString: string;

    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      // Convert to ArrayBuffer to handle both ArrayBuffer and SharedArrayBuffer
      let buf: ArrayBuffer;
      
      if (ArrayBuffer.isView(data)) {
        const view = data as ArrayBufferView;
        // Create a new ArrayBuffer to ensure it's not a SharedArrayBuffer
        const tempArray = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
        buf = new ArrayBuffer(tempArray.byteLength);
        new Uint8Array(buf).set(tempArray);
      } else {
        // Explicitly convert to ArrayBuffer by copying the data
        const tempArray = new Uint8Array(data as ArrayBuffer);
        buf = new ArrayBuffer(tempArray.byteLength);
        new Uint8Array(buf).set(tempArray);
      }
      
      if (buf.byteLength >= 3) {
        const view = new DataView(buf);
        const type = view.getUint8(0);
        
        if (type === 1 || type === 2) {
          handleIncomingChunk(peerId, buf);
          return;
        }
      }

      dataString = new TextDecoder().decode(buf);
    } else {
      dataString = data;
    }

    try {
      const parsedData = JSON.parse(dataString);
      let normalizedData: unknown = parsedData;

      if (isRealtimeEnvelope(parsedData)) {
        const now = Date.now();
        const seenKey = `${peerId}:${parsedData.epoch}:${parsedData.msgId}`;
        const previousSeenAt = inboundSeenRef.current.get(seenKey);
        if (previousSeenAt && now - previousSeenAt < 10 * 60 * 1000) {
          return;
        }

        const seqKey = `${peerId}:${parsedData.epoch}`;
        const lastSeq = inboundSeqRef.current.get(seqKey) ?? 0;
        if (parsedData.seq <= lastSeq) {
          inboundSeenRef.current.set(seenKey, now);
          return;
        }

        inboundSeenRef.current.set(seenKey, now);
        inboundSeqRef.current.set(seqKey, parsedData.seq);
        normalizedData = parsedData.payload;

        if (inboundSeenRef.current.size > 3000) {
          const pruneBefore = now - (10 * 60 * 1000);
          for (const [key, seenAt] of inboundSeenRef.current.entries()) {
            if (seenAt < pruneBefore) {
              inboundSeenRef.current.delete(key);
            }
          }
        }
      }
      
      if (!isChannelMessage(normalizedData)) {
        return;
      }

      const channelMessage = normalizedData;

      const sender = usePeerConnectionStore.getState().peers.get(peerId);
      const senderNickname = sender ? sender.nickname : 'Unknown';

      // CoWatch 관련 메시지는 핸들러 맵 사용
      if (channelMessage.type in messageHandlers) {
        messageHandlers[channelMessage.type](peerId, channelMessage.payload, senderNickname);
        return;
      }

      // 그 외 메시지는 기존 switch 문 사용
      switch (channelMessage.type) {
        case 'chat': {
          addMessage(channelMessage.payload);
          if (useUIManagementStore.getState().activePanel !== 'chat') {
            incrementUnreadMessageCount();
          }
          break;
        }
        
        case 'typing-state': {
          if (sender) setTypingState(peerId, sender.nickname, channelMessage.payload.isTyping);
          break;
        }
        
        case 'whiteboard-operation': {
          const whiteboardStore = useWhiteboardStore.getState();
          whiteboardStore.addOperation(channelMessage.payload);

          const operationId = (channelMessage.payload as { id?: string })?.id;
          if (operationId) {
            const pendingUpdates = pendingWhiteboardUpdatesRef.current.get(operationId);
            if (pendingUpdates && pendingUpdates.length > 0) {
              pendingUpdates.forEach((item) => {
                whiteboardStore.updateOperation(operationId, item.updates);
              });
              pendingWhiteboardUpdatesRef.current.delete(operationId);
            }
          }

          whiteboardStore.pushHistory();
          break;
        }
        
        case 'whiteboard-cursor': {
          useWhiteboardStore.getState().updateRemoteCursor(channelMessage.payload);
          break;
        }
        
        case 'whiteboard-clear': {
          useWhiteboardStore.getState().clearOperations();
          break;
        }
        
        case 'whiteboard-delete': {
          channelMessage.payload.operationIds.forEach((id: string) => {
            useWhiteboardStore.getState().removeOperation(id);
          });
          useWhiteboardStore.getState().pushHistory();
          break;
        }
        
        case 'whiteboard-update': {
          const whiteboardStore = useWhiteboardStore.getState();
          const operationId = channelMessage.payload.id;
          const operation = whiteboardStore.getOperation(operationId);

          if (!operation) {
            const pending = pendingWhiteboardUpdatesRef.current.get(operationId) ?? [];
            pending.push({ updates: channelMessage.payload.updates });
            pendingWhiteboardUpdatesRef.current.set(operationId, pending);
            break;
          }

          whiteboardStore.updateOperation(operationId, channelMessage.payload.updates);
          whiteboardStore.pushHistory();
          break;
        }

        case 'whiteboard-undo': {
          useWhiteboardStore.getState().undo();
          break;
        }

        case 'whiteboard-redo': {
          useWhiteboardStore.getState().redo();
          break;
        }

        case 'whiteboard-sync': {
          const { operations: opsArray, historyIndex } = channelMessage.payload;
          const opsMap = new Map(opsArray);
          if (historyIndex !== undefined) {
            useWhiteboardStore.getState().syncHistory(opsMap, historyIndex);
          } else {
            useWhiteboardStore.getState().setOperations(opsMap);
          }
          break;
        }

        case 'whiteboard-drag-update': {
          const whiteboardStore = useWhiteboardStore.getState();
          const operationId = channelMessage.payload.operationId;
          const operation = whiteboardStore.getOperation(operationId);

          if (!operation) {
            const pending = pendingWhiteboardUpdatesRef.current.get(operationId) ?? [];
            pending.push({ updates: channelMessage.payload.updates });
            pendingWhiteboardUpdatesRef.current.set(operationId, pending);
            break;
          }

          whiteboardStore.updateOperation(operationId, channelMessage.payload.updates);
          break;
        }
        
        case 'whiteboard-background': {
          useWhiteboardStore.getState().setBackground(channelMessage.payload);
          break;
        }
        
        case 'file-meta': {
          const meta = channelMessage.payload;
          if (meta) {
            // ✅ 순서 보장: 먼저 초기화, 그 다음 청크 수신 허용
            const chatStore = useChatStore.getState();
            
            if (!chatStore.initializedTransfers.has(meta.transferId)) {
              // ✅ 동기적으로 초기화 완료 대기
              addFileMessage(peerId, senderNickname, meta, false).then(() => {
                console.log(`[RoomOrchestrator] ✅ Ready to receive chunks for ${meta.transferId}`);
              });
            }
          }
          break;
        }
        
        case 'file-ack': {
          const transfer = usePeerConnectionStore.getState().activeTransfers.get(channelMessage.payload.transferId);
          if (transfer) {
            transfer.worker.postMessage({ 
              type: 'ack-received', 
              payload: channelMessage.payload 
            });
          }
          break;
        }
        
        case 'transcription': {
          handleIncomingTranscription(peerId, channelMessage.payload);
          break;
        }
        
        case 'file-streaming-state': {
          const { isStreaming, fileType } = channelMessage.payload;
          updatePeerStreamingState(peerId, isStreaming);
          if (isStreaming && fileType === 'video') {
            useSubtitleStore.setState({ isRemoteSubtitleEnabled: true });
          } else if (!isStreaming) {
            useSubtitleStore.setState({
              isRemoteSubtitleEnabled: false,
              remoteSubtitleCue: null
            });
          }
          break;
        }
        
        case 'screen-share-state': {
          updatePeerScreenShareState(peerId, channelMessage.payload.isSharing);
          if (channelMessage.payload.isSharing) {
            setMainContentParticipant(peerId);
          } else {
            if (useUIManagementStore.getState().mainContentParticipantId === peerId) {
              setMainContentParticipant(null);
            }
          }
          break;
        }

        case 'clickcap-capture-state': {
          updatePeerClickCapState(peerId, channelMessage.payload.isSharing);
          break;
        }
        
        case 'subtitle-sync': {
          const { currentTime, cueId, activeTrackId } = channelMessage.payload;
          receiveSubtitleSync(currentTime, cueId, activeTrackId);
          break;
        }
        
        case 'subtitle-seek': {
          receiveSubtitleSync(channelMessage.payload.currentTime, null, null);
          break;
        }
        
        case 'subtitle-state': {
          receiveSubtitleState(channelMessage.payload);
          break;
        }
        
        case 'subtitle-track-meta': {
          receiveTrackMeta(channelMessage.payload);
          break;
        }
        
        case 'subtitle-track-chunk': {
          receiveTrackChunk(channelMessage.payload);
          break;
        }
        
        case 'subtitle-remote-enable': {
          receiveRemoteEnable(channelMessage.payload);
          break;
        }
        
        case 'pdf-metadata': {
          const { currentPage, totalPages, fileName } = channelMessage.payload;
          toast.info(`Presenter is sharing PDF: ${fileName} (Page ${currentPage}/${totalPages})`, { duration: 2000 });
          break;
        }
        
        case 'pdf-page-change': {
          const { currentPage, totalPages } = channelMessage.payload;
          toast.info(`Page ${currentPage}/${totalPages}`, { duration: 800, position: 'top-center' });
          break;
        }
        
        
        case 'ponscast': {
          const { action, index } = channelMessage.payload || {};
          toast.info(`PonsCast ${action === 'jump' ? 'jumped' : action || 'updated'}`, { duration: 1200 });
          if (typeof index === 'number') {
            toast.info(`Presenter moved to item ${index + 1}`, { duration: 1200 });
          }
          break;
        }

        case 'ponscast-stream-meta': {
          const metadata = { ...channelMessage.payload, senderId: peerId };
          updatePeerStreamingState(peerId, true);
          if (metadata.fileType === 'video') {
            useSubtitleStore.setState({ isRemoteSubtitleEnabled: true });
          }
          window.dispatchEvent(new CustomEvent(PONSCAST_METADATA_EVENT, { detail: metadata }));
          if (metadata.fileName) {
            toast.info(`PonsCast started: ${metadata.fileName}`, { duration: 2000 });
          }
          break;
        }

        case 'ponscast-stream-end': {
          updatePeerStreamingState(peerId, false);
          useSubtitleStore.setState({ isRemoteSubtitleEnabled: false, remoteSubtitleCue: null });
          window.dispatchEvent(new CustomEvent(PONSCAST_STREAM_END_EVENT, {
            detail: { ...channelMessage.payload, senderId: peerId }
          }));
          break;
        }
        
        default: {
          break;
        }
      }
    } catch (error) {
      console.error('[handleChannelMessage] Parse error:', error);
    }
  }, [
    handleIncomingChunk,
    addMessage,
    setTypingState,
    incrementUnreadMessageCount,
    addFileMessage,
    handleIncomingTranscription,
    receiveSubtitleState,
    receiveSubtitleSync,
    receiveRemoteEnable,
    receiveTrackMeta,
    receiveTrackChunk,
    updatePeerStreamingState,
    updatePeerScreenShareState,
    updatePeerClickCapState,
    setMainContentParticipant,
    messageHandlers
  ]);

  useEffect(() => {
    if (!params) return;
    
    const { roomId, userId, nickname, localStream, roomType } = params;
    
    initPeerConnection(localStream, { onData: handleChannelMessage });
    
    const signalingEvents: SignalingEvents = {
      onConnect: () => {
        toast.success('Connected to server.');
        
        const cowatchState = useCoWatchStore.getState();
        if (cowatchState.activeTabId && cowatchState.hostId === userId) {
          setTimeout(() => {
            cowatchState.broadcastState();
            toast.info('CoWatch state synchronized', { duration: 2000 });
          }, 1000);
        }
      },
      onDisconnect: () => {
        toast.error('Disconnected from server.');
      },
      onRoomUsers: async (users) => {
        // ICE servers가 준비될 때까지 대기 후 peer 생성
        await waitForIceServers(1500);
        
        users.forEach(user => {
          if (user.id !== userId) {
            createPeer(user.id, user.nickname, true);
          }
        });
      },
      onUserJoined: async (user) => {
        toast.info(`${user.nickname} joined room.`);
        if (user.id !== userId) {
          // ICE servers가 준비될 때까지 대기 후 peer 생성
          await waitForIceServers(1000);
          
          createPeer(user.id, user.nickname, false);
          
          setTimeout(() => {
            const me = useSessionStore.getState().userId;
            const cowatchState = useCoWatchStore.getState();
            
            if (cowatchState.hostId === me && cowatchState.activeTabId) {
              cowatchState.syncStateToNewPeer(user.id);
            }
          }, 2000);
        }
      },
      onUserLeft: (leftUserId) => {
        const peer = usePeerConnectionStore.getState().peers.get(leftUserId);
        const nickname = peer?.nickname || 'Unknown';
        toast.info(`${nickname} left the room.`);
        
        useCoWatchStore.getState().handleHostLeft(leftUserId);
        
        removePeer(leftUserId);
        
        if (useUIManagementStore.getState().mainContentParticipantId === leftUserId) {
          setMainContentParticipant(null);
        }
      },
      onSignal: ({ from, signal }) => {
        const peer = usePeerConnectionStore.getState().peers.get(from);
        const nickname = peer?.nickname || 'Unknown';
        receiveSignal(from, nickname, signal);
      },
      onRoomFull: (roomId) => {
        toast.error(`${roomId} room is full. Please send a reservation request.`);
        setTimeout(() => {
          if (location.pathname.startsWith('/room/')) {
            location.assign(buildRoomFullFallbackUrl(location.pathname, location.search, location.hash));
            return;
          }
          location.assign('/');
        }, 3000);
      },
      onMediaState: ({ userId, kind, enabled }) => {
        updatePeerMediaState(userId, kind, enabled);
      },
      onChatMessage: (message) => {
        addMessage(message);
      },
      onData: (data) => {
        if (data.type === 'file-meta') {
          const sender = usePeerConnectionStore.getState().peers.get(data.from);
          const senderNickname = sender ? sender.nickname : 'Unknown';
          addFileMessage(data.from, senderNickname, data.data, false);
          return;
        }

        if (data.type?.startsWith('video-upgrade-') || data.type === 'room-migration-issued') {
          useRoomUpgradeStore.getState().handleIncomingEvent(data);
          return;
        }
      },
    };
    
    connect(roomId, userId, nickname, signalingEvents, roomType);
    
    return () => {
      disconnect();
      cleanupPeerConnection();
      cleanupTranscription();
    };
  }, [
    params,
    initPeerConnection,
    handleChannelMessage,
    connect,
    disconnect,
    cleanupPeerConnection,
    cleanupTranscription,
    createPeer,
    receiveSignal,
    removePeer,
    updatePeerMediaState,
    addMessage,
    addFileMessage,
    setMainContentParticipant
  ]);

  useEffect(() => {
    if (isLocalStreaming !== undefined) {
      const { sendToAllPeers } = usePeerConnectionStore.getState();
      const { fileType } = useFileStreamingStore.getState();
      const message = JSON.stringify({
        type: 'file-streaming-state',
        payload: { isStreaming: isLocalStreaming, fileType }
      });
      sendToAllPeers(message);
    }
  }, [isLocalStreaming]);
};
