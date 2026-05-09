import type { VideoDisplayMode } from '@/stores/useDeviceMetadataStore';

export const VIDEO_DISPLAY_OPTIONS: Array<{
  value: VideoDisplayMode;
  label: string;
  description: string;
}> = [
  {
    value: 'balanced',
    label: 'Smart Fit',
    description: 'Show your full camera frame and softly fill unused space.',
  },
  {
    value: 'fill',
    label: 'Fill Tile',
    description: 'Fill the tile edge to edge. Edges may crop.',
  },
  {
    value: 'fit',
    label: 'Full Frame',
    description: 'Show the entire camera frame with simple side padding.',
  },
];
