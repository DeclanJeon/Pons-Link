export const detectProvider = (url: string): 'youtube' | null => {
  const u = url.toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  return null;
};

import { YouTubeProvider } from './youtube';

export const createProvider = (type: 'youtube', container: HTMLElement, options: {
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onTimeUpdate?: (time: number) => void;
  onVolumeChange?: (volume: number) => void;
  onRateChange?: (rate: number) => void;
  onStateChange?: (state: any) => void;
}): YouTubeProvider => {
  if (type === 'youtube') {
    return new YouTubeProvider(
      container,
      options.onReady ? () => {
        options.onReady?.();
      } : undefined,
      options.onStateChange ? (state) => {
        options.onStateChange?.(state);
      } : undefined,
      (error) => {
        console.error('Provider error:', error);
      }
    );
  }
  
  throw new Error(`Unsupported provider type: ${type}`);
};
