import { Shield, UsersRound } from 'lucide-react';

export type RoomType = 'one-to-one' | 'video-group';

export const ROOM_CAPACITY: Record<RoomType, number> = {
  'one-to-one': 2,
  'video-group': 4,
};

export const connectionModes: Array<{
  id: RoomType;
  title: string;
  description: string;
  icon: any;
}> = [
  {
    id: 'one-to-one',
    title: '1:1 Private',
    description: 'Private 1:1 room. Max 2 participants.',
    icon: Shield,
  },
  {
    id: 'video-group',
    title: 'Group Video (4)',
    description: 'Group video room. Max 4 participants.',
    icon: UsersRound,
  },
];
