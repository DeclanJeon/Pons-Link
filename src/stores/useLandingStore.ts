import nicknamesData from '@/data/nicknames.json';
import { RoomType } from '@/types/room.types';
import { create } from 'zustand';

/**
 * Landing 페이지의 상태를 관리하는 인터페이스
 *
 * @interface LandingState
 * @property {string} roomTitle - 사용자가 입력한 방 제목
 * @property {string} nickname - 사용자가 입력하거나 생성된 닉네임
 * @property {RoomType | null} roomType - 선택된 방 타입 (예: 'public', 'private')
 */
interface LandingState {
  roomTitle: string;
  nickname: string;
  roomType: RoomType | null;
}

/**
 * Landing 페이지의 액션을 정의하는 인터페이스
 *
 * @interface LandingActions
 */
interface LandingActions {
  /**
   * 방 제목을 설정합니다
   * @param {string} title - 설정할 방 제목
   */
  setRoomTitle: (title: string) => void;

  /**
   * 닉네임을 설정합니다
   * @param {string} nickname - 설정할 닉네임
   */
  setNickname: (nickname: string) => void;

  /**
   * 방 타입을 설정합니다
   * @param {RoomType} type - 설정할 방 타입
   */
  setRoomType: (type: RoomType) => void;

  /**
   * 랜덤 닉네임을 생성하고 상태에 저장합니다
   * @returns {string} 생성된 닉네임 (형식: "형용사 동물")
   */
  generateRandomNickname: () => string;

  /**
   * 방 연결을 처리합니다
   * 입력 검증 후 Lobby 페이지로 네비게이션합니다
   *
   * @param {Function} navigate - React Router의 navigate 함수
   * @param {Object} toast - Toast 알림 객체
   */
  handleConnect: (
    navigate: (path: string, options?: { state: any }) => void,
    toast: any
  ) => void;

  /**
   * 모든 상태를 초기값으로 리셋합니다
   */
  reset: () => void;
}

/**
 * Landing 페이지의 전역 상태 관리 스토어
 *
 * @description
 * 방 생성/참여 프로세스의 상태를 관리합니다.
 * - 방 제목, 닉네임, 방 타입 입력 관리
 * - 랜덤 닉네임 생성 기능
 * - 입력 검증 및 Lobby로의 네비게이션 처리
 *
 * @example
 * ```typescript
 * const { roomTitle, setRoomTitle, handleConnect } = useLandingStore();
 *
 * setRoomTitle("My Awesome Room");
 * handleConnect(navigate, toast);
 * ```
 */
export const useLandingStore = create<LandingState & LandingActions>((set, get) => ({
  // 초기 상태
  roomTitle: "",
  nickname: "",
  roomType: null,

  // 액션 구현
  setRoomTitle: (title: string) => set({ roomTitle: title }),

  setNickname: (nickname: string) => set({ nickname }),

  setRoomType: (type: RoomType) => set({ roomType: type }),

  generateRandomNickname: () => {
    const { adjectives, animals } = nicknamesData;

    // 랜덤 인덱스 생성
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomAnimal = animals[Math.floor(Math.random() * animals.length)];

    // "형용사 동물" 형식의 닉네임 생성
    const generatedName = `${randomAdjective} ${randomAnimal}`;

    // 상태 업데이트 및 반환
    set({ nickname: generatedName });
    return generatedName;
  },

  handleConnect: (navigate, toast) => {
    const { roomTitle, nickname, roomType } = get();

    // 방 제목 검증
    if (!roomTitle.trim()) {
      toast.error("Please enter a room title to continue");
      return;
    }

    // 방 타입 검증
    if (!roomType) {
      toast.error("Please select a room type");
      return;
    }

    // 닉네임이 없으면 랜덤 생성
    const finalNickname = nickname.trim() || get().generateRandomNickname();

    // 성공 메시지 표시
    toast.success(`Preparing to join as "${finalNickname}"...`);

    // Lobby로 네비게이션 (URL 파라미터 + state를 통한 데이터 전달)
    navigate(`/lobby/${encodeURIComponent(roomTitle.trim())}`, {
      state: {
        nickname: finalNickname,
        roomType
      }
    });
  },

  reset: () => set({
    roomTitle: "",
    nickname: "",
    roomType: null
  })
}));
