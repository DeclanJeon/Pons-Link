import { create } from 'zustand';
import { produce } from 'immer';
import { nanoid } from 'nanoid';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useUIManagementStore } from '@/stores/useUIManagementStore';

type Role = 'host' | 'viewer';
type TabStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'ended' | 'error';
type Provider = 'youtube';

export type CoWatchTab = {
  id: string;
  url: string;
  provider: Provider;
  title?: string;
  ownerId: string;
  ownerName: string;
  status: TabStatus;
  duration?: number;
};

type CoWatchState = {
  tabs: CoWatchTab[];
  activeTabId: string | null;
  role: Role;
  hostId: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  muted: boolean;
  volume: number;
  captions: boolean;
  rate: number;
};

type CoWatchActions = {
  addTab: (url: string, ownerId: string, ownerName: string, provider: Provider) => string;
  addTabFromRemote: (url: string, ownerId: string, ownerName: string, provider: Provider) => string;
  addTabWithTitle: (url: string, ownerId: string, ownerName: string, provider: Provider, title: string) => string;
  removeTab: (tabId: string, broadcast?: boolean) => void;
  setActiveTab: (tabId: string) => void;
  setHost: (hostId: string) => void;
  setRole: (role: Role) => void;
  setMediaState: (patch: Partial<Omit<CoWatchState, 'tabs'>>) => void;
  applyRemote: (patch: Partial<Omit<CoWatchState, 'tabs'>>) => void;
  updateTabMeta: (tabId: string, patch: Partial<CoWatchTab>) => void;
  requestActivate: (tabId: string) => void;
  requestClose: (tabId: string) => void;
  broadcastControl: (payload: any) => void;
  broadcastState: () => void;
  canAutoActivate: () => boolean;
};

const initial: CoWatchState = {
  tabs: [],
  activeTabId: null,
  role: 'viewer',
  hostId: null,
  playing: false,
  currentTime: 0,
  duration: 0,
  muted: false,
  volume: 100,
  captions: false,
  rate: 1
};

export const useCoWatchStore = create<CoWatchState & CoWatchActions>()((set, get) => ({
  ...initial,
  
  addTab: (url, ownerId, ownerName, provider) => {
    const existingTab = get().tabs.find(tab => tab.url === url && tab.ownerId === ownerId);
    
    if (existingTab) {
      console.log('[CoWatch] Tab already exists, reactivating:', existingTab.id);
      set(produce((s: CoWatchState) => {
        s.activeTabId = existingTab.id;
      }));
      
      const { sendToAllPeers } = usePeerConnectionStore.getState();
      sendToAllPeers(JSON.stringify({ 
        type: 'cowatch-activate', 
        payload: { tabId: existingTab.id } 
      }));
      
      return existingTab.id;
    }
    
    const id = nanoid();
    set(produce((s: CoWatchState) => {
      s.tabs.push({ id, url, provider, ownerId, ownerName, status: 'idle' });
    }));
    
    const { sendToAllPeers } = usePeerConnectionStore.getState();
    sendToAllPeers(JSON.stringify({ 
      type: 'cowatch-load', 
      payload: { url, ownerId, ownerName, tabId: id, provider } 
    }));
    
    const uiStore = useUIManagementStore.getState();
    if (uiStore.activePanel !== 'cowatch') {
      uiStore.setActivePanel('cowatch');
    }
    
    return id;
  },
  
  addTabFromRemote: (url, ownerId, ownerName, provider) => {
    const existingTab = get().tabs.find(tab => tab.url === url && tab.ownerId === ownerId);
    
    if (existingTab) {
      console.log('[CoWatch Store] Tab already exists:', existingTab.id);
      return existingTab.id;
    }
    
    const id = nanoid();
    set(produce((s: CoWatchState) => {
      s.tabs.push({ id, url, provider, ownerId, ownerName, status: 'idle' });
    }));
    
    console.log('[CoWatch Store] Added remote tab:', id, url);
    
    const currentState = get();
    if (!currentState.activeTabId && currentState.tabs.length === 1) {
      console.log('[CoWatch Store] Auto-activating first tab');
      setTimeout(() => {
        const { setActiveTab } = get();
        setActiveTab(id);
      }, 200);
    }
    
    return id;
  },
  
  addTabWithTitle: (url, ownerId, ownerName, provider, title) => {
    const id = nanoid();
    set(produce((s: CoWatchState) => {
      s.tabs.push({ id, url, provider, ownerId, ownerName, status: 'idle', title });
    }));
    
    const { sendToAllPeers } = usePeerConnectionStore.getState();
    sendToAllPeers(JSON.stringify({ 
      type: 'cowatch-load', 
      payload: { url, ownerId, ownerName, tabId: id, provider, title } 
    }));
    
    const uiStore = useUIManagementStore.getState();
    if (uiStore.activePanel !== 'cowatch') {
      uiStore.setActivePanel('cowatch');
    }
    
    return id;
  },
  
  removeTab: (tabId, broadcast = false) => {
    const me = useSessionStore.getState().userId;
    const currentHostId = get().hostId;
    const tabToRemove = get().tabs.find(t => t.id === tabId);
    
    // Only host can remove tabs with broadcast
    if (broadcast && currentHostId !== me) {
      console.warn('[CoWatch] Only host can remove tabs with broadcast');
      return;
    }
    
    set(produce((s: CoWatchState) => {
      const i = s.tabs.findIndex(t => t.id === tabId);
      if (i >= 0) s.tabs.splice(i, 1);
      if (s.activeTabId === tabId) {
        s.activeTabId = null;
        s.playing = false;
        s.currentTime = 0;
        s.duration = 0;
      }
    }));
    
    if (broadcast) {
      const { sendToAllPeers } = usePeerConnectionStore.getState();
      sendToAllPeers(JSON.stringify({ type: 'cowatch-close', payload: { tabId } }));
    }
    
    console.log(`[CoWatch] Tab ${tabId} removed by ${me}, broadcast: ${broadcast}`);
  },
  
  setActiveTab: (tabId) => {
    const currentTab = get().tabs.find(x => x.id === tabId);
    if (!currentTab) {
      console.warn('[CoWatch Store] Cannot activate non-existent tab:', tabId);
      return;
    }
    
    console.log('[CoWatch Store] Setting active tab:', tabId);
    
    set(produce((s: CoWatchState) => {
      s.activeTabId = tabId;
      const t = s.tabs.find(x => x.id === tabId);
      if (t) t.status = 'loading';
      s.playing = false;
      s.currentTime = 0;
    }));
    
    const me = useSessionStore.getState().userId;
    if (me && get().hostId === me) {
      console.log('[CoWatch Store] Broadcasting tab activation as host');
      const { sendToAllPeers } = usePeerConnectionStore.getState();
      sendToAllPeers(JSON.stringify({ type: 'cowatch-activate', payload: { tabId } }));
    }
  },
  
  setHost: (hostId) => {
    const me = useSessionStore.getState().userId;
    const currentHostId = get().hostId;
    
    if (currentHostId !== hostId) {
      const newRole = me === hostId ? 'host' : 'viewer';
      set({ hostId, role: newRole });
      console.log(`[CoWatch Store] Host changed to ${hostId}, current user role: ${newRole}`);
    }
  },
  
  setRole: (role) => set({ role }),
  
  setMediaState: (patch) => set(patch as any),
  
  applyRemote: (patch) => set(patch as any),
  
  updateTabMeta: (tabId, patch) => {
    set(produce((s: CoWatchState) => {
      const t = s.tabs.find(x => x.id === tabId);
      if (t) Object.assign(t, patch);
    }));
  },
  
  requestActivate: (tabId) => {
    const { sendToAllPeers } = usePeerConnectionStore.getState();
    sendToAllPeers(JSON.stringify({ type: 'cowatch-activate', payload: { tabId } }));
  },
  
  requestClose: (tabId) => {
    const me = useSessionStore.getState().userId;
    const currentHostId = get().hostId;
    
    // Only host can request tab closure
    if (currentHostId !== me) {
      console.warn('[CoWatch] Only host can request tab closure');
      return;
    }
    
    const { sendToAllPeers } = usePeerConnectionStore.getState();
    sendToAllPeers(JSON.stringify({ type: 'cowatch-close-request', payload: { tabId } }));
    console.log(`[CoWatch] Host requested closure of tab ${tabId}`);
  },
  
  broadcastControl: (payload) => {
    const { sendToAllPeers } = usePeerConnectionStore.getState();
    sendToAllPeers(JSON.stringify({ type: 'cowatch-control', payload }));
  },
  
  broadcastState: () => {
    const s = get();
    
    if (!s.activeTabId) {
      console.warn('[CoWatch Store] No active tab to broadcast');
      return;
    }
    
    const statePayload = {
      type: 'cowatch-state',
      payload: {
        tabId: s.activeTabId,
        playing: s.playing,
        currentTime: s.currentTime,
        duration: s.duration,
        muted: s.muted,
        volume: s.volume,
        captions: s.captions,
        rate: s.rate
      }
    };
    
    console.log('[CoWatch Store] Broadcasting state:', statePayload.payload);
    
    const { sendToAllPeers } = usePeerConnectionStore.getState();
    sendToAllPeers(JSON.stringify(statePayload));
  },
  
  canAutoActivate: () => {
    const s = get();
    if (!s.activeTabId) return true;
    const t = s.tabs.find(x => x.id === s.activeTabId);
    if (!t) return true;
    return t.status === 'ended';
  }
}));
