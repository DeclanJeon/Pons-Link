import { create } from 'zustand';

export type ActivePanel = 'chat' | 'whiteboard' | 'settings' | 'fileStreaming' | 'relay' | 'none';

export type ViewMode = 'speaker' | 'grid' | 'viewer';
export type ControlBarPosition = 'bottom' | 'left' | 'top' | 'right';
export type ControlBarSize = 'sm' | 'md' | 'lg';
export type MobileDockPosition = 'bottom' | 'left' | 'right';

interface PIPPosition {
  x: number;
  y: number;
}

interface UIManagementState {
  // 패널 및 컨트롤 상태
  activePanel: ActivePanel;
  showControls: boolean;
  viewMode: ViewMode;
  unreadMessageCount: number;

  // 참가자 관리
  mainContentParticipantId: string | null;
  viewerModeParticipantId: string | null;

  // 데스크톱 컨트롤 바 설정
  controlBarPosition: ControlBarPosition;
  isControlBarDragging: boolean;
  controlBarSize: ControlBarSize;

  // 모바일 dock 설정
  isMobileDockVisible: boolean;
  mobileDockPosition: MobileDockPosition;
  mobileDockSize: ControlBarSize;
  mobileDockAutoHideEnabled: boolean;

  // PIP 위치 관리 (userId별)
  pipPositions: Record<string, PIPPosition>;
}

/**
 * UI 관리 액션 인터페이스
 * 상태를 변경하는 모든 메서드를 정의합니다.
 */
interface UIManagementActions {
  // 패널 및 컨트롤 액션
  setActivePanel: (panel: ActivePanel) => void;
  setShowControls: (show: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  incrementUnreadMessageCount: () => void;
  resetUnreadMessageCount: () => void;

  // 참가자 관리 액션
  setMainContentParticipant: (participantId: string | null) => void;
  setViewerModeParticipant: (participantId: string | null) => void;

  // 데스크톱 컨트롤 바 액션
  setControlBarPosition: (position: ControlBarPosition) => void;
  setIsControlBarDragging: (isDragging: boolean) => void;
  setControlBarSize: (size: ControlBarSize) => void;

  // 모바일 dock 액션
  setMobileDockVisible: (visible: boolean) => void;
  toggleMobileDock: () => void;
  setMobileDockPosition: (position: MobileDockPosition) => void;
  setMobileDockSize: (size: ControlBarSize) => void;
  setMobileDockAutoHide: (enabled: boolean) => void;

  // PIP 위치 관리 액션
  setPIPPosition: (userId: string, position: PIPPosition) => void;
  resetPIPPositions: () => void;

  // 전체 리셋
  reset: () => void;
}

/**
 * 초기 상태 정의
 * 재사용성을 위해 별도 상수로 분리
 */
const INITIAL_STATE: UIManagementState = {
  activePanel: 'none',
  showControls: true,
  viewMode: 'speaker',
  unreadMessageCount: 0,
  mainContentParticipantId: null,
  viewerModeParticipantId: null,
  controlBarPosition: 'bottom',
  isControlBarDragging: false,
  controlBarSize: 'md',
  isMobileDockVisible: true,
  mobileDockPosition: 'bottom',
  mobileDockSize: 'md',
  mobileDockAutoHideEnabled: true,
  pipPositions: {},
};

/**
 * UI 관리 Zustand 스토어
 *
 * 이 스토어는 애플리케이션의 모든 UI 상태를 중앙에서 관리합니다.
 * 패널 활성화, 뷰 모드 전환, 컨트롤 바 위치, PIP 위치 등을 포함합니다.
 *
 * @example
 * ```typescript
 * const { activePanel, setActivePanel } = useUIManagementStore();
 * setActivePanel('chat'); // 채팅 패널 활성화
 * ```
 */
export const useUIManagementStore = create<UIManagementState & UIManagementActions>((set, get) => ({
  ...INITIAL_STATE,

  /**
   * 활성 패널을 설정합니다.
   * 같은 패널을 다시 클릭하면 'none'으로 토글됩니다.
   * 채팅 패널 활성화 시 읽지 않은 메시지 카운트를 자동으로 리셋합니다.
   *
   * @param panel - 활성화할 패널 타입
   */
  setActivePanel: (panel) => {
    const currentPanel = get().activePanel;
    const newPanel = currentPanel === panel ? 'none' : panel;

    if (newPanel === 'chat') {
      get().resetUnreadMessageCount();
    }

    set({ activePanel: newPanel });
  },

  /**
   * 컨트롤 표시 여부를 설정합니다.
   *
   * @param show - true면 컨트롤 표시, false면 숨김
   */
  setShowControls: (show) => set({ showControls: show }),

  /**
   * 비디오 뷰 모드를 변경합니다.
   * 뷰 모드 변경 시 PIP 위치를 초기화하여 레이아웃 충돌을 방지합니다.
   *
   * @param mode - 설정할 뷰 모드
   */
  setViewMode: (mode) => {
    set({ viewMode: mode });
    get().resetPIPPositions(); // 뷰 모드 변경 시 PIP 위치 초기화
  },

  /**
   * 읽지 않은 메시지 카운트를 1 증가시킵니다.
   * 채팅 패널이 비활성 상태일 때 새 메시지 도착 시 호출됩니다.
   */
  incrementUnreadMessageCount: () =>
    set((state) => ({ unreadMessageCount: state.unreadMessageCount + 1 })),

  /**
   * 읽지 않은 메시지 카운트를 0으로 리셋합니다.
   * 채팅 패널 활성화 시 자동으로 호출됩니다.
   */
  resetUnreadMessageCount: () => set({ unreadMessageCount: 0 }),

  /**
   * 메인 콘텐츠 영역에 표시할 참가자를 설정합니다.
   * Speaker 모드에서 주로 사용됩니다.
   *
   * @param participantId - 참가자 ID 또는 null (초기화)
   */
  setMainContentParticipant: (participantId) =>
    set({ mainContentParticipantId: participantId }),

  /**
   * Viewer 모드에서 시청할 참가자를 설정합니다.
   *
   * @param participantId - 참가자 ID 또는 null (초기화)
   */
  setViewerModeParticipant: (participantId) =>
    set({ viewerModeParticipantId: participantId }),

  /**
   * 데스크톱 컨트롤 바의 위치를 설정합니다.
   *
   * @param position - 컨트롤 바 위치 (bottom, left, top, right)
   */
  setControlBarPosition: (position) => set({ controlBarPosition: position }),

  /**
   * 컨트롤 바 드래그 상태를 설정합니다.
   * 드래그 중일 때 다른 UI 상호작용을 제한하는 데 사용됩니다.
   *
   * @param isDragging - 드래그 중 여부
   */
  setIsControlBarDragging: (isDragging) => set({ isControlBarDragging: isDragging }),

  /**
   * 컨트롤 바의 크기를 설정합니다.
   *
   * @param size - 컨트롤 바 크기 (sm, md, lg)
   */
  setControlBarSize: (size) => set({ controlBarSize: size }),

  /**
   * 모바일 dock의 표시 여부를 설정합니다.
   *
   * @param visible - true면 표시, false면 숨김
   */
  setMobileDockVisible: (visible) => set({ isMobileDockVisible: visible }),

  /**
   * 모바일 dock의 표시 상태를 토글합니다.
   * 현재 상태의 반대로 전환됩니다.
   */
  toggleMobileDock: () =>
    set((state) => ({ isMobileDockVisible: !state.isMobileDockVisible })),

  /**
   * 모바일 dock의 위치를 설정합니다.
   *
   * @param position - dock 위치 (bottom, left, right)
   */
  setMobileDockPosition: (position) => set({ mobileDockPosition: position }),

  /**
   * 모바일 dock의 크기를 설정합니다.
   *
   * @param size - dock 크기 (sm, md, lg)
   */
  setMobileDockSize: (size) => set({ mobileDockSize: size }),

  /**
   * 모바일 dock의 자동 숨김 기능을 설정합니다.
   * 활성화 시 일정 시간 후 자동으로 dock이 숨겨집니다.
   *
   * @param enabled - 자동 숨김 활성화 여부
   */
  setMobileDockAutoHide: (enabled) => set({ mobileDockAutoHideEnabled: enabled }),

  /**
   * 특정 참가자의 PIP 위치를 저장합니다.
   * 드래그 종료 시 호출되어 위치를 영구 저장하며,
   * 다음 렌더링 시 저장된 위치에 PIP를 표시합니다.
   *
   * @param userId - 참가자의 고유 ID
   * @param position - PIP의 x, y 좌표
   *
   * @example
   * ```typescript
   * setPIPPosition('user123', { x: 100, y: 200 });
   * ```
   */
  setPIPPosition: (userId, position) =>
    set((state) => ({
      pipPositions: {
        ...state.pipPositions,
        [userId]: position,
      },
    })),

  /**
   * 모든 PIP 위치를 초기화합니다.
   * 뷰 모드 전환 시 자동으로 호출되어 레이아웃 충돌을 방지합니다.
   * 수동으로 호출하여 모든 PIP를 기본 위치로 리셋할 수도 있습니다.
   */
  resetPIPPositions: () => set({ pipPositions: {} }),

  /**
   * 모든 UI 상태를 초기값으로 리셋합니다.
   * 로그아웃, 세션 종료, 또는 새로운 회의 시작 시 호출됩니다.
   * PIP 위치를 포함한 모든 상태가 초기화됩니다.
   */
  reset: () => set(INITIAL_STATE),
}));

/**
 * 타입 안전성을 위한 타입 추출 유틸리티
 */
export type UIManagementStore = UIManagementState & UIManagementActions;

/**
 * 선택적 상태 선택을 위한 셀렉터 헬퍼
 * 성능 최적화를 위해 필요한 상태만 구독할 수 있습니다.
 *
 * @example
 * ```typescript
 * const activePanel = useUIManagementStore(selectActivePanel);
 * ```
 */
export const selectActivePanel = (state: UIManagementStore) => state.activePanel;
export const selectViewMode = (state: UIManagementStore) => state.viewMode;
export const selectPIPPosition = (userId: string) =>
  (state: UIManagementStore) => state.pipPositions[userId];
export const selectUnreadCount = (state: UIManagementStore) => state.unreadMessageCount;
export const selectMobileDockState = (state: UIManagementStore) => ({
  visible: state.isMobileDockVisible,
  position: state.mobileDockPosition,
  size: state.mobileDockSize,
  autoHide: state.mobileDockAutoHideEnabled,
});
