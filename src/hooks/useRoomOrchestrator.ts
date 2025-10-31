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
import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useSessionStore } from '@/stores/useSessionStore';

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
  | { type: 'cowatch-load'; payload: { url: string; ownerId: string; ownerName: string; tabId: string; provider?: 'youtube'; title?: string } }
  | { type: 'cowatch-activate'; payload: { tabId: string } }
  | { type: 'cowatch-close'; payload: { tabId: string } }
  | { type: 'cowatch-close-request'; payload: { tabId: string } }
  | { type: 'cowatch-host'; payload: { hostId: string } }
  | { type: 'cowatch-state'; payload: { tabId: string | null; playing: boolean; currentTime: number; duration: number; muted: boolean; volume: number; captions: boolean; rate: number } }
  | { type: 'ponscast'; payload: { action: 'next' | 'prev' | 'jump'; index?: number } };

function isChannelMessage(obj: unknown): obj is ChannelMessage {
  return obj !== null && typeof obj === 'object' && typeof (obj as { type: unknown }).type === 'string';
}

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
            addFileMessage(peerId, senderNickname, meta, false);
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
          const peer = usePeerConnectionStore.getState().peers.get(peerId);
          if (peer?.isStreamingFile) {
            receiveSubtitleSync(
              parsedData.payload.currentTime,
              parsedData.payload.cueId,
              parsedData.payload.activeTrackId
            );
          }
          break;
        }
        
        case 'subtitle-seek': {
          const { currentTime } = parsedData.payload;
          useSubtitleStore.getState().syncWithRemoteVideo(currentTime);
          break;
        }
        
        case 'subtitle-state': {
          receiveSubtitleState(parsedData.payload);
          break;
        }
        
        case 'subtitle-track-meta': {
          useSubtitleStore.getState().receiveTrackMeta(parsedData.payload);
          break;
        }
        
        case 'subtitle-track-chunk': {
          useSubtitleStore.getState().receiveTrackChunk(parsedData.payload);
          break;
        }
        
        case 'subtitle-remote-enable': {
          receiveRemoteEnable(parsedData.payload);
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
        
        case 'cowatch-control': {
          const { cmd, time, volume, captions, rate } = parsedData.payload || {};
          const store = useCoWatchStore.getState();
          switch (cmd) {
            case 'play': {
              store.applyRemote({ playing: true });
              break;
            }
            case 'pause': {
              store.applyRemote({ playing: false });
              break;
            }
            case 'seek': {
              if (typeof time === 'number') {
                store.applyRemote({ currentTime: time });
              }
              break;
            }
            case 'mute': {
              store.applyRemote({ muted: true });
              break;
            }
            case 'unmute': {
              store.applyRemote({ muted: false });
              break;
            }
            case 'volume': {
              if (typeof volume === 'number') {
                store.applyRemote({ volume });
              }
              break;
            }
            case 'captions': {
              store.applyRemote({ captions: !!captions });
              break;
            }
            case 'rate': {
              if (typeof rate === 'number') {
                store.applyRemote({ rate });
              }
              break;
            }
          }
          break;
        }
        
        case 'cowatch-load': {
          const store = useCoWatchStore.getState();
          const ui = useUIManagementStore.getState();
          const { url, ownerId, ownerName, provider, title } = parsedData.payload || {};
          if (!url || !ownerId) break;
          
          const NOTIFICATION_COOLDOWN = 3000;
          const now = Date.now();
          const lastNotificationKey = `cowatch-notify-${url}-${ownerId}`;
          const lastNotificationTime = sessionStorage.getItem(lastNotificationKey);
          const isCoWatchPanelOpen = ui.activePanel === 'cowatch';
          const shouldNotify = !isCoWatchPanelOpen && (!lastNotificationTime || (now - parseInt(lastNotificationTime)) > NOTIFICATION_COOLDOWN);
          
          const existingTab = store.tabs.find(tab => tab.url === url && tab.ownerId === ownerId);
          let newTabId: string;
          if (existingTab) {
            newTabId = existingTab.id;
            if (title && existingTab.title !== title) {
              store.updateTabMeta(existingTab.id, { title });
            }
          } else {
            newTabId = store.addTabFromRemote(url, ownerId, ownerName || 'Unknown', provider || 'youtube');
            if (title) {
              store.updateTabMeta(newTabId, { title });
            }
          }
          
          const me = useSessionStore.getState().userId;
          if (!store.hostId) {
            store.setHost(ownerId || me || '');
          }
          
          if (shouldNotify) {
            const name = ownerName || 'Someone';
            const videoTitle = title || 'a video';
            const actionText = existingTab ? 'Rejoin CoWatch' : 'Join CoWatch';
            sessionStorage.setItem(lastNotificationKey, now.toString());
            toast(`${name} invited you to watch "${videoTitle}"`, {
              duration: 5000,
              action: {
                label: actionText,
                onClick: () => {
                  ui.setActivePanel('cowatch');
                  if (newTabId) {
                    setTimeout(() => {
                      store.setActiveTab(newTabId);
                    }, 100);
                  }
                }
              }
            });
          } else if (isCoWatchPanelOpen) {
            setTimeout(() => {
              store.setActiveTab(newTabId);
            }, 100);
            toast.info(`Switched to "${title || url}"`, { duration: 2000 });
          }
          break;
        }
        
        case 'cowatch-activate': {
          const store = useCoWatchStore.getState();
          const { tabId } = parsedData.payload || {};
          if (tabId) {
            store.setActiveTab(tabId);
          }
          break;
        }
        
        case 'cowatch-close': {
          const store = useCoWatchStore.getState();
          store.removeTab(parsedData.payload?.tabId, false);
          break;
        }
        
        case 'cowatch-close-request': {
          const store = useCoWatchStore.getState();
          const me = useSessionStore.getState().userId;
          if (store.hostId && store.hostId === me) {
            store.removeTab(parsedData.payload?.tabId, true);
          }
          break;
        }
        
        case 'cowatch-host': {
          const { hostId } = parsedData.payload;
          const store = useCoWatchStore.getState();
          if (hostId === params?.userId) {
            store.setRole('host');
          } else {
            store.setRole('viewer');
          }
          break;
        }
        
        case 'cowatch-state': {
          const store = useCoWatchStore.getState();
          const me = useSessionStore.getState().userId;
          if (store.role === 'host' && store.hostId === me) {
            break;
          }
          const { tabId, playing, currentTime, duration, muted, volume, captions, rate } = parsedData.payload || {};
          if (tabId && store.activeTabId !== tabId) {
            const tab = store.tabs.find(t => t.id === tabId);
            if (tab) {
              store.setActiveTab(tabId);
            }
          }
          store.applyRemote({ playing, currentTime, duration, muted, volume, captions, rate });
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
    params?.userId
  ]);

  useEffect(() => {
    if (!params) return;
    
    const { roomId, userId, nickname, localStream, roomType } = params;
    
    initPeerConnection(localStream, { onData: handleChannelMessage });
    
    const signalingEvents: SignalingEvents = {
      onConnect: () => {
        toast.success('Connected to server.');
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
        }
      },
      onUserLeft: (leftUserId) => {
        const peer = usePeerConnectionStore.getState().peers.get(leftUserId);
        const nickname = peer?.nickname || 'Unknown';
        toast.info(`${nickname} left the room.`);
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