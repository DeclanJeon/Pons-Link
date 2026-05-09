export type VideoQualityPreset = 'auto' | 'data-saver' | 'standard' | 'hd';
export type AudioProcessingMode = 'voice-focus' | 'natural' | 'original-sound';
export type CameraPrivacyMode = 'camera' | 'avatar' | 'live-avatar';

export interface MediaQualitySettings {
  videoQualityPreset: VideoQualityPreset;
  audioProcessingMode: AudioProcessingMode;
  cameraPrivacyMode: CameraPrivacyMode;
  localVideoMirrored: boolean;
}

export interface OutboundVideoEncodingProfile {
  maxBitrate: number;
  maxFramerate: number;
  scaleResolutionDownBy: number;
  degradationPreference: 'maintain-framerate' | 'maintain-resolution' | 'balanced';
}

export const DEFAULT_MEDIA_QUALITY_SETTINGS: MediaQualitySettings = {
  videoQualityPreset: 'auto',
  audioProcessingMode: 'voice-focus',
  cameraPrivacyMode: 'camera',
  localVideoMirrored: true,
};

export const VIDEO_QUALITY_OPTIONS: Array<{
  value: VideoQualityPreset;
  label: string;
  description: string;
}> = [
  { value: 'auto', label: 'Auto', description: 'Let PonsLink balance clarity and connection stability.' },
  { value: 'data-saver', label: 'Data Saver', description: 'Lower resolution and frame rate for weak networks.' },
  { value: 'standard', label: 'Standard', description: '720p camera quality for most meetings.' },
  { value: 'hd', label: 'HD', description: 'Prefer 1080p when the camera and network support it.' },
];

export const AUDIO_PROCESSING_OPTIONS: Array<{
  value: AudioProcessingMode;
  label: string;
  description: string;
}> = [
  { value: 'voice-focus', label: 'Voice Focus', description: 'Noise suppression, echo cancellation, and auto gain for calls.' },
  { value: 'natural', label: 'Natural Voice', description: 'Keeps protection on while reducing voice processing.' },
  { value: 'original-sound', label: 'Original Sound', description: 'Minimizes browser processing for music or room audio.' },
];

export const CAMERA_PRIVACY_OPTIONS: Array<{
  value: CameraPrivacyMode;
  label: string;
  description: string;
}> = [
  { value: 'camera', label: 'Camera', description: 'Send the selected camera normally.' },
  { value: 'avatar', label: 'Avatar', description: 'Send your avatar instead of the camera video.' },
  { value: 'live-avatar', label: 'Live Avatar', description: 'Track your face locally and send an animated avatar.' },
];

export const getVideoTrackConstraints = (preset: VideoQualityPreset): MediaTrackConstraints => {
  switch (preset) {
    case 'data-saver':
      return {
        width: { ideal: 640, max: 854 },
        height: { ideal: 360, max: 480 },
        frameRate: { ideal: 15, max: 20 },
        aspectRatio: { ideal: 16 / 9 },
      };
    case 'standard':
      return {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 30 },
        aspectRatio: { ideal: 16 / 9 },
      };
    case 'hd':
      return {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30, max: 30 },
        aspectRatio: { ideal: 16 / 9 },
      };
    case 'auto':
    default:
      return {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 30 },
        aspectRatio: { ideal: 16 / 9 },
      };
  }
};

export const getAudioTrackConstraints = (mode: AudioProcessingMode): MediaTrackConstraints => {
  switch (mode) {
    case 'original-sound':
      return {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: { ideal: 2 },
        sampleRate: { ideal: 48000 },
      };
    case 'natural':
      return {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
        channelCount: { ideal: 1 },
        sampleRate: { ideal: 48000 },
      };
    case 'voice-focus':
    default:
      return {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: { ideal: 1 },
        sampleRate: { ideal: 48000 },
      };
  }
};

export const getOutboundVideoEncodingProfile = (preset: VideoQualityPreset): OutboundVideoEncodingProfile => {
  switch (preset) {
    case 'data-saver':
      return {
        maxBitrate: 800_000,
        maxFramerate: 20,
        scaleResolutionDownBy: 2,
        degradationPreference: 'maintain-framerate',
      };
    case 'standard':
      return {
        maxBitrate: 2_500_000,
        maxFramerate: 30,
        scaleResolutionDownBy: 1,
        degradationPreference: 'balanced',
      };
    case 'hd':
      return {
        maxBitrate: 4_500_000,
        maxFramerate: 30,
        scaleResolutionDownBy: 1,
        degradationPreference: 'maintain-resolution',
      };
    case 'auto':
    default:
      return {
        maxBitrate: 2_500_000,
        maxFramerate: 30,
        scaleResolutionDownBy: 1,
        degradationPreference: 'balanced',
      };
  }
};
