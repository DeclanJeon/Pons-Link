import { create } from 'zustand';

export type ActivePanel = 'chat' | 'whiteboard' | 'settings' | 'fileStreaming' | 'relay' | 'cowatch' | 'none';
export type ViewMode = 'speaker' | 'grid' | 'viewer';
export type ControlBarPosition = 'bottom' | 'left' | 'top' | 'right';
export type ControlBarSize = 'sm' | 'md' | 'lg';
export type MobileDockPosition = 'bottom' | 'left' | 'right';

interface PIPPosition {
  x: number;
  y: number;
}

interface UIManagementState {
  activePanel: ActivePanel;
  showControls: boolean;
  viewMode: ViewMode;
  unreadMessageCount: number;
  mainContentParticipantId: string | null;
  viewerModeParticipantId: string | null;
  controlBarPosition: ControlBarPosition;
  isControlBarDragging: boolean;
  controlBarSize: ControlBarSize;
  isMobileDockVisible: boolean;
  mobileDockPosition: MobileDockPosition;
  mobileDockSize: ControlBarSize;
  mobileDockAutoHideEnabled: boolean;
  pipPositions: Record<string, PIPPosition>;
  cowatchMinimized: boolean;
}

interface UIManagementActions {
  setActivePanel: (panel: ActivePanel) => void;
  setShowControls: (show: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  incrementUnreadMessageCount: () => void;
  resetUnreadMessageCount: () => void;
  setMainContentParticipant: (participantId: string | null) => void;
  setViewerModeParticipant: (participantId: string | null) => void;
  setControlBarPosition: (position: ControlBarPosition) => void;
  setIsControlBarDragging: (isDragging: boolean) => void;
  setControlBarSize: (size: ControlBarSize) => void;
  setMobileDockVisible: (visible: boolean) => void;
  toggleMobileDock: () => void;
  setMobileDockPosition: (position: MobileDockPosition) => void;
  setMobileDockSize: (size: ControlBarSize) => void;
  setMobileDockAutoHide: (enabled: boolean) => void;
  setPIPPosition: (userId: string, position: PIPPosition) => void;
  resetPIPPositions: () => void;
  setCowatchMinimized: (v: boolean) => void;
  reset: () => void;
}

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
  cowatchMinimized: false
};

export const useUIManagementStore = create<UIManagementState & UIManagementActions>((set, get) => ({
  ...INITIAL_STATE,
  setActivePanel: (panel) => {
    const currentPanel = get().activePanel;
    // For cowatch, don't toggle to 'none' if it's already active
    // This prevents the panel from closing when loading a video
    const newPanel = (currentPanel === panel && panel !== 'cowatch') ? 'none' : panel;
    if (newPanel === 'chat') {
      get().resetUnreadMessageCount();
    }
    set({ activePanel: newPanel });
  },
  setShowControls: (show) => set({ showControls: show }),
  setViewMode: (mode) => {
    set({ viewMode: mode });
    get().resetPIPPositions();
  },
  incrementUnreadMessageCount: () => set((state) => ({ unreadMessageCount: state.unreadMessageCount + 1 })),
  resetUnreadMessageCount: () => set({ unreadMessageCount: 0 }),
  setMainContentParticipant: (participantId) => set({ mainContentParticipantId: participantId }),
  setViewerModeParticipant: (participantId) => set({ viewerModeParticipantId: participantId }),
  setControlBarPosition: (position) => set({ controlBarPosition: position }),
  setIsControlBarDragging: (isDragging) => set({ isControlBarDragging: isDragging }),
  setControlBarSize: (size) => set({ controlBarSize: size }),
  setMobileDockVisible: (visible) => set({ isMobileDockVisible: visible }),
  toggleMobileDock: () => set((state) => ({ isMobileDockVisible: !state.isMobileDockVisible })),
  setMobileDockPosition: (position) => set({ mobileDockPosition: position }),
  setMobileDockSize: (size) => set({ mobileDockSize: size }),
  setMobileDockAutoHide: (enabled) => set({ mobileDockAutoHideEnabled: enabled }),
  setPIPPosition: (userId, position) => set((state) => ({ pipPositions: { ...state.pipPositions, [userId]: position } })),
  resetPIPPositions: () => set({ pipPositions: {} }),
  setCowatchMinimized: (v) => set({ cowatchMinimized: v }),
  reset: () => set(INITIAL_STATE)
}));
export type UIManagementStore = UIManagementState & UIManagementActions;
export const selectActivePanel = (state: UIManagementStore) => state.activePanel;
export const selectViewMode = (state: UIManagementStore) => state.viewMode;
export const selectPIPPosition = (userId: string) => (state: UIManagementStore) => state.pipPositions[userId];
export const selectUnreadCount = (state: UIManagementStore) => state.unreadMessageCount;
export const selectMobileDockState = (state: UIManagementStore) => ({ visible: state.isMobileDockVisible, position: state.mobileDockPosition, size: state.mobileDockSize, autoHide: state.mobileDockAutoHideEnabled });
