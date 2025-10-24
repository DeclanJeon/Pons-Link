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
  setSession: (userId: string, nickname: string, roomId: string, roomType?: RoomType) => void;
  updateNickname: (nickname: string) => void;
  clearSession: () => void;
  getSessionInfo: () => { userId: string; nickname: string } | null;
}

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
