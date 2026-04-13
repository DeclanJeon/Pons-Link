import { Headphones, MessagesSquare, Shield, UsersRound } from 'lucide-react';
import { getRoomCapacity } from '@/types/roomCapabilities';

export type RoomType = 'audio-one-to-one' | 'audio-group' | 'video-one-to-one' | 'video-group';

export const ROOM_CAPACITY: Record<RoomType, number> = {
  'audio-one-to-one': getRoomCapacity('audio-one-to-one'),
  'audio-group': getRoomCapacity('audio-group'),
  'video-one-to-one': getRoomCapacity('video-one-to-one'),
  'video-group': getRoomCapacity('video-group'),
};

export const connectionModes: Array<{
  id: RoomType;
  title: string;
  description: string;
  icon: any;
}> = [
  {
    id: 'audio-one-to-one',
    title: '1:1 Audio',
    description: 'Private audio room. Max 2 participants. Camera hidden.',
    icon: Headphones,
  },
  {
    id: 'audio-group',
    title: 'Group Audio (8)',
    description: 'Group audio room. Max 8 participants. Mobile users are recommended to keep rooms at 6 or fewer.',
    icon: MessagesSquare,
  },
  {
    id: 'video-one-to-one',
    title: '1:1 Video',
    description: 'Private 1:1 video room. Max 2 participants.',
    icon: Shield,
  },
  {
    id: 'video-group',
    title: 'Group Video (4)',
    description: 'Group video room. Max 4 participants.',
    icon: UsersRound,
  },
];
