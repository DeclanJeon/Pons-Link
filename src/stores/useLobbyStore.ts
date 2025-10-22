/**
 * @fileoverview Lobby 상태 관리 스토어
 * @module stores/useLobbyStore
 *
 * @description
 * Lobby 페이지의 전역 상태를 관리하며, 다음 책임을 담당합니다:
 * - 연결 세부 정보 관리 (방 제목, 닉네임, 방 타입)
 * - 미디어 디바이스 초기화 조율
 * - Room으로의 정상 이동 추적 (미디어 스트림 생명주기 관리)
 * - 닉네임 동적 변경 지원
 *
 * **핵심 설계 원칙:**
 * - Room으로 정상 이동 시 미디어 스트림 유지 (성능 최적화)
 * - 비정상 종료 시 리소스 정리 (메모리 누수 방지)
 * - MediaDeviceStore와의 느슨한 결합 (관심사 분리)
 */

import nicknamesData from '@/data/nicknames.json';
import type { RoomType } from '@/types/room.types';
import { toast } from 'sonner';
import { create } from 'zustand';
import { useMediaDeviceStore } from './useMediaDeviceStore';

/**
 * 연결 세부 정보 인터페이스
 *
 * @interface ConnectionDetails
 * @property {string} roomTitle - URL 디코딩된 방 제목
 * @property {string} nickname - 사용자 닉네임 (자동 생성 또는 사용자 입력)
 * @property {RoomType} roomType - 방 타입 ('public' | 'private' 등)
 */
interface ConnectionDetails {
  roomTitle: string;
  nickname: string;
  roomType: RoomType;
}

/**
 * Lobby 상태 인터페이스
 *
 * @interface LobbyState
 * @property {ConnectionDetails | null} connectionDetails - 현재 연결 정보
 * @property {boolean} isInitialized - 초기화 완료 여부
 * @property {boolean} isNavigatingToRoom - Room으로 정상 이동 중인지 추적
 */
interface LobbyState {
  connectionDetails: ConnectionDetails | null;
  isInitialized: boolean;
  isNavigatingToRoom: boolean;
}

/**
 * Lobby 액션 인터페이스
 *
 * @interface LobbyActions
 */
interface LobbyActions {
  /**
   * Lobby를 초기화합니다
   *
   * @param {string} roomTitle - 방 제목 (URL 인코딩된 상태일 수 있음)
   * @param {string} nickname - 사용자 닉네임 (빈 문자열이면 자동 생성)
   * @param {RoomType} roomType - 방 타입
   * @returns {Promise<void>}
   *
   * @description
   * 1. 닉네임 설정 (비어있으면 랜덤 생성)
   * 2. 연결 세부 정보 저장
   * 3. MediaDeviceStore 초기화 (미디어 스트림 획득)
   * 4. 초기화 완료 플래그 설정
   */
  initialize: (roomTitle: string, nickname: string, roomType: RoomType) => Promise<void>;

  /**
   * 리소스를 정리합니다
   *
   * @description
   * **조건부 정리 전략:**
   * - Room으로 정상 이동 중: 미디어 스트림 유지 (재사용)
   * - 비정상 종료: 미디어 스트림 정리 (리소스 해제)
   *
   * 이는 사용자가 Lobby → Room으로 이동할 때 카메라/마이크를
   * 다시 요청하지 않아도 되도록 최적화하는 핵심 메커니즘입니다.
   */
  cleanup: () => void;

  /**
   * Room으로 이동 중임을 표시합니다
   *
   * @param {boolean} isNavigating - 이동 중 여부
   *
   * @description
   * cleanup() 메서드가 미디어 스트림을 유지할지 결정하는 데 사용됩니다.
   * handleJoinRoom() 호출 직전에 true로 설정해야 합니다.
   */
  setNavigatingToRoom: (isNavigating: boolean) => void;

  /**
   * 닉네임을 변경합니다
   *
   * @param {string} nickname - 새 닉네임
   *
   * @description
   * Lobby에서 사용자가 닉네임을 수정할 수 있도록 지원합니다.
   * 연결 세부 정보의 다른 필드는 유지됩니다.
   */
  updateNickname: (nickname: string) => void;
}

/**
 * 랜덤 닉네임을 생성합니다
 *
 * @returns {string} "형용사 동물" 형식의 닉네임
 *
 * @example
 * generateRandomNickname() // "Brave Tiger"
 *
 * @description
 * nicknames.json 파일의 형용사와 동물 목록에서 랜덤하게 선택하여
 * 사용자 친화적인 닉네임을 생성합니다.
 */
const generateRandomNickname = (): string => {
  const { adjectives, animals } = nicknamesData;
  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomAnimal = animals[Math.floor(Math.random() * animals.length)];
  return `${randomAdjective} ${randomAnimal}`;
};

/**
 * Lobby 전역 상태 관리 스토어
 *
 * @description
 * **상태 전이 다이어그램:**
 * ```
 * [초기] → initialize() → [초기화됨] → setNavigatingToRoom(true) → [이동 중]
 *   ↓                          ↓                                        ↓
 * cleanup()                cleanup()                              cleanup()
 *   ↓                          ↓                                        ↓
 * [초기]                    [초기]                               [초기] (스트림 유지)
 * ```
 *
 * **미디어 스트림 생명주기:**
 * - Lobby 진입: MediaDeviceStore.initialize() → 스트림 획득
 * - Room 진입: 스트림 유지 (isNavigatingToRoom = true)
 * - 비정상 종료: 스트림 정리 (isNavigatingToRoom = false)
 *
 * @example
 * ```typescript
 * const { initialize, setNavigatingToRoom, cleanup } = useLobbyStore();
 *
 * // Lobby 진입 시
 * await initialize('My Room', 'John', 'public');
 *
 * // Room 진입 직전
 * setNavigatingToRoom(true);
 * navigate('/room/My%20Room');
 *
 * // Lobby 언마운트 시
 * cleanup(); // 스트림은 유지됨
 * ```
 */
export const useLobbyStore = create<LobbyState & LobbyActions>((set, get) => ({
  // 초기 상태
  connectionDetails: null,
  isInitialized: false,
  isNavigatingToRoom: false,

  // 액션 구현
  initialize: async (roomTitle, nickname, roomType) => {
    console.log('[LobbyStore] Initializing...', { roomTitle, nickname, roomType });

    try {
      // 1. 닉네임 결정 (비어있으면 랜덤 생성)
      const finalNickname = nickname || generateRandomNickname();

      // 2. 연결 세부 정보 설정
      set({
        connectionDetails: {
          roomTitle: decodeURIComponent(roomTitle),
          nickname: finalNickname,
          roomType
        }
      });

      // 3. 미디어 디바이스 초기화 (비동기)
      await useMediaDeviceStore.getState().initialize();

      // 4. 초기화 완료 표시
      set({ isInitialized: true });

      console.log('[LobbyStore] Initialized successfully');
      toast.success('Ready!');
    } catch (error) {
      console.error('[LobbyStore] Initialization failed:', error);
      toast.error('Initialization failed.');

      // 초기화 실패 시 상태 리셋
      set({
        connectionDetails: null,
        isInitialized: false
      });
    }
  },

  updateNickname: (nickname) => {
    set(state => ({
      connectionDetails: state.connectionDetails
        ? { ...state.connectionDetails, nickname }
        : null
    }));

    console.log('[LobbyStore] Nickname updated to:', nickname);
  },

  setNavigatingToRoom: (isNavigating) => {
    set({ isNavigatingToRoom: isNavigating });
    console.log('[LobbyStore] Navigating to room:', isNavigating);
  },

  cleanup: () => {
    const { isNavigatingToRoom } = get();

    console.log('[LobbyStore] Cleanup called', {
      isNavigatingToRoom,
      willCleanupMedia: !isNavigatingToRoom
    });

    // 조건부 미디어 정리
    if (!isNavigatingToRoom) {
      console.log('[LobbyStore] Abnormal exit detected, cleaning up media devices');
      useMediaDeviceStore.getState().cleanup();
    } else {
      console.log('[LobbyStore] Normal navigation to Room, keeping media stream alive');
    }

    // Store 상태 초기화
    set({
      connectionDetails: null,
      isInitialized: false,
      isNavigatingToRoom: false
    });

    console.log('[LobbyStore] Cleanup completed');
  }
}));
