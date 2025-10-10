import { create } from 'zustand';

export type ActivePanel = 'chat' | 'whiteboard' | 'settings' | 'fileStreaming' | 'none';
export type ViewMode = 'speaker' | 'grid';
export type ControlBarPosition = 'bottom' | 'left' | 'top' | 'right';
export type ControlBarSize = 'sm' | 'md' | 'lg';
export type MobileDockPosition = 'bottom' | 'left' | 'right'; // 모바일 dock 위치 (상단 제거)

interface UIManagementState {
  activePanel: ActivePanel;
  showControls: boolean;
  viewMode: ViewMode;
  unreadMessageCount: number;
  mainContentParticipantId: string | null;
  controlBarPosition: ControlBarPosition;
  isControlBarDragging: boolean;
  controlBarSize: ControlBarSize;
  
  // 모바일 dock 관련 상태
  isMobileDockVisible: boolean;
  mobileDockPosition: MobileDockPosition;
  mobileDockSize: ControlBarSize;
  mobileDockAutoHideEnabled: boolean;
}

interface UIManagementActions {
  setActivePanel: (panel: ActivePanel) => void;
  setShowControls: (show: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  incrementUnreadMessageCount: () => void;
  resetUnreadMessageCount: () => void;
  setMainContentParticipant: (participantId: string | null) => void;
  setControlBarPosition: (position: ControlBarPosition) => void;
  setIsControlBarDragging: (isDragging: boolean) => void;
  setControlBarSize: (size: ControlBarSize) => void;
  
  // 모바일 dock 관련 액션
  setMobileDockVisible: (visible: boolean) => void;
  toggleMobileDock: () => void;
  setMobileDockPosition: (position: MobileDockPosition) => void;
  setMobileDockSize: (size: ControlBarSize) => void;
  setMobileDockAutoHide: (enabled: boolean) => void;
  
  reset: () => void;
}

export const useUIManagementStore = create<UIManagementState & UIManagementActions>((set) => ({
  activePanel: 'none',
  showControls: true,
  viewMode: 'speaker',
  unreadMessageCount: 0,
  mainContentParticipantId: null,
  controlBarPosition: 'bottom',
  isControlBarDragging: false,
  controlBarSize: 'md',
  
  // 모바일 dock 초기값
  isMobileDockVisible: true,
  mobileDockPosition: 'bottom',
  mobileDockSize: 'md',
  mobileDockAutoHideEnabled: true,

  setActivePanel: (panel) => {
    const currentPanel = useUIManagementStore.getState().activePanel;
    const newPanel = currentPanel === panel ? 'none' : panel;
    
    if (newPanel === 'chat') {
      useUIManagementStore.getState().resetUnreadMessageCount();
    }
    
    set({ activePanel: newPanel });
  },

  setShowControls: (show) => set({ showControls: show }),
  
  setViewMode: (mode) => set({ viewMode: mode }),

  incrementUnreadMessageCount: () => set((state) => ({ unreadMessageCount: state.unreadMessageCount + 1 })),

  resetUnreadMessageCount: () => set({ unreadMessageCount: 0 }),

  setMainContentParticipant: (participantId) => set({ mainContentParticipantId: participantId }),
  setControlBarPosition: (position) => set({ controlBarPosition: position }),
  setIsControlBarDragging: (isDragging) => set({ isControlBarDragging: isDragging }),
  setControlBarSize: (size) => set({ controlBarSize: size }),
  
  // 모바일 dock 액션 구현
  setMobileDockVisible: (visible) => set({ isMobileDockVisible: visible }),
  
  toggleMobileDock: () => set((state) => ({ 
    isMobileDockVisible: !state.isMobileDockVisible 
  })),
  
  setMobileDockPosition: (position) => set({ mobileDockPosition: position }),
  
  setMobileDockSize: (size) => set({ mobileDockSize: size }),
  
  setMobileDockAutoHide: (enabled) => set({ mobileDockAutoHideEnabled: enabled }),

  reset: () => set({
    activePanel: 'none',
    showControls: true,
    viewMode: 'speaker',
    unreadMessageCount: 0,
    mainContentParticipantId: null,
    controlBarPosition: 'bottom',
    isControlBarDragging: false,
    controlBarSize: 'md',
    isMobileDockVisible: true,
    mobileDockPosition: 'bottom',
    mobileDockSize: 'md',
    mobileDockAutoHideEnabled: true,
  }),
}));
