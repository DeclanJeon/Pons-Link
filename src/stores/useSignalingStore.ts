import { ENV } from '@/config';
import type { RoomType } from '@/types/room.types';
import { SignalData } from 'simple-peer';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { create } from 'zustand';
import { ChatMessage } from './useChatStore';
import { usePeerConnectionStore } from './usePeerConnectionStore';

/**
 * 시그널링 연결 상태
 */
type SignalingStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * 피어 정보 인터페이스
 *
 * @interface PeerInfo
 * @property {string} id - 피어의 고유 식별자 (userId)
 * @property {string} nickname - 피어의 표시 이름
 */
interface PeerInfo {
  id: string;
  nickname: string;
}

/**
 * 시그널링 이벤트 핸들러 인터페이스
 *
 * @interface SignalingEvents
 * @description
 * 시그널링 서버로부터 수신한 이벤트를 처리하는 콜백 함수들입니다.
 * Room 컴포넌트에서 이 핸들러들을 구현하여 connect() 호출 시 전달합니다.
 */
export interface SignalingEvents {
  /**
   * 소켓 연결 성공 시 호출
   */
  onConnect: () => void;

  /**
   * 소켓 연결 해제 시 호출
   */
  onDisconnect: () => void;

  /**
   * 현재 방의 모든 사용자 목록 수신 시 호출
   * @param {PeerInfo[]} users - 방에 있는 사용자 목록
   */
  onRoomUsers: (users: PeerInfo[]) => void;

  /**
   * 새 사용자가 방에 입장했을 때 호출
   * @param {PeerInfo} user - 입장한 사용자 정보
   */
  onUserJoined: (user: PeerInfo) => void;

  /**
   * 사용자가 방에서 퇴장했을 때 호출
   * @param {string} userId - 퇴장한 사용자 ID
   */
  onUserLeft: (userId: string) => void;

  /**
   * 방이 가득 찼을 때 호출
   * @param {string} roomId - 가득 찬 방의 ID
   */
  onRoomFull: (roomId: string) => void;

  /**
   * WebRTC 시그널링 데이터 수신 시 호출
   * @param {Object} data - 시그널링 데이터
   * @param {string} data.from - 발신자 ID
   * @param {SignalData} data.signal - WebRTC 시그널 (Offer/Answer/ICE)
   */
  onSignal: (data: { from: string; signal: SignalData }) => void;

  /**
   * 피어의 미디어 상태 변경 시 호출
   * @param {Object} data - 미디어 상태 데이터
   * @param {string} data.userId - 상태가 변경된 사용자 ID
   * @param {'audio' | 'video'} data.kind - 미디어 종류
   * @param {boolean} data.enabled - 활성화 여부
   */
  onMediaState: (data: { userId: string; kind: 'audio' | 'video'; enabled: boolean }) => void;

  /**
   * 채팅 메시지 수신 시 호출
   * @param {ChatMessage} message - 채팅 메시지 객체
   */
  onChatMessage: (message: ChatMessage) => void;

  /**
   * 파일 전송 관련 데이터 수신 시 호출
   * @param {any} data - 파일 메타데이터 또는 제어 메시지
   */
  onData: (data: any) => void;
}

/**
 * 시그널링 상태 인터페이스
 *
 * @interface SignalingState
 * @property {Socket | null} socket - Socket.IO 클라이언트 인스턴스
 * @property {SignalingStatus} status - 현재 연결 상태
 * @property {RTCIceServer[] | null} iceServers - TURN/STUN 서버 설정
 */
interface SignalingState {
  socket: Socket | null;
  status: SignalingStatus;
  iceServers: RTCIceServer[] | null;
}

/**
 * 시그널링 액션 인터페이스
 *
 * @interface SignalingActions
 */
interface SignalingActions {
  /**
   * 시그널링 서버에 연결하고 방에 참여합니다
   *
   * @param {string} roomId - 참여할 방 ID
   * @param {string} userId - 사용자 고유 ID
   * @param {string} nickname - 사용자 닉네임
   * @param {SignalingEvents} events - 이벤트 핸들러 객체
   * @param {RoomType} [roomType] - 방 타입 (선택적)
   *
   * @description
   * **연결 흐름:**
   * 1. Socket.IO 클라이언트 생성
   * 2. 이벤트 리스너 등록
   * 3. 서버 연결 시도
   * 4. 연결 성공 시 'join-room' 이벤트 발송
   * 5. TURN 자격증명 요청
   * 6. 하트비트 시작
   *
   * **재연결 전략:**
   * - 최대 5회 재시도
   * - 지수 백오프 (1초 ~ 5초)
   * - 타임아웃: 20초
   *
   * @example
   * ```typescript
   * const events: SignalingEvents = {
   *   onConnect: () => console.log('Connected'),
   *   onUserJoined: (user) => console.log(`${user.nickname} joined`),
   *   // ... 나머지 핸들러들
   * };
   *
   * connect('my-room', 'user123', 'John', events, 'public');
   * ```
   */
  connect: (
    roomId: string,
    userId: string,
    nickname: string,
    events: SignalingEvents,
    roomType?: RoomType
  ) => void;

  /**
   * 시그널링 서버 연결을 해제합니다
   *
   * @description
   * 하트비트를 중지하고 소켓 연결을 정리합니다.
   * 컴포넌트 언마운트 시 또는 방 퇴장 시 호출해야 합니다.
   */
  disconnect: () => void;

  /**
   * 시그널링 서버로 이벤트를 전송합니다
   *
   * @param {string} event - 이벤트 이름
   * @param {any} data - 전송할 데이터
   *
   * @description
   * 저수준 API로, 일반적으로 직접 호출하지 않고
   * sendSignal, updateMediaState 등의 래퍼 메서드를 사용합니다.
   */
  emit: (event: string, data: any) => void;

  /**
   * 특정 피어에게 WebRTC 시그널링 데이터를 전송합니다
   *
   * @param {string} to - 수신자 ID
   * @param {any} data - 시그널링 데이터 (Offer/Answer/ICE Candidate)
   *
   * @description
   * WebRTC 연결 협상 과정에서 사용됩니다.
   * simple-peer가 생성한 시그널 데이터를 중계합니다.
   *
   * @example
   * ```typescript
   * peer.on('signal', (signal) => {
   *   sendSignal(remotePeerId, signal);
   * });
   * ```
   */
  sendSignal: (to: string, data: any) => void;

  /**
   * 자신의 미디어 상태 변경을 다른 피어들에게 알립니다
   *
   * @param {Object} data - 미디어 상태 데이터
   * @param {'audio' | 'video'} data.kind - 미디어 종류
   * @param {boolean} data.enabled - 활성화 여부
   *
   * @description
   * 마이크/카메라를 켜거나 끌 때 호출하여
   * 다른 참여자들의 UI를 업데이트할 수 있도록 합니다.
   *
   * @example
   * ```typescript
   * // 마이크 끄기
   * updateMediaState({ kind: 'audio', enabled: false });
   * ```
   */
  updateMediaState: (data: { kind: 'audio' | 'video'; enabled: boolean }) => void;
}

/**
 * 시그널링 전역 상태 관리 스토어
 *
 * @description
 * **메시지 라우팅 전략:**
 * 백엔드는 모든 메시지를 'message' 이벤트로 멀티플렉싱하며,
 * 각 메시지는 'type' 필드로 구분됩니다:
 *
 * - `signal`: WebRTC 시그널링
 * - `peer-state-updated`: 미디어 상태 변경
 * - `chat`: 채팅 메시지
 * - `file-meta`, `file-accept`, `file-decline`, `file-cancel`, `file-chunk`: 파일 전송
 *
 * **연결 안정성 메커니즘:**
 * 1. **자동 재연결**: 네트워크 끊김 시 자동으로 재시도
 * 2. **하트비트**: 30초마다 'heartbeat' 이벤트를 전송하여 연결 유지
 * 3. **에러 처리**: 사용자 친화적 토스트 알림 제공
 * 4. **타임아웃**: 20초 내 응답 없으면 연결 실패 처리
 *
 * **TURN 서버 통합:**
 * NAT/방화벽 환경에서도 연결을 보장하기 위해
 * 서버로부터 동적으로 TURN 자격증명을 받아옵니다.
 *
 * @example
 * ```typescript
 * // Room 컴포넌트에서 사용
 * const { connect, disconnect, sendSignal } = useSignalingStore();
 *
 * useEffect(() => {
 *   const events: SignalingEvents = {
 *     onConnect: () => setIsConnected(true),
 *     onUserJoined: (user) => handleNewPeer(user),
 *     // ... 나머지 핸들러들
 *   };
 *
 *   connect(roomId, userId, nickname, events, roomType);
 *
 *   return () => disconnect();
 * }, []);
 * ```
 */
export const useSignalingStore = create<SignalingState & SignalingActions>((set, get) => ({
  // 초기 상태
  socket: null,
  iceServers: null,
  status: 'disconnected',

  // 액션 구현
  connect: (roomId, userId, nickname, events, roomType) => {
    // 이미 연결되어 있으면 무시 (중복 연결 방지)
    if (get().socket) {
      console.warn('[Signaling] Already connected, ignoring duplicate connect call');
      return;
    }

    set({ status: 'connecting' });

    // Socket.IO 클라이언트 생성
    const socket = io(ENV.VITE_SIGNALING_SERVER_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'], // WebSocket 우선, 실패 시 폴링

      // 재연결 설정
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    // ============================================================
    // 연결 생명주기 이벤트
    // ============================================================

    socket.on('connect', () => {
      console.log('[Signaling] Connected to server');
      set({ status: 'connected' });
      events.onConnect();

      // 방 참여 요청 (roomType 포함)
      socket.emit('join-room', { roomId, userId, nickname, roomType });

      // TURN 자격증명 요청
      console.log('[Signaling] Requesting TURN credentials...');
      socket.emit('request-turn-credentials', { roomId, userId });

      // 하트비트 시작 (30초마다)
      const heartbeatInterval = setInterval(() => {
        if (socket.connected) {
          socket.emit('heartbeat');
        }
      }, 30000);

      // 소켓에 interval ID 저장 (정리용)
      (socket as any).heartbeatInterval = heartbeatInterval;
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Signaling] Disconnected: ${reason}`);
      set({ status: 'disconnected' });
      events.onDisconnect();

      // 하트비트 정리
      const interval = (socket as any).heartbeatInterval;
      if (interval) {
        clearInterval(interval);
        delete (socket as any).heartbeatInterval;
      }
    });

    // ============================================================
    // 에러 처리
    // ============================================================

    socket.on('connect_error', (err) => {
      console.error('[Signaling] Connection error:', err.message);
      set({ status: 'error' });

      // 특정 에러에 대한 사용자 친화적 메시지
      if (err.message === 'xhr poll error') {
        toast.error('Server connection failed. Please check your network.');
      }
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log(`[Signaling] Reconnected (attempt ${attemptNumber})`);
      toast.success('Connection restored.');
    });

    socket.on('reconnect_failed', () => {
      console.error('[Signaling] Reconnection failed after max attempts');
      toast.error('Server connection failed. Please refresh the page.');
    });

    socket.on('error', (err) => {
      console.error('[Signaling] Socket error:', err);
    });

    // ============================================================
    // 메시지 라우팅 (멀티플렉싱)
    // ============================================================

    socket.on('message', (data: { type: string; from: string; [key: string]: any }) => {
      console.log(`[Signaling] Message received:`, data);

      switch (data.type) {
        case 'signal':
          // WebRTC 시그널링 데이터
          events.onSignal({ from: data.from, signal: data.data });
          break;

        case 'peer-state-updated':
          // 피어의 미디어 상태 변경
          events.onMediaState({ userId: data.from, ...data.data });
          break;

        case 'chat':
          // 채팅 메시지
          events.onChatMessage(data as unknown as ChatMessage);
          break;

        case 'file-meta':
        case 'file-accept':
        case 'file-decline':
        case 'file-cancel':
        case 'file-chunk':
          // 파일 전송 관련 메시지
          events.onData(data);
          break;

        default:
          console.warn(`[Signaling] Unknown message type: ${data.type}`);
          break;
      }
    });

    // ============================================================
    // 방 관리 이벤트
    // ============================================================

    socket.on('room-users', (users: PeerInfo[]) => {
      console.log('[Signaling] Room users:', users);
      events.onRoomUsers(users);
    });

    socket.on('user-joined', (user: PeerInfo) => {
      console.log('[Signaling] User joined:', user);
      events.onUserJoined(user);
    });

    socket.on('user-left', (userId: string) => {
      console.log('[Signaling] User left:', userId);
      events.onUserLeft(userId);
    });

    socket.on('room-full', (payload: { roomId: string }) => {
      console.log('[Signaling] Room full:', payload);
      events.onRoomFull(payload.roomId);
    });

    // ============================================================
    // TURN 자격증명 처리
    // ============================================================

    socket.on('turn-credentials', (data) => {
      if (data.iceServers) {
        console.log('[Signaling] TURN credentials received');
        set({ iceServers: data.iceServers });

        // PeerConnectionStore에 ICE 서버 업데이트
        const { webRTCManager } = usePeerConnectionStore.getState();
        if (webRTCManager) {
          console.log('[Signaling] Updating ICE servers:', data.iceServers);
          webRTCManager.updateIceServers(data.iceServers);
        }

        // 연결 품질 향상 알림
        toast.success('Secure connection established', {
          duration: 2000
        });
      }
    });

    set({ socket });
  },

  disconnect: () => {
    const socket = get().socket;

    if (socket) {
      console.log('[Signaling] Disconnecting...');

      // 하트비트 정리
      const interval = (socket as any).heartbeatInterval;
      if (interval) {
        clearInterval(interval);
        delete (socket as any).heartbeatInterval;
      }

      // 소켓 연결 해제
      socket.disconnect();
    }

    set({ socket: null, status: 'disconnected' });
  },

  emit: (event, data) => {
    const socket = get().socket;

    if (!socket) {
      console.warn(`[Signaling] Cannot emit '${event}': socket not connected`);
      return;
    }

    console.log(`[Signaling] Emitting '${event}':`, data);
    socket.emit(event, data);
  },

  sendSignal: (to, data) => {
    get().emit('message', { type: 'signal', to, data });
  },

  updateMediaState: (data) => {
    get().emit('message', { type: 'media-state-update', data });
  },
}));
