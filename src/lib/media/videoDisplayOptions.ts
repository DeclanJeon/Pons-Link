import type { VideoDisplayMode } from '@/stores/useDeviceMetadataStore';

export const VIDEO_DISPLAY_OPTIONS: Array<{
  value: VideoDisplayMode;
  label: string;
  description: string;
}> = [
  {
    value: 'balanced',
    label: 'Balanced',
    description: 'Show your full camera frame with a subtle filled backdrop.',
  },
  {
    value: 'reframe',
    label: 'Center Face',
    description: 'Fill the tile and keep your face centered when detection is available.',
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
