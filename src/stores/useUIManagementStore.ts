import { create } from 'zustand';

export type PanelType = 'none' | 'chat' | 'whiteboard' | 'settings' | 'fileStreaming' | 'relay' | 'cowatch';
export type ViewMode = 'grid' | 'speaker' | 'viewer';
export type ControlBarPosition = 'top' | 'bottom' | 'left' | 'right';
export type ControlBarSize = 'sm' | 'md' | 'lg';
export type MobileDockPosition = 'left' | 'bottom' | 'right';

interface UIManagementState {
  activePanel: PanelType;
  openPanels: Set<PanelType>;
  panelZIndices: Map<PanelType, number>;
  nextZIndex: number;
  viewMode: ViewMode;
  mainContentParticipantId: string | null;
  unreadMessageCount: number;
  controlBarPosition: ControlBarPosition;
  isControlBarVisible: boolean;
  controlBarSize: ControlBarSize;
  isMobileDockVisible: boolean;
  mobileDockPosition: MobileDockPosition;
  mobileDockSize: ControlBarSize;
  mobileDockAutoHideEnabled: boolean;
  pipPositions: Record<string, { x: number; y: number }>;
  previousControlBarPosition: ControlBarPosition | null;
}

interface UIManagementActions {
  setActivePanel: (panel: PanelType) => void;
  openPanel: (panel: PanelType) => void;
  closePanel: (panel: PanelType) => void;
  bringPanelToFront: (panel: PanelType) => void;
  isPanelOpen: (panel: PanelType) => boolean;
  getPanelZIndex: (panel: PanelType) => number;
  setViewMode: (mode: ViewMode) => void;
  setMainContentParticipant: (participantId: string | null) => void;
  incrementUnreadMessageCount: () => void;
  resetUnreadMessageCount: () => void;
  setControlBarPosition: (position: ControlBarPosition) => void;
  setControlBarVisible: (visible: boolean) => void;
  setControlBarSize: (size: ControlBarSize) => void;
  setMobileDockVisible: (visible: boolean) => void;
  toggleMobileDock: () => void;
  setMobileDockPosition: (position: MobileDockPosition) => void;
  setMobileDockSize: (size: ControlBarSize) => void;
  setMobileDockAutoHide: (enabled: boolean) => void;
  setPIPPosition: (userId: string, position: { x: number; y: number }) => void;
  saveControlBarPosition: () => void;
  restoreControlBarPosition: () => void;
  reset: () => void;
}

const BASE_Z_INDEX = 30;

const initialState: UIManagementState = {
  activePanel: 'none',
  openPanels: new Set(),
  panelZIndices: new Map(),
  nextZIndex: BASE_Z_INDEX,
  viewMode: 'grid',
  mainContentParticipantId: null,
  unreadMessageCount: 0,
  controlBarPosition: 'bottom',
  isControlBarVisible: true,
  controlBarSize: 'md',
  isMobileDockVisible: true,
  mobileDockPosition: 'bottom',
  mobileDockSize: 'md',
  mobileDockAutoHideEnabled: true,
  pipPositions: {},
  previousControlBarPosition: null,
};

export const useUIManagementStore = create<UIManagementState & UIManagementActions>((set, get) => ({
  ...initialState,

  setActivePanel: (panel) => {
    set({ activePanel: panel });
    if (panel !== 'none') {
      get().openPanel(panel);
    }
  },

  openPanel: (panel) => {
    if (panel === 'none') return;
    
    const { openPanels, panelZIndices, nextZIndex } = get();
    const newOpenPanels = new Set(openPanels);
    newOpenPanels.add(panel);
    
    const newPanelZIndices = new Map(panelZIndices);
    newPanelZIndices.set(panel, nextZIndex);
    
    set({
      activePanel: panel,
      openPanels: newOpenPanels,
      panelZIndices: newPanelZIndices,
      nextZIndex: nextZIndex + 1
    });

    if (panel === 'cowatch') {
      get().saveControlBarPosition();
      get().setControlBarPosition('left');
    }
  },

  closePanel: (panel) => {
    const { openPanels, panelZIndices, activePanel } = get();
    const newOpenPanels = new Set(openPanels);
    newOpenPanels.delete(panel);
    
    const newPanelZIndices = new Map(panelZIndices);
    newPanelZIndices.delete(panel);
    
    const updates: Partial<UIManagementState> = {
      openPanels: newOpenPanels,
      panelZIndices: newPanelZIndices
    };
    
    if (activePanel === panel) {
      const remainingPanels = Array.from(newOpenPanels);
      if (remainingPanels.length > 0) {
        const highestZPanel = remainingPanels.reduce((highest, current) => {
          const currentZ = newPanelZIndices.get(current) || 0;
          const highestZ = newPanelZIndices.get(highest) || 0;
          return currentZ > highestZ ? current : highest;
        });
        updates.activePanel = highestZPanel;
      } else {
        updates.activePanel = 'none';
      }
    }
    
    set(updates);

    if (panel === 'cowatch') {
      console.log('[UIManagement] CoWatch panel closed, cleaning up');
      get().restoreControlBarPosition();
    }
  },

  bringPanelToFront: (panel) => {
    if (panel === 'none') return;
    
    const { panelZIndices, nextZIndex } = get();
    const newPanelZIndices = new Map(panelZIndices);
    newPanelZIndices.set(panel, nextZIndex);
    
    set({
      activePanel: panel,
      panelZIndices: newPanelZIndices,
      nextZIndex: nextZIndex + 1
    });
  },

  isPanelOpen: (panel) => {
    return get().openPanels.has(panel);
  },

  getPanelZIndex: (panel) => {
    return get().panelZIndices.get(panel) || BASE_Z_INDEX;
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  setMainContentParticipant: (participantId) => set({ mainContentParticipantId: participantId }),

  incrementUnreadMessageCount: () =>
    set((state) => ({ unreadMessageCount: state.unreadMessageCount + 1 })),

  resetUnreadMessageCount: () => set({ unreadMessageCount: 0 }),

  setControlBarPosition: (position) => set({ controlBarPosition: position }),

  setControlBarVisible: (visible) => set({ isControlBarVisible: visible }),

  setControlBarSize: (size) => set({ controlBarSize: size }),

  setMobileDockVisible: (visible) => set({ isMobileDockVisible: visible }),

  toggleMobileDock: () => set((state) => ({ isMobileDockVisible: !state.isMobileDockVisible })),

  setMobileDockPosition: (position) => set({ mobileDockPosition: position }),

  setMobileDockSize: (size) => set({ mobileDockSize: size }),

  setMobileDockAutoHide: (enabled) => set({ mobileDockAutoHideEnabled: enabled }),

  setPIPPosition: (userId, position) => set((state) => ({
    pipPositions: {
      ...state.pipPositions,
      [userId]: position
    }
  })),

  saveControlBarPosition: () => {
    const { controlBarPosition, previousControlBarPosition } = get();
    if (previousControlBarPosition === null) {
      set({ previousControlBarPosition: controlBarPosition });
    }
  },

  restoreControlBarPosition: () => {
    const { previousControlBarPosition } = get();
    if (previousControlBarPosition !== null) {
      set({ 
        controlBarPosition: previousControlBarPosition,
        previousControlBarPosition: null 
      });
    }
  },

  reset: () => set({
    ...initialState,
    openPanels: new Set(),
    panelZIndices: new Map(),
    pipPositions: {},
  }),
}));
