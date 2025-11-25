// src/stores/useDeviceMetadataStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { usePeerConnectionStore } from './usePeerConnectionStore';

export type ObjectFitOption = 'cover' | 'contain' | 'fill' | 'scale-down';

export interface DeviceMetadata {
  isMobile: boolean;
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'large-desktop';
  preferredObjectFit: ObjectFitOption;
  aspectRatio: number;
  screenOrientation: 'portrait' | 'landscape';
}

interface DeviceMetadataState {
  localMetadata: DeviceMetadata;
  remoteMetadata: Map<string, DeviceMetadata>;
}

interface DeviceMetadataActions {
  updateLocalMetadata: (metadata: Partial<DeviceMetadata>) => void;
  setPreferredObjectFit: (fit: ObjectFitOption) => void;
  updateRemoteMetadata: (userId: string, metadata: DeviceMetadata) => void;
  getRemoteMetadata: (userId: string) => DeviceMetadata | undefined;
  broadcastMetadata: () => void;
  cleanup: () => void;
}

const detectDeviceMetadata = (): DeviceMetadata => {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  let deviceType: DeviceMetadata['deviceType'] = 'desktop';
  if (width <= 414) deviceType = 'mobile';
  else if (width <= 1024) deviceType = 'tablet';
  else if (width <= 1920) deviceType = 'desktop';
  else deviceType = 'large-desktop';
  
  return {
    isMobile,
    deviceType,
    preferredObjectFit: isMobile ? 'contain' : 'cover',
    aspectRatio: width / height,
    screenOrientation: width > height ? 'landscape' : 'portrait'
  };
};

export const useDeviceMetadataStore = create<DeviceMetadataState & DeviceMetadataActions>()(
  persist(
    (set, get) => ({
      localMetadata: detectDeviceMetadata(),
      remoteMetadata: new Map(),

      updateLocalMetadata: (metadata) => {
        set((state) => ({
          localMetadata: { ...state.localMetadata, ...metadata }
        }));
        get().broadcastMetadata();
      },

      setPreferredObjectFit: (fit) => {
        set((state) => ({
          localMetadata: { ...state.localMetadata, preferredObjectFit: fit }
        }));
        get().broadcastMetadata();
      },

      updateRemoteMetadata: (userId, metadata) => {
        set((state) => {
          const newMap = new Map(state.remoteMetadata);
          newMap.set(userId, metadata);
          return { remoteMetadata: newMap };
        });
      },

      getRemoteMetadata: (userId) => {
        return get().remoteMetadata.get(userId);
      },

      broadcastMetadata: () => {
        const { localMetadata } = get();
        const { sendToAllPeers, webRTCManager } = usePeerConnectionStore.getState();
        
        // 연결된 peer가 있을 때만 전송
        const connectedPeers = webRTCManager?.getConnectedPeerIds() || [];
        if (connectedPeers.length === 0) {
          console.log('[DeviceMetadata] No connected peers, skipping broadcast');
          return;
        }
        
        const result = sendToAllPeers(JSON.stringify({
          type: 'device-metadata',
          payload: localMetadata
        }));
        
        console.log('[DeviceMetadata] Broadcast result:', result);
      },

      cleanup: () => {
        set({ remoteMetadata: new Map() });
      }
    }),
    {
      name: 'device-metadata-storage',
      partialize: (state) => ({ 
        localMetadata: {
          preferredObjectFit: state.localMetadata.preferredObjectFit
        }
      })
    }
  )
);
