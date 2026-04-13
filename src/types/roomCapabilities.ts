import type { RoomType } from '@/types/room.types';

export interface RoomCapabilities {
  audio: true;
  camera: boolean;
  avatarRequired: boolean;
  screenShare: boolean;
  cameraOverlayInScreenShare: boolean;
  micTestInLobby: boolean;
  cameraTestInLobby: boolean;
}

export const DEFAULT_ROOM_TYPE: RoomType = 'video-group';

export const VALID_ROOM_TYPES: RoomType[] = [
  'audio-one-to-one',
  'audio-group',
  'video-one-to-one',
  'video-group',
];

export const isValidRoomType = (value: string | null | undefined): value is RoomType => {
  return !!value && VALID_ROOM_TYPES.includes(value as RoomType);
};

export const isAudioRoom = (roomType: RoomType): boolean => roomType.startsWith('audio-');

export const isVideoRoom = (roomType: RoomType): boolean => roomType.startsWith('video-');

export const isOneToOneRoom = (roomType: RoomType): boolean => roomType.endsWith('one-to-one');

export const getRoomCapacity = (roomType: RoomType): number => {
  if (roomType === 'audio-group') return 8;
  return isOneToOneRoom(roomType) ? 2 : 4;
};

export const getRoomCapabilities = (roomType: RoomType): RoomCapabilities => {
  const audioRoom = isAudioRoom(roomType);

  return {
    audio: true,
    camera: !audioRoom,
    avatarRequired: audioRoom,
    screenShare: true,
    cameraOverlayInScreenShare: !audioRoom,
    micTestInLobby: true,
    cameraTestInLobby: !audioRoom,
  };
};

export const getUpgradeTargetRoomType = (roomType: RoomType): RoomType => {
  if (roomType === 'audio-one-to-one') return 'video-one-to-one';
  if (roomType === 'audio-group') return 'video-group';
  return roomType;
};

export const getDefaultViewMode = (roomType: RoomType): 'grid' | 'speaker' => {
  return roomType === 'video-group' ? 'grid' : 'speaker';
};
