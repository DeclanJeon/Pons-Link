// src/stores/useDeviceMetadataStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { usePeerConnectionStore } from './usePeerConnectionStore';
import { useMediaQualityStore } from './useMediaQualityStore';
import {
  DEFAULT_MEDIA_QUALITY_SETTINGS,
  type AudioProcessingMode,
  type CameraPrivacyMode,
  type VideoQualityPreset,
} from '@/lib/media/mediaQuality';

export type VideoDisplayMode = 'fill' | 'balanced' | 'fit' | 'reframe';
export type ObjectFitOption = VideoDisplayMode;

export interface DeviceMetadata {
  isMobile: boolean;
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'large-desktop';
  preferredObjectFit: ObjectFitOption;
  cameraPrivacyMode: CameraPrivacyMode;
  videoQualityPreset: VideoQualityPreset;
  audioProcessingMode: AudioProcessingMode;
  aspectRatio: number;
  screenOrientation: 'portrait' | 'landscape';
}

const normalizeVideoDisplayMode = (value: unknown): VideoDisplayMode => {
  if (value === 'fill' || value === 'balanced' || value === 'fit' || value === 'reframe') return value;
  if (value === 'cover') return 'fill';
  if (value === 'contain' || value === 'scale-down') return 'fit';
  return 'balanced';
};

const normalizeCameraPrivacyMode = (value: unknown): CameraPrivacyMode => {
  if (value === 'camera' || value === 'avatar' || value === 'live-avatar') return value;
  return DEFAULT_MEDIA_QUALITY_SETTINGS.cameraPrivacyMode;
};

const normalizeVideoQualityPreset = (value: unknown): VideoQualityPreset => {
  if (value === 'auto' || value === 'data-saver' || value === 'standard' || value === 'hd') return value;
  return DEFAULT_MEDIA_QUALITY_SETTINGS.videoQualityPreset;
};

const normalizeAudioProcessingMode = (value: unknown): AudioProcessingMode => {
  if (value === 'voice-focus' || value === 'natural' || value === 'original-sound') return value;
  return DEFAULT_MEDIA_QUALITY_SETTINGS.audioProcessingMode;
};

const attachCurrentMediaStatus = (metadata: DeviceMetadata): DeviceMetadata => {
  const { cameraPrivacyMode, videoQualityPreset, audioProcessingMode } = useMediaQualityStore.getState();
  return {
    ...metadata,
    cameraPrivacyMode,
    videoQualityPreset,
    audioProcessingMode,
  };
};

const normalizeDeviceMetadata = (metadata: DeviceMetadata): DeviceMetadata => ({
  ...metadata,
  preferredObjectFit: normalizeVideoDisplayMode(metadata.preferredObjectFit),
  cameraPrivacyMode: normalizeCameraPrivacyMode(metadata.cameraPrivacyMode),
  videoQualityPreset: normalizeVideoQualityPreset(metadata.videoQualityPreset),
  audioProcessingMode: normalizeAudioProcessingMode(metadata.audioProcessingMode),
});

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
    preferredObjectFit: 'balanced',
    cameraPrivacyMode: DEFAULT_MEDIA_QUALITY_SETTINGS.cameraPrivacyMode,
    videoQualityPreset: DEFAULT_MEDIA_QUALITY_SETTINGS.videoQualityPreset,
    audioProcessingMode: DEFAULT_MEDIA_QUALITY_SETTINGS.audioProcessingMode,
    aspectRatio: width / height,
    screenOrientation: width > height ? 'landscape' : 'portrait'
  };
};

export const useDeviceMetadataStore = create<DeviceMetadataState & DeviceMetadataActions>()(
  persist(
    (set, get) => {
      // 초기 메타데이터 감지
      const initialMetadata = detectDeviceMetadata();
      
      return {
      localMetadata: initialMetadata,
      remoteMetadata: new Map(),

      updateLocalMetadata: (metadata) => {
        set((state) => ({
          localMetadata: { ...state.localMetadata, ...metadata }
        }));
        get().broadcastMetadata();
      },

      setPreferredObjectFit: (fit) => {
        const displayMode = normalizeVideoDisplayMode(fit);
        console.log('[DeviceMetadata] Setting video display mode:', displayMode);
        set((state) => ({
          localMetadata: { ...state.localMetadata, preferredObjectFit: displayMode }
        }));
        
        // 상태 업데이트 후 브로드캐스트
        setTimeout(() => {
          get().broadcastMetadata();
        }, 100);
      },

      updateRemoteMetadata: (userId, metadata) => {
        const normalizedMetadata = normalizeDeviceMetadata(metadata);

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[DeviceMetadata] 📥 Received remote metadata');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('User ID:', userId);
        console.log('Metadata:', JSON.stringify(normalizedMetadata, null, 2));
        
        set((state) => {
          const newMap = new Map(state.remoteMetadata);
          const existing = newMap.get(userId);
          
          console.log('Existing metadata:', existing ? JSON.stringify(existing, null, 2) : 'None');
          
          // 메타데이터가 실제로 변경된 경우에만 업데이트
          if (!existing || JSON.stringify(existing) !== JSON.stringify(normalizedMetadata)) {
            newMap.set(userId, normalizedMetadata);
            console.log('[DeviceMetadata] ✅ Remote metadata UPDATED for:', userId);
            console.log('New preferredObjectFit:', normalizedMetadata.preferredObjectFit);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            return { remoteMetadata: newMap };
          }
          
          console.log('[DeviceMetadata] ⏭️ No change, skipping update');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
          return state;
        });
      },

      getRemoteMetadata: (userId) => {
        return get().remoteMetadata.get(userId);
      },

      broadcastMetadata: () => {
        const { localMetadata } = get();
        const broadcastMetadata = attachCurrentMediaStatus(localMetadata);
        const { sendToAllPeers, webRTCManager } = usePeerConnectionStore.getState();
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[DeviceMetadata] 📤 Broadcasting metadata');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Local Metadata:', JSON.stringify(broadcastMetadata, null, 2));
        
        // 연결된 peer가 있을 때만 전송
        const connectedPeers = webRTCManager?.getConnectedPeerIds() || [];
        if (connectedPeers.length === 0) {
          console.warn('[DeviceMetadata] ⚠️ No connected peers, skipping broadcast');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
          return;
        }
        
        console.log(`[DeviceMetadata] 👥 Connected peers (${connectedPeers.length}):`, connectedPeers);
        
        const message = JSON.stringify({
          type: 'device-metadata',
          payload: broadcastMetadata
        });
        
        console.log('[DeviceMetadata] 📨 Message to send:', message);
        
        const result = sendToAllPeers(message);
        
        console.log(`[DeviceMetadata] ✅ Broadcast result: ${result.successful.length} successful, ${result.failed.length} failed`);
        if (result.successful.length > 0) {
          console.log('  ✓ Successful:', result.successful);
        }
        if (result.failed.length > 0) {
          console.log('  ✗ Failed:', result.failed);
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      },

      cleanup: () => {
        set({ remoteMetadata: new Map() });
      }
    };
    },
    {
      name: 'device-metadata-storage',
      partialize: (state) => ({ 
        localMetadata: {
          preferredObjectFit: state.localMetadata.preferredObjectFit
        }
      }),
      // 저장된 상태를 복원할 때 전체 메타데이터와 병합
      merge: (persistedState: any, currentState) => {
        const detectedMetadata = detectDeviceMetadata();
        return {
          ...currentState,
          localMetadata: {
            ...detectedMetadata,
            // 저장된 preferredObjectFit만 덮어쓰기
            preferredObjectFit: normalizeVideoDisplayMode(
              persistedState?.localMetadata?.preferredObjectFit ?? detectedMetadata.preferredObjectFit
            ),
            cameraPrivacyMode: detectedMetadata.cameraPrivacyMode,
            videoQualityPreset: detectedMetadata.videoQualityPreset,
            audioProcessingMode: detectedMetadata.audioProcessingMode,
          }
        };
      }
    }
  )
);
