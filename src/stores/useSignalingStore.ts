// frontend/src/stores/useSignalingStore.ts
import { ENV } from '@/config';
import type { RoomType } from '@/types/room.types';
import { SignalData } from 'simple-peer';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { create } from 'zustand';
import { ChatMessage } from './useChatStore';
import { usePeerConnectionStore } from './usePeerConnectionStore';
import { useRelayStore, type RelayRequest } from './useRelayStore';
import type { JoinErrorPayload, TurnCredentialsResponse } from '@/types/signalingContracts';

type SignalingStatus = 'connecting' | 'reconnecting' | 'connected' | 'disconnected' | 'error';
type SignalingPayload = Record<string, unknown>;
type SocketAck = (response: unknown) => void;
type RuntimeMessage = SignalingPayload & {
  type?: string;
  from?: string;
  data?: SignalingPayload;
  payload?: unknown;
  __rt?: string;
  seq?: number;
  replayable?: boolean;
  fromNickname?: string;
  fromUserId?: string;
  streamMetadata?: RelayRequest['streamMetadata'];
  timestamp?: number;
};

interface PeerInfo {
  id: string;
  nickname: string;
}

export interface SignalingEvents {
  onConnect: () => void;
  onDisconnect: () => void;
  onRoomUsers: (users: PeerInfo[]) => void;
  onUserJoined: (user: PeerInfo) => void;
  onUserLeft: (userId: string) => void;
  onRoomFull: (roomId: string) => void;
  onSignal: (data: { from: string; signal: SignalData }) => void;
  onMediaState: (data: { userId: string; kind: 'audio' | 'video'; enabled: boolean }) => void;
  onChatMessage: (message: ChatMessage) => void;
  onData: (data: unknown) => void;
}

interface SignalingState {
  socket: Socket | null;
  status: SignalingStatus;
  iceServers: RTCIceServer[] | null;
  iceServersReady: boolean; // TURN credentials 수신 완료 플래그
  lastSeenSeq: number;
}

interface SignalingActions {
  connect: (
    roomId: string,
    userId: string,
    nickname: string,
    events: SignalingEvents,
    roomType?: RoomType
  ) => void;
  disconnect: () => void;
  emit: (event: string, data?: unknown, ack?: SocketAck) => void;
  sendSignal: (to: string, data: SignalData) => void;
  updateMediaState: (data: { kind: 'audio' | 'video'; enabled: boolean }) => void;
  sendRelaySignal: (to: string, data: SignalData) => void;
}

const heartbeatIntervals = new WeakMap<Socket, ReturnType<typeof setInterval>>();

const asRuntimeMessage = (data: RuntimeMessage): RuntimeMessage => {
  if (data.__rt === 'v1' && data.payload && typeof data.payload === 'object') {
    return data.payload as RuntimeMessage;
  }

  return data;
};

const getSignalType = (signal: SignalData): string => {
  const inspected = signal as Partial<SignalData> & { candidate?: unknown };
  return typeof inspected.type === 'string' ? inspected.type : inspected.candidate ? 'candidate' : 'unknown';
};

const getJoinSessionToken = (): string | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const search = new URLSearchParams(window.location.search);
  return search.get('sessionToken') || search.get('token') || undefined;
};

export const useSignalingStore = create<SignalingState & SignalingActions>((set, get) => ({
  socket: null,
  iceServers: null,
  iceServersReady: false,
  lastSeenSeq: 0,
  status: 'disconnected',

  connect: (roomId, userId, nickname, events, roomType) => {
    if (get().socket) {
      return;
    }

    const seqStorageKey = `replay:lastSeenSeq:${roomId}:${userId}`;
    const storedSeqRaw = sessionStorage.getItem(seqStorageKey);
    const storedSeq = storedSeqRaw ? Number.parseInt(storedSeqRaw, 10) : 0;
    if (Number.isFinite(storedSeq) && storedSeq > 0) {
      set({ lastSeenSeq: storedSeq });
    }

    set({ status: 'connecting' });

    const socket = io(ENV.VITE_SIGNALING_SERVER_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      auth: { userId, nickname }
    });

    let ackTimer: ReturnType<typeof setTimeout> | null = null;

    socket.on('connect', () => {
      set({ status: 'connected' });
      events.onConnect();
      const sessionToken = getJoinSessionToken();
      socket.emit('join-room', {
        roomId,
        userId,
        nickname,
        roomType,
        ...(sessionToken ? { sessionToken } : {}),
      });
      socket.emit('request-turn-credentials', { roomId, userId });
      socket.emit('resume-room', { roomId, lastSeenSeq: get().lastSeenSeq });
      const heartbeatInterval = setInterval(() => {
        if (socket.connected) {
          socket.emit('heartbeat');
        }
      }, 30000);
      heartbeatIntervals.set(socket, heartbeatInterval);
    });

    socket.on('disconnect', (reason) => {
      if (reason === 'io client disconnect') {
        set({ status: 'disconnected' });
      } else {
        set({ status: 'reconnecting' });
      }
      events.onDisconnect();
      const interval = heartbeatIntervals.get(socket);
      if (interval) {
        clearInterval(interval);
        heartbeatIntervals.delete(socket);
      }
      if (ackTimer) {
        clearTimeout(ackTimer);
        ackTimer = null;
      }
    });

    socket.on('connect_error', (err) => {
      set({ status: 'error' });
      if (err.message === 'xhr poll error') {
        toast.error('Server connection failed. Please check your network.');
      } else if ((err as { message?: string }).message === 'Session join denied') {
        toast.error('Room access could not be verified.');
      }
    });

    socket.on('reconnect', (attemptNumber) => {
      set({ status: 'connected' });
      toast.success('Connection restored.');
    });

    socket.on('reconnect_attempt', () => {
      set({ status: 'reconnecting' });
    });

    socket.on('reconnect_failed', () => {
      toast.error('Server connection failed. Please refresh the page.');
    });

    socket.on('error', () => {});

    socket.on('message', (data: RuntimeMessage) => {
      const runtimeData = asRuntimeMessage(data);

      if (data && data.__rt === 'v1' && data.replayable === true && typeof data.seq === 'number') {
        const nextSeq = Math.max(get().lastSeenSeq, data.seq);
        set({ lastSeenSeq: nextSeq });
        sessionStorage.setItem(seqStorageKey, String(nextSeq));

        if (ackTimer) {
          clearTimeout(ackTimer);
        }
        ackTimer = setTimeout(() => {
          const liveSocket = get().socket;
          if (liveSocket?.connected) {
            liveSocket.emit('ack-room-seq', { roomId, seq: nextSeq });
          }
          ackTimer = null;
        }, 300);
      }

      switch (runtimeData.type) {
        case 'signal': {
          if (runtimeData.from && runtimeData.data) {
            events.onSignal({ from: runtimeData.from, signal: runtimeData.data as SignalData });
          }
          break;
        }
        case 'peer-state-updated': {
          if (runtimeData.from && runtimeData.data) {
            events.onMediaState({
              userId: runtimeData.from,
              kind: runtimeData.data.kind as 'audio' | 'video',
              enabled: Boolean(runtimeData.data.enabled),
            });
          }
          break;
        }
        case 'chat': {
          const chatData = runtimeData.data ?? {};
          const chatMessage = {
            ...chatData,
            senderId: typeof chatData.senderId === 'string' ? chatData.senderId : runtimeData.from,
            senderNickname: typeof chatData.senderNickname === 'string' ? chatData.senderNickname : runtimeData.from,
          } as ChatMessage;
          events.onChatMessage(chatMessage);
          break;
        }
        case 'file-meta':
        case 'file-accept':
        case 'file-decline':
        case 'file-cancel':
        case 'file-chunk': {
          events.onData(runtimeData);
          break;
        }
        case 'relay:request_received': {
          const relayRequest: RelayRequest = {
            fromNickname: runtimeData.fromNickname || runtimeData.from || 'Unknown',
            fromUserId: runtimeData.fromUserId || runtimeData.from || '',
            streamMetadata: runtimeData.streamMetadata as RelayRequest['streamMetadata'],
            timestamp: runtimeData.timestamp || Date.now(),
          };
          useRelayStore.getState().handleIncomingRequest(relayRequest);
          break;
        }
        case 'video-upgrade-requested':
        case 'video-upgrade-approved':
        case 'video-upgrade-rejected':
        case 'video-upgrade-expired':
        case 'video-upgrade-committed':
        case 'room-migration-issued': {
          events.onData(runtimeData);
          break;
        }
        default: {
          break;
        }
      }
    });

    socket.on('room-users', (users: PeerInfo[]) => {
      events.onRoomUsers(users);
    });

    socket.on('user-joined', (user: PeerInfo) => {
      events.onUserJoined(user);
    });

    socket.on('user-left', (userId: string) => {
      events.onUserLeft(userId);
    });

    socket.on('room-full', (payload: { roomId: string }) => {
      events.onRoomFull(payload.roomId);
    });

    socket.on('join-error', (payload: JoinErrorPayload = {}) => {
      set({ status: 'error' });
      toast.error(payload.message || 'Room access could not be verified.');
      events.onData({ type: 'join-error', data: payload });
    });

    socket.on('turn-credentials', (data: TurnCredentialsResponse) => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[Signaling] 🔐 TURN Credentials Event Received');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Data:', JSON.stringify(data, null, 2));
      
      if (data.error) {
        set({ iceServersReady: true });
        console.warn('[Signaling] TURN credentials error:', data.code, data.error);
      } else if (data.iceServers) {
        console.log(`✅ ICE Servers received: ${data.iceServers.length} server(s)`);
        set({ iceServers: data.iceServers, iceServersReady: true });
        const { webRTCManager } = usePeerConnectionStore.getState();
        if (webRTCManager) {
          console.log('📤 Updating WebRTC Manager with new ICE servers...');
          webRTCManager.updateIceServers(data.iceServers);
        } else {
          console.warn('⚠️ WebRTC Manager not initialized yet');
        }
        toast.success('Secure connection established', { duration: 2000 });
      } else {
        console.warn('⚠️ No ICE servers in response');
        // STUN fallback도 ready로 처리
        set({ iceServersReady: true });
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });

    const relayStoreActions = useRelayStore.getState();
    socket.on('relay:request_list_response', relayStoreActions.handleRoomList);
    socket.on('relay:request_received', (data) => {
      const relayRequest: RelayRequest = {
        fromNickname: data.fromNickname || data.from,
        fromUserId: data.fromUserId || data.from,
        streamMetadata: data.streamMetadata,
        timestamp: data.timestamp || Date.now()
      };
      relayStoreActions.handleIncomingRequest(relayRequest);
    });
    socket.on('relay:response', relayStoreActions.handleRelayResponse);
    socket.on('relay:signal', relayStoreActions.handleRelaySignal);
    socket.on('relay:terminate', relayStoreActions.handleRelayTermination);
    socket.on('relay:feedback', (data) => {
      relayStoreActions.handleFeedback(data);
    });
    socket.on('relay:restart_request', (data) => {
      relayStoreActions.handleRetransmitRequest(data);
    });
    socket.on('relay:restart_response', (data) => {
      relayStoreActions.handleRetransmitResponse(data);
    });
    socket.on('broker:request_direct', (data) => {
      relayStoreActions.handleBrokerRequestDirect(data);
    });

    set({ socket });
  },

  disconnect: () => {
    const socket = get().socket;
    if (socket) {
      const interval = heartbeatIntervals.get(socket);
      if (interval) {
        clearInterval(interval);
        heartbeatIntervals.delete(socket);
      }
      socket.disconnect();
    }
    set({ socket: null, status: 'disconnected', iceServersReady: false });
  },

  emit: (event, data, ack) => {
    const socket = get().socket;
    if (!socket) {
      return;
    }
    if (ack) {
      socket.emit(event, data, ack);
    } else {
      socket.emit(event, data);
    }
  },

  sendSignal: (to, data) => {
    const signalType = getSignalType(data);
    console.log(`[Signaling] 📤 Sending signal to ${to}: type=${signalType}`);
    get().emit('message', { type: 'signal', to, data });
  },

  updateMediaState: (data) => {
    get().emit('message', { type: 'media-state-update', data });
  },

  sendRelaySignal: (to, data) => {
    get().emit('relay:signal', { toUserId: to, signal: data });
  },
}));
