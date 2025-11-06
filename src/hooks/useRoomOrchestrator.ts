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
import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useSessionStore } from '@/stores/useSessionStore';
import { normalizeYouTubeURL } from '@/lib/cowatch/url-validator';
import { subtitleTransport } from '@/services/subtitleTransport';

interface RoomParams {
  roomId: string;
  userId: string;
  nickname: string;
  localStream: MediaStream;
  roomType?: RoomType;
}

type ChannelMessage =
  | { type: 'chat'; payload: any }
  | { type: 'typing-state'; payload: { isTyping: boolean } }
  | { type: 'whiteboard-operation'; payload: any }
  | { type: 'whiteboard-cursor'; payload: any }
  | { type: 'whiteboard-clear'; payload: any }
  | { type: 'whiteboard-delete'; payload: { operationIds: string[] } }
  | { type: 'whiteboard-update'; payload: any }
  | { type: 'whiteboard-background'; payload: any }
  | { type: 'file-meta'; payload: any; data?: any }
  | { type: 'file-ack'; payload: { transferId: string; chunkIndex: number } }
  | { type: 'transcription'; payload: { text: string; isFinal: boolean; lang: string } }
  | { type: 'subtitle-sync'; payload: { currentTime: number; cueId: string | null; activeTrackId: string | null; timestamp: number } }
  | { type: 'subtitle-seek'; payload: { currentTime: number; timestamp: number } }
  | { type: 'subtitle-state'; payload: any }
  | { type: 'subtitle-track-meta'; payload: any }
  | { type: 'subtitle-track-chunk'; payload: any }
  | { type: 'subtitle-remote-enable'; payload: any }
  | { type: 'file-streaming-state'; payload: { isStreaming: boolean; fileType: string } }
  | { type: 'screen-share-state'; payload: { isSharing: boolean } }
  | { type: 'pdf-metadata'; payload: { currentPage: number; totalPages: number; fileName: string } }
  | { type: 'pdf-page-change'; payload: { currentPage: number; totalPages: number; scale: number; rotation: number } }
  | { type: 'cowatch-control'; payload: { cmd: 'play' | 'pause' | 'seek' | 'mute' | 'unmute' | 'volume' | 'captions' | 'rate'; time?: number; volume?: number; captions?: boolean; rate?: number } }
  | { type: 'cowatch-load'; payload: { url: string; ownerId: string; ownerName: string; tabId: string; provider?: 'youtube'; title?: string; timestamp?: number } }
  | { type: 'cowatch-activate'; payload: { tabId: string } }
  | { type: 'cowatch-close'; payload: { tabId: string } }
  | { type: 'cowatch-close-request'; payload: { tabId: string } }
  | { type: 'cowatch-host'; payload: { hostId: string } }
  | { type: 'cowatch-state'; payload: { tabId: string | null; playing: boolean; currentTime: number; duration: number; muted: boolean; volume: number; captions: boolean; rate: number } }
  | { type: 'ponscast'; payload: { action: 'next' | 'prev' | 'jump'; index?: number } };

function isChannelMessage(obj: unknown): obj is ChannelMessage {
  return obj !== null && typeof obj === 'object' && typeof (obj as { type: unknown }).type === 'string';
}

// 메시지 핸들러 맵으로 분기 최적화
type MessageHandler = (peerId: string, payload: any, senderNickname: string) => void;

const createMessageHandlers = (): Record<string, MessageHandler> => ({
  'cowatch-control': (peerId, payload) => {
    const { cmd, time, volume, captions, rate } = payload || {};
    const store = useCoWatchStore.getState();
    
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
    const { url, ownerId, ownerName, provider, title, tabId, timestamp } = payload || {};
    
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
    
    const { tabId, ...mediaState } = payload || {};
    
    // 탭 전환 필요 시에만
    if (tabId && store.activeTabId !== tabId) {
      const tab = store.tabs.find(t => t.id === tabId);
      if (tab) store.setActiveTab(tabId);
    }
    
    // 미디어 상태 적용
    store.applyRemote(mediaState);
  }
});

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
    updatePeerScreenShareState
  } = usePeerConnectionStore();
  const { addMessage, setTypingState, handleIncomingChunk, addFileMessage } = useChatStore();
  const { incrementUnreadMessageCount, setMainContentParticipant, setActivePanel } = useUIManagementStore();
  const { cleanup: cleanupTranscription } = useTranscriptionStore();
  const {
    receiveSubtitleState,
    receiveSubtitleSync,
    receiveRemoteEnable
  } = useSubtitleStore();
  const { isStreaming: isLocalStreaming } = useFileStreamingStore();
  
  // 메시지 핸들러 맵 생성 (한 번만 생성)
  const messageHandlers = useMemo(() => createMessageHandlers(), []);
  
  const handleChannelMessage = useCallback((peerId: string, data: ArrayBuffer | string) => {
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
      return;
    }

    try {
      const dataString = typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer);
      const parsedData = JSON.parse(dataString);
      
      if (!isChannelMessage(parsedData)) {
        return;
      }

      const sender = usePeerConnectionStore.getState().peers.get(peerId);
      const senderNickname = sender ? sender.nickname : 'Unknown';

      // CoWatch 관련 메시지는 핸들러 맵 사용
      if (parsedData.type in messageHandlers) {
        messageHandlers[parsedData.type](peerId, parsedData.payload, senderNickname);
        return;
      }

      // 그 외 메시지는 기존 switch 문 사용
      switch (parsedData.type) {
        case 'chat': {
          addMessage(parsedData.payload);
          if (useUIManagementStore.getState().activePanel !== 'chat') {
            incrementUnreadMessageCount();
          }
          break;
        }
        
        case 'typing-state': {
          if (sender) setTypingState(peerId, sender.nickname, parsedData.payload.isTyping);
          break;
        }
        
        case 'whiteboard-operation': {
          useWhiteboardStore.getState().addOperation(parsedData.payload);
          break;
        }
        
        case 'whiteboard-cursor': {
          useWhiteboardStore.getState().updateRemoteCursor(parsedData.payload);
          break;
        }
        
        case 'whiteboard-clear': {
          useWhiteboardStore.getState().clearOperations();
          break;
        }
        
        case 'whiteboard-delete': {
          parsedData.payload.operationIds.forEach((id: string) => {
            useWhiteboardStore.getState().removeOperation(id);
          });
          break;
        }
        
        case 'whiteboard-update': {
          useWhiteboardStore.getState().addOperation(parsedData.payload);
          break;
        }
        
        case 'whiteboard-background': {
          useWhiteboardStore.getState().setBackground(parsedData.payload);
          break;
        }
        
        case 'file-meta': {
          const meta = parsedData.payload ?? parsedData.data;
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
          const transfer = usePeerConnectionStore.getState().activeTransfers.get(parsedData.payload.transferId);
          if (transfer) {
            transfer.worker.postMessage({ 
              type: 'ack-received', 
              payload: parsedData.payload 
            });
          }
          break;
        }
        
        case 'transcription': {
          usePeerConnectionStore.setState(
            produce(state => {
              const peer = state.peers.get(peerId);
              if (peer) peer.transcript = parsedData.payload;
            })
          );
          break;
        }
        
        case 'file-streaming-state': {
          const { isStreaming, fileType } = parsedData.payload;
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
          updatePeerScreenShareState(peerId, parsedData.payload.isSharing);
          if (parsedData.payload.isSharing) {
            setMainContentParticipant(peerId);
          } else {
            if (useUIManagementStore.getState().mainContentParticipantId === peerId) {
              setMainContentParticipant(null);
            }
          }
          break;
        }
        
        case 'subtitle-sync': {
          subtitleTransport.receive('subtitle-sync', parsedData.payload);
          break;
        }
        
        case 'subtitle-seek': {
          const { currentTime } = parsedData.payload;
          useSubtitleStore.getState().syncWithRemoteVideo(currentTime);
          break;
        }
        
        case 'subtitle-state': {
          subtitleTransport.receive('subtitle-state', parsedData.payload);
          break;
        }
        
        case 'subtitle-track-meta': {
          subtitleTransport.receive('subtitle-track-meta', parsedData.payload);
          break;
        }
        
        case 'subtitle-track-chunk': {
          subtitleTransport.receive('subtitle-track-chunk', parsedData.payload);
          break;
        }
        
        case 'subtitle-remote-enable': {
          subtitleTransport.receive('subtitle-remote-enable', parsedData.payload);
          break;
        }
        
        case 'pdf-metadata': {
          const { currentPage, totalPages, fileName } = parsedData.payload;
          toast.info(`Presenter is sharing PDF: ${fileName} (Page ${currentPage}/${totalPages})`, { duration: 2000 });
          break;
        }
        
        case 'pdf-page-change': {
          const { currentPage, totalPages } = parsedData.payload;
          toast.info(`Page ${currentPage}/${totalPages}`, { duration: 800, position: 'top-center' });
          break;
        }
        
        
        case 'ponscast': {
          const { action, index } = parsedData.payload || {};
          const st = useFileStreamingStore.getState();
          if (action === 'next') st.nextItem();
          if (action === 'prev') st.prevItem();
          if (action === 'jump' && typeof index === 'number') st.setCurrentIndex(index);
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
    receiveSubtitleState,
    receiveSubtitleSync,
    receiveRemoteEnable,
    updatePeerStreamingState,
    updatePeerScreenShareState,
    setMainContentParticipant,
    setActivePanel,
    params?.userId,
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
      onRoomUsers: (users) => {
        users.forEach(user => {
          if (user.id !== userId) {
            createPeer(user.id, user.nickname, true);
          }
        });
      },
      onUserJoined: (user) => {
        toast.info(`${user.nickname} joined room.`);
        if (user.id !== userId) {
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
        toast.error(`${roomId} room is full. Please join another room.`);
        setTimeout(() => {
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