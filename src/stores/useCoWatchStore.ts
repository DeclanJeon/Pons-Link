import { create } from 'zustand';
import { produce } from 'immer';
import { nanoid } from 'nanoid';
import { useCallback } from 'react';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useUIManagementStore } from '@/stores/useUIManagementStore';
import { normalizeYouTubeURL, CoWatchURLError } from '@/lib/cowatch/url-validator';
import { toast } from 'sonner';

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
  isLoading: boolean;
  loadingMessage: string;
  lastBroadcastTime: number;
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
  handleHostLeft: (leftUserId: string) => void;
  syncStateToNewPeer: (peerId: string) => void;
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
  rate: 1,
  isLoading: false,
  loadingMessage: '',
  lastBroadcastTime: 0
};

let broadcastTimeoutId: NodeJS.Timeout | null = null;
const BROADCAST_DEBOUNCE_MS = 500;

let lastBroadcastState: string | null = null;

export const useCoWatchStore = create<CoWatchState & CoWatchActions>()((set, get) => ({
  ...initial,
  
  addTab: (url, ownerId, ownerName, provider) => {
    set({ isLoading: true, loadingMessage: 'Validating URL...' });
    
    let normalizedUrl: string;
    
    try {
      normalizedUrl = normalizeYouTubeURL(url);
    } catch (error) {
      set({ isLoading: false, loadingMessage: '' });
      
      if (error instanceof CoWatchURLError) {
        toast.error(error.userMessage);
      } else {
        toast.error('Invalid YouTube URL');
      }
      console.error('[CoWatch] URL validation failed:', error);
      return '';
    }
    
    set({ loadingMessage: 'Checking for existing tab...' });
    
    const existingTab = get().tabs.find(
      tab => tab.url === normalizedUrl && tab.ownerId === ownerId
    );
    
    if (existingTab) {
      console.log('[CoWatch] Tab already exists, reactivating:', existingTab.id);
      set(produce((s: CoWatchState) => {
        s.activeTabId = existingTab.id;
        s.isLoading = false;
        s.loadingMessage = '';
      }));
      
      const { sendToAllPeers } = usePeerConnectionStore.getState();
      
      setTimeout(() => {
        const sent = sendToAllPeers(JSON.stringify({
          type: 'cowatch-load',
          payload: {
            url: normalizedUrl,
            ownerId,
            ownerName,
            tabId: existingTab.id,
            provider,
            title: existingTab.title,
            timestamp: Date.now()
          }
        }));
        
        console.log('[CoWatch] Reactivation broadcast result:', sent);
        
        if (sent.failed.length > 0) {
          console.warn('[CoWatch] Failed to notify peers:', sent.failed);
          toast.warning(`Failed to notify ${sent.failed.length} peer(s)`);
        }
      }, 100);
      
      toast.success('Video reactivated');
      return existingTab.id;
    }
    
    set({ loadingMessage: 'Adding new video...' });
    
    const id = nanoid();
    set(produce((s: CoWatchState) => {
      s.tabs.push({
        id,
        url: normalizedUrl,
        provider,
        ownerId,
        ownerName,
        status: 'loading'
      });
      s.loadingMessage = 'Notifying peers...';
    }));
    
    const { sendToAllPeers } = usePeerConnectionStore.getState();
    
    setTimeout(() => {
      const sent = sendToAllPeers(JSON.stringify({
        type: 'cowatch-load',
        payload: {
          url: normalizedUrl,
          ownerId,
          ownerName,
          tabId: id,
          provider,
          timestamp: Date.now()
        }
      }));
      
      console.log('[CoWatch] New tab broadcast result:', sent);
      
      if (sent.failed.length > 0) {
        console.error('[CoWatch] Failed to notify peers:', sent.failed);
        toast.warning(`Failed to notify ${sent.failed.length} peer(s). They may need to refresh.`);
      } else if (sent.successful.length === 0) {
        console.warn('[CoWatch] No peers to notify');
        toast.info('No other participants in the room yet');
      }
    }, 200);
    
    const uiStore = useUIManagementStore.getState();
    if (uiStore.activePanel !== 'cowatch') {
      uiStore.setActivePanel('cowatch');
    }
    
    setTimeout(() => {
      set({ isLoading: false, loadingMessage: '' });
      toast.success('Video added successfully');
    }, 1000);
    
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
    let normalizedUrl: string;
    
    try {
      normalizedUrl = normalizeYouTubeURL(url);
    } catch (error) {
      if (error instanceof CoWatchURLError) {
        toast.error(error.userMessage);
      } else {
        toast.error('Invalid YouTube URL');
      }
      console.error('[CoWatch] URL validation failed:', error);
      return '';
    }
    
    const id = nanoid();
    set(produce((s: CoWatchState) => {
      s.tabs.push({ id, url: normalizedUrl, provider, ownerId, ownerName, status: 'idle', title });
    }));
    
    const { sendToAllPeers } = usePeerConnectionStore.getState();
    sendToAllPeers(JSON.stringify({ 
      type: 'cowatch-load', 
      payload: { url: normalizedUrl, ownerId, ownerName, tabId: id, provider, title } 
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
  
  setMediaState: (patch) => {
    const current = get();
    
    const hasRealChange = Object.entries(patch).some(([key, value]) => {
      const currentValue = current[key as keyof CoWatchState];
      
      if (key === 'currentTime' && typeof value === 'number' && typeof currentValue === 'number') {
        return Math.abs(value - currentValue) > 1.0;
      }
      
      if (key === 'volume' && typeof value === 'number' && typeof currentValue === 'number') {
        return Math.abs(value - currentValue) > 5;
      }
      
      return value !== currentValue;
    });
    
    if (!hasRealChange) {
      return;
    }
    
    set(patch as any);
  },
  
  applyRemote: (patch) => {
    const current = get();
    const me = useSessionStore.getState().userId;
    
    if (current.hostId === me) {
      return;
    }
    
    const filteredPatch: any = {};
    
    Object.entries(patch).forEach(([key, value]) => {
      const currentValue = current[key as keyof CoWatchState];
      
      if (key === 'currentTime' && typeof value === 'number' && typeof currentValue === 'number') {
        if (Math.abs(value - currentValue) > 2.0) {
          filteredPatch[key] = value;
        }
      } else if (value !== currentValue) {
        filteredPatch[key] = value;
      }
    });
    
    if (Object.keys(filteredPatch).length > 0) {
      set(filteredPatch);
    }
  },
  
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
    const now = Date.now();
    const state = get();
    
    if (now - state.lastBroadcastTime < BROADCAST_DEBOUNCE_MS) {
      return;
    }
    
    if (!state.activeTabId) {
      console.warn('[CoWatch Store] No active tab to broadcast');
      return;
    }
    
    const me = useSessionStore.getState().userId;
    if (state.hostId !== me) {
      return;
    }
    
    const statePayload = {
      type: 'cowatch-state',
      payload: {
        tabId: state.activeTabId,
        playing: state.playing,
        currentTime: Math.round(state.currentTime * 10) / 10,
        duration: Math.round(state.duration),
        muted: state.muted,
        volume: Math.round(state.volume),
        captions: state.captions,
        rate: state.rate
      }
    };
    
    const stateString = JSON.stringify(statePayload);
    
    if (stateString === lastBroadcastState) {
      return;
    }
    
    lastBroadcastState = stateString;
    
    console.log('[CoWatch Store] Broadcasting state:', statePayload.payload);
    
    const { sendToAllPeers } = usePeerConnectionStore.getState();
    sendToAllPeers(stateString);
    
    set({ lastBroadcastTime: now });
  },
  
  canAutoActivate: () => {
    const s = get();
    if (!s.activeTabId) return true;
    const t = s.tabs.find(x => x.id === s.activeTabId);
    if (!t) return true;
    return t.status === 'ended';
  },
  
  handleHostLeft: (leftUserId: string) => {
    const state = get();
    
    if (state.hostId !== leftUserId) return;
    
    console.log('[CoWatch] Host left, reassigning...');
    
    const me = useSessionStore.getState().userId;
    const peers = usePeerConnectionStore.getState().peers;
    const connectedPeers = Array.from(peers.keys()).filter(
      id => peers.get(id)?.connectionState === 'connected'
    );
    
    let newHostId: string;
    
    if (connectedPeers.length === 0) {
      newHostId = me || '';
    } else {
      const allUsers = [me, ...connectedPeers].filter(Boolean).sort();
      newHostId = allUsers[0] || me || '';
    }
    
    console.log('[CoWatch] New host assigned:', newHostId);
    
    get().setHost(newHostId);
    
    if (newHostId === me) {
      const { sendToAllPeers } = usePeerConnectionStore.getState();
      sendToAllPeers(JSON.stringify({
        type: 'cowatch-host',
        payload: { hostId: newHostId }
      }));
      
      toast.info('You are now the CoWatch host', { duration: 3000 });
    }
  },
  
  syncStateToNewPeer: (peerId: string) => {
    const state = get();
    
    if (!state.activeTabId) {
      console.log('[CoWatch] No active tab to sync');
      return;
    }
    
    const activeTab = state.tabs.find(t => t.id === state.activeTabId);
    if (!activeTab) return;
    
    const { sendToPeer } = usePeerConnectionStore.getState();
    
    sendToPeer(peerId, JSON.stringify({
      type: 'cowatch-load',
      payload: {
        url: activeTab.url,
        ownerId: activeTab.ownerId,
        ownerName: activeTab.ownerName,
        tabId: activeTab.id,
        provider: activeTab.provider,
        title: activeTab.title
      }
    }));
    
    setTimeout(() => {
      sendToPeer(peerId, JSON.stringify({
        type: 'cowatch-state',
        payload: {
          tabId: state.activeTabId,
          playing: state.playing,
          currentTime: state.currentTime,
          duration: state.duration,
          muted: state.muted,
          volume: state.volume,
          captions: state.captions,
          rate: state.rate
        }
      }));
    }, 1000);
    
    console.log('[CoWatch] Synced state to new peer:', peerId);
  },
}));

// 선택적 구독을 위한 커스텀 훅 - 개별 상태 선택으로 무한 루프 방지
export const useCoWatchMedia = () => {
  const playing = useCoWatchStore(state => state.playing);
  const currentTime = useCoWatchStore(state => state.currentTime);
  const duration = useCoWatchStore(state => state.duration);
  const muted = useCoWatchStore(state => state.muted);
  const volume = useCoWatchStore(state => state.volume);
  const rate = useCoWatchStore(state => state.rate);
  
  return {
    playing,
    currentTime,
    duration,
    muted,
    volume,
    rate
  };
};

export const useCoWatchTabs = () => {
  const tabs = useCoWatchStore(state => state.tabs);
  const activeTabId = useCoWatchStore(state => state.activeTabId);
  
  return {
    tabs,
    activeTabId
  };
};

export const useCoWatchRole = () => {
  const role = useCoWatchStore(state => state.role);
  const hostId = useCoWatchStore(state => state.hostId);
  
  return {
    role,
    hostId
  };
};

export const useCoWatchUI = () => {
  const isLoading = useCoWatchStore(state => state.isLoading);
  const loadingMessage = useCoWatchStore(state => state.loadingMessage);
  
  return {
    isLoading,
    loadingMessage
  };
};

// 상태 업데이트를 위한 안전한 훅
export const useCoWatchActions = () => {
  const addTab = useCoWatchStore(state => state.addTab);
  const addTabFromRemote = useCoWatchStore(state => state.addTabFromRemote);
  const addTabWithTitle = useCoWatchStore(state => state.addTabWithTitle);
  const removeTab = useCoWatchStore(state => state.removeTab);
  const setActiveTab = useCoWatchStore(state => state.setActiveTab);
  const setHost = useCoWatchStore(state => state.setHost);
  const setRole = useCoWatchStore(state => state.setRole);
  const setMediaState = useCoWatchStore(state => state.setMediaState);
  const applyRemote = useCoWatchStore(state => state.applyRemote);
  const updateTabMeta = useCoWatchStore(state => state.updateTabMeta);
  const requestActivate = useCoWatchStore(state => state.requestActivate);
  const requestClose = useCoWatchStore(state => state.requestClose);
  const broadcastControl = useCoWatchStore(state => state.broadcastControl);
  const broadcastState = useCoWatchStore(state => state.broadcastState);
  const canAutoActivate = useCoWatchStore(state => state.canAutoActivate);
  const handleHostLeft = useCoWatchStore(state => state.handleHostLeft);
  const syncStateToNewPeer = useCoWatchStore(state => state.syncStateToNewPeer);
  
  return {
    addTab,
    addTabFromRemote,
    addTabWithTitle,
    removeTab,
    setActiveTab,
    setHost,
    setRole,
    setMediaState,
    applyRemote,
    updateTabMeta,
    requestActivate,
    requestClose,
    broadcastControl,
    broadcastState,
    canAutoActivate,
    handleHostLeft,
    syncStateToNewPeer
  };
};
