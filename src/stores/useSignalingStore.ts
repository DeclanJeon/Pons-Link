import { create } from 'zustand';
import { produce } from 'immer';
import { io, Socket } from 'socket.io-client';
import { SignalData } from 'simple-peer';
import { ENV } from '@/config';
import { ChatMessage } from './useChatStore';
import { usePeerConnectionStore } from './usePeerConnectionStore';
import { toast } from 'sonner';

type SignalingStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

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
  onData: (data: any) => void;
}

interface SignalingState {
  socket: Socket | null;
  status: SignalingStatus;
  iceServers: RTCIceServer[] | null; // 추가
}

interface SignalingActions {
  connect: (roomId: string, userId: string, nickname: string, events: SignalingEvents) => void;
  disconnect: () => void;
  emit: (event: string, data: any) => void;
  sendSignal: (to: string, data: any) => void;
  updateMediaState: (data: { kind: 'audio' | 'video'; enabled: boolean }) => void;
}

export const useSignalingStore = create<SignalingState & SignalingActions>((set, get) => ({
  socket: null,
  iceServers: null,
  status: 'disconnected',

  connect: (roomId, userId, nickname, events) => {
    if (get().socket) return;

    set({ status: 'connecting' });
    const socket = io(ENV.VITE_SIGNALING_SERVER_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      // 재연결 설정 강화
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    socket.on('connect', () => {
      set({ status: 'connected' });
      events.onConnect();
      socket.emit('join-room', { roomId, userId, nickname });

      console.log('[TurnCredentials] Requesting new credentials...');
      socket.emit('request-turn-credentials', { roomId, userId });
      
      // 🔥 하트비트 시작 (30초마다)
      const heartbeatInterval = setInterval(() => {
        if (socket.connected) {
          socket.emit('heartbeat');
        }
      }, 30000);
      
      // 소켓에 interval ID 저장 (정리용)
      (socket as any).heartbeatInterval = heartbeatInterval;
    });

    socket.on('disconnect', (reason) => {
      set({ status: 'disconnected' });
      events.onDisconnect();
      
      // 하트비트 정리
      const interval = (socket as any).heartbeatInterval;
      if (interval) {
        clearInterval(interval);
      }
      
      console.log(`[Signaling] Disconnected: ${reason}`);
    });

    // 에러 처리 강화
    socket.on('connect_error', (err) => {
      console.error('[Signaling] Connection error:', err.message);
      set({ status: 'error' });
      
      if (err.message === 'xhr poll error') {
        toast.error('Server connection failed. Please check your network.');
      }
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log(`[Signaling] Reconnected (attempt ${attemptNumber})`);
      toast.success('Connection restored.');
    });

    socket.on('reconnect_failed', () => {
      console.error('[Signaling] Reconnection failed');
      toast.error('Server connection failed. Please refresh the page.');
    });

    // ✅ 추가: 일반 소켓 오류 리스너
    socket.on('error', (err) => {
      console.error('[SIGNALING_CORE] ❌ Socket error:', err);
    });

    // ✅ 수정: 백엔드의 멀티플렉싱 방식에 맞춰 단일 'message' 이벤트 리스너로 통합
    socket.on('message', (data: { type: string; from: string; [key: string]: any }) => {
      console.log(`[SIGNALING_CORE] 📥 [message] Event received:`, data);
      switch (data.type) {
        case 'signal':
          events.onSignal({ from: data.from, signal: data.data });
          break;
        case 'peer-state-updated':
          events.onMediaState({ userId: data.from, ...data.data });
          break;
        case 'chat':
          events.onChatMessage(data as unknown as ChatMessage);
          break;
        case 'file-meta':
        case 'file-accept':
        case 'file-decline':
        case 'file-cancel':
        case 'file-chunk':
          events.onData(data);
          break;
        default:
          console.warn(`[Signaling] Unknown message type received: ${data.type}`);
          break;
      }
    });

    socket.on('room-users', (users) => {
        console.log(`[SIGNALING_CORE] 📥 [room-users] 이벤트 수신:`, users);
        events.onRoomUsers(users);
    });
    socket.on('user-joined', (user) => {
        console.log(`[SIGNALING_CORE] 📥 [user-joined] 이벤트 수신:`, user);
        events.onUserJoined(user);
    });
    socket.on('user-left', (userId) => {
        console.log(`[SIGNALING_CORE] 📥 [user-left] 이벤트 수신:`, userId);
        events.onUserLeft(userId);
    });
    socket.on('room-full', (roomId) => {
        console.log(`[SIGNALING_CORE] 📥 [room-full] 이벤트 수신:`, roomId);
        events.onRoomFull(roomId);
    })

    // TURN 자격증명 수신 핸들러
    socket.on('turn-credentials', (data) => {
      // if (data.error) {
      //   console.error('[Signaling] TURN 자격증명 오류:', data.error);
      //   toast.error('연결 설정 실패. 관리자에게 문의하세요.');
      //   return;
      // }
      
      if (data.iceServers) {
        console.log('[Signaling] TURN credentials received');
        set({ iceServers: data.iceServers });
        
        // PeerConnectionStore에 ICE 서버 업데이트
        const { webRTCManager } = usePeerConnectionStore.getState();
        if (webRTCManager) {
          console.log(data.iceServers)
          webRTCManager.updateIceServers(data.iceServers);
        }
        
        // 연결 품질 향상을 위한 알림
        toast.success('Security connection established', {
          duration: 2000
        });
      }
    });
    
    set({ socket });
  },

  disconnect: () => {
    const socket = get().socket;
    if (socket) {
      // 하트비트 정리
      const interval = (socket as any).heartbeatInterval;
      if (interval) {
        clearInterval(interval);
      }
      
      socket.disconnect();
    }
    set({ socket: null, status: 'disconnected' });
  },

  emit: (event, data) => {
    console.log(`[SIGNALING_CORE] 📡 [${event}] Event sent:`, data);
    get().socket?.emit(event, data);
  },

  sendSignal: (to, data) => {
    get().emit('message', { type: 'signal', to, data });
  },

  updateMediaState: (data) => {
    get().emit('message', { type: 'media-state-update', data });
  },
}));