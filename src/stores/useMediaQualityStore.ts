import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_MEDIA_QUALITY_SETTINGS,
  type AudioProcessingMode,
  type CameraPrivacyMode,
  type MediaQualitySettings,
  type VideoQualityPreset,
} from '@/lib/media/mediaQuality';

type MediaQualityState = MediaQualitySettings;

interface MediaQualityActions {
  setVideoQualityPreset: (preset: VideoQualityPreset) => void;
  setAudioProcessingMode: (mode: AudioProcessingMode) => void;
  setCameraPrivacyMode: (mode: CameraPrivacyMode) => void;
  resetMediaQualitySettings: () => void;
  getMediaQualitySettings: () => MediaQualitySettings;
}

export const useMediaQualityStore = create<MediaQualityState & MediaQualityActions>()(
  persist(
    (set, get) => ({
      ...DEFAULT_MEDIA_QUALITY_SETTINGS,

      setVideoQualityPreset: (videoQualityPreset) => set({ videoQualityPreset }),

      setAudioProcessingMode: (audioProcessingMode) => set({ audioProcessingMode }),

      setCameraPrivacyMode: (cameraPrivacyMode) => set({ cameraPrivacyMode }),

      resetMediaQualitySettings: () => set(DEFAULT_MEDIA_QUALITY_SETTINGS),

      getMediaQualitySettings: () => {
        const { videoQualityPreset, audioProcessingMode, cameraPrivacyMode } = get();
        return { videoQualityPreset, audioProcessingMode, cameraPrivacyMode };
      },
    }),
    {
      name: 'ponslink-media-quality-settings',
      partialize: (state) => ({
        videoQualityPreset: state.videoQualityPreset,
        audioProcessingMode: state.audioProcessingMode,
        cameraPrivacyMode: state.cameraPrivacyMode,
      }),
    },
  ),
);
