import type { RoomType } from '@/types/room.types';
import { produce } from 'immer';
import { create } from 'zustand';

/**
 * 세션 상태 인터페이스
 *
 * @interface SessionState
 * @property {string | null} userId - 고유 사용자 식별자 (nanoid 생성)
 * @property {string | null} nickname - 사용자 닉네임
 * @property {string | null} roomId - 현재 참여 중인 방 ID
 * @property {RoomType | null} roomType - 방 타입 ('public' | 'private' 등)
 * @property {boolean} isActiveSession - 세션 활성 여부
 * @property {number | null} sessionStartTime - 세션 시작 타임스탬프 (ms)
 */
interface SessionState {
  userId: string | null;
  nickname: string | null;
  roomId: string | null;
  roomType: RoomType | null;
  isActiveSession: boolean;
  sessionStartTime: number | null;
}

/**
 * 세션 액션 인터페이스
 *
 * @interface SessionActions
 */
interface SessionActions {
  /**
   * 새 세션을 시작합니다
   *
   * @param {string} userId - 사용자 고유 ID
   * @param {string} nickname - 사용자 닉네임
   * @param {string} roomId - 방 ID (일반적으로 roomTitle과 동일)
   * @param {RoomType} [roomType] - 방 타입 (선택적, 기본값: null)
   *
   * @description
   * Room 진입 시 호출되며, 세션 활성화 및 시작 시간을 기록합니다.
   * 로깅을 통해 세션 생성을 추적할 수 있습니다.
   *
   * @example
   * ```typescript
   * const userId = nanoid();
   * setSession(userId, 'John Doe', 'My Room', 'public');
   * ```
   */
  setSession: (userId: string, nickname: string, roomId: string, roomType?: RoomType) => void;

  /**
   * 닉네임을 변경합니다
   *
   * @param {string} nickname - 새 닉네임
   *
   * @description
   * Immer의 produce를 사용하여 불변성을 유지하면서 닉네임만 업데이트합니다.
   * Room 내에서 사용자가 닉네임을 변경할 때 사용됩니다.
   *
   * @example
   * ```typescript
   * updateNickname('Jane Doe');
   * ```
   */
  updateNickname: (nickname: string) => void;

  /**
   * 세션을 종료하고 모든 상태를 초기화합니다
   *
   * @description
   * Room 퇴장 시 호출되며, 모든 세션 정보를 null로 리셋합니다.
   * 활성 세션이었을 경우 종료 로그를 남깁니다.
   *
   * @example
   * ```typescript
   * clearSession();
   * ```
   */
  clearSession: () => void;

  /**
   * 현재 세션 정보를 반환합니다
   *
   * @returns {{ userId: string; nickname: string } | null} 세션 정보 또는 null
   *
   * @description
   * 세션이 활성화되어 있고 필수 정보(userId, nickname)가 있으면 반환합니다.
   * 다른 컴포넌트에서 현재 사용자 정보를 참조할 때 사용됩니다.
   *
   * @example
   * ```typescript
   * const sessionInfo = getSessionInfo();
   * if (sessionInfo) {
   *   console.log(`User: ${sessionInfo.nickname} (${sessionInfo.userId})`);
   * }
   * ```
   */
  getSessionInfo: () => { userId: string; nickname: string } | null;
}

/**
 * 세션 전역 상태 관리 스토어
 *
 * @description
 * **상태 전이 다이어그램:**
 * ```
 * [비활성] → setSession() → [활성]
 *    ↑                          ↓
 *    └──────── clearSession() ──┘
 *
 * [활성] → updateNickname() → [활성] (닉네임만 변경)
 * ```
 *
 * **세션 생명주기:**
 * 1. 생성: Lobby에서 "Join Room" 클릭 시
 * 2. 활성: Room 내에서 지속
 * 3. 종료: Room 퇴장 또는 브라우저 종료 시
 *
 * **다른 Store와의 관계:**
 * - LobbyStore: 세션 생성 트리거 (connectionDetails 제공)
 * - RoomStore: 세션 정보 참조 (사용자 식별)
 * - MediaDeviceStore: 독립적 (직접 상호작용 없음)
 *
 * @example
 * ```typescript
 * const { setSession, getSessionInfo, clearSession } = useSessionStore();
 *
 * // Room 진입 시
 * setSession('user123', 'John Doe', 'My Room', 'public');
 *
 * // 세션 정보 조회
 * const info = getSessionInfo();
 * console.log(info?.nickname); // "John Doe"
 *
 * // Room 퇴장 시
 * clearSession();
 * ```
 */
export const useSessionStore = create<SessionState & SessionActions>((set, get) => ({
  // 초기 상태
  userId: null,
  nickname: null,
  roomId: null,
  roomType: null,
  isActiveSession: false,
  sessionStartTime: null,

  // 액션 구현
  setSession: (userId, nickname, roomId, roomType = null) => {
    set({
      userId,
      nickname,
      roomId,
      roomType,
      isActiveSession: true,
      sessionStartTime: Date.now()
    });

    console.log('[Session] Session started', {
      user: `${nickname} (${userId})`,
      room: roomId,
      type: roomType || 'n/a',
      timestamp: new Date().toISOString()
    });
  },

  updateNickname: (nickname) => {
    set(produce((state: SessionState) => {
      state.nickname = nickname;
    }));

    console.log('[Session] Nickname updated to:', nickname);
  },

  clearSession: () => {
    const state = get();

    if (state.isActiveSession) {
      const sessionDuration = state.sessionStartTime
        ? Date.now() - state.sessionStartTime
        : 0;

      console.log('[Session] Session ended', {
        user: `${state.nickname} (${state.userId})`,
        duration: `${(sessionDuration / 1000).toFixed(2)}s`,
        timestamp: new Date().toISOString()
      });
    }

    set({
      userId: null,
      nickname: null,
      roomId: null,
      roomType: null,
      isActiveSession: false,
      sessionStartTime: null
    });
  },

  getSessionInfo: () => {
    const state = get();

    if (state.userId && state.nickname) {
      return {
        userId: state.userId,
        nickname: state.nickname
      };
    }

    return null;
  }
}));
