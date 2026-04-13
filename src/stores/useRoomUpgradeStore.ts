import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';
import { usePeerConnectionStore } from './usePeerConnectionStore';
import { useSessionStore } from './useSessionStore';
import { useSignalingStore } from './useSignalingStore';
import type { RoomType } from '@/types/room.types';
import { getUpgradeTargetRoomType, isAudioRoom } from '@/types/roomCapabilities';

export type RoomUpgradeStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'committed';

export interface RoomUpgradeRequest {
  requestId: string;
  roomId: string;
  roomTitle: string;
  sourceRoomType: RoomType;
  targetRoomType: RoomType;
  requesterId: string;
  requesterNickname: string;
  participantIds: string[];
  approvals: string[];
  rejections: string[];
  status: RoomUpgradeStatus;
  createdAt: number;
  expiresAt: number;
  targetRoomTitle?: string;
}

interface RoomMigrationIssued {
  requestId: string;
  sourceRoomId: string;
  sourceRoomTitle: string;
  sourceRoomType: RoomType;
  targetRoomId: string;
  targetRoomTitle: string;
  targetRoomType: RoomType;
  participantIds: string[];
  issuedAt: number;
}

interface RoomUpgradeState {
  activeRequest: RoomUpgradeRequest | null;
  lastCommittedRequest: RoomUpgradeRequest | null;
  lastMigration: RoomMigrationIssued | null;
}

interface RoomUpgradeActions {
  requestUpgrade: (params: { roomId: string; roomTitle: string; roomType: RoomType }) => void;
  approveUpgrade: (requestId: string) => void;
  rejectUpgrade: (requestId: string) => void;
  handleIncomingEvent: (event: { type: string; from?: string; data?: any; payload?: any }) => void;
  clearRequest: () => void;
}

const REQUEST_TIMEOUT_MS = 30_000;

const buildTargetTitle = (roomTitle: string) => roomTitle;

export const useRoomUpgradeStore = create<RoomUpgradeState & RoomUpgradeActions>((set, get) => ({
  activeRequest: null,
  lastCommittedRequest: null,
  lastMigration: null,

  requestUpgrade: ({ roomId, roomTitle, roomType }) => {
    if (!isAudioRoom(roomType)) {
      toast.error('Video upgrade is only available from audio rooms.');
      return;
    }

    if (get().activeRequest?.status === 'pending') {
      toast.info('A room upgrade request is already in progress.');
      return;
    }

    const session = useSessionStore.getState();
    if (!session.userId || !session.nickname) {
      toast.error('Session is not ready yet.');
      return;
    }

    const peerIds = Array.from(usePeerConnectionStore.getState().peers.keys());
    const participantIds = [session.userId, ...peerIds].sort();
    const request: RoomUpgradeRequest = {
      requestId: nanoid(),
      roomId,
      roomTitle,
      sourceRoomType: roomType,
      targetRoomType: getUpgradeTargetRoomType(roomType),
      requesterId: session.userId,
      requesterNickname: session.nickname,
      participantIds,
      approvals: [session.userId],
      rejections: [],
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.now() + REQUEST_TIMEOUT_MS,
    };

    set({ activeRequest: request });
    useSignalingStore.getState().emit('message', {
      type: 'video-upgrade-requested',
      data: request,
    });
    toast.info('화상 방 전환 요청을 보냈습니다.');
  },

  approveUpgrade: (requestId) => {
    const session = useSessionStore.getState();
    const active = get().activeRequest;
    if (!active || active.requestId !== requestId || !session.userId) return;

    if (!active.approvals.includes(session.userId)) {
      const next = {
        ...active,
        approvals: [...active.approvals, session.userId],
      };
      set({ activeRequest: next });
    }

    useSignalingStore.getState().emit('message', {
      type: 'video-upgrade-approved',
      data: { requestId, userId: session.userId },
    });
  },

  rejectUpgrade: (requestId) => {
    const session = useSessionStore.getState();
    const active = get().activeRequest;
    if (!active || active.requestId !== requestId || !session.userId) return;

    const next = {
      ...active,
      rejections: active.rejections.includes(session.userId) ? active.rejections : [...active.rejections, session.userId],
      status: 'rejected' as const,
    };
    set({ activeRequest: next });
    useSignalingStore.getState().emit('message', {
      type: 'video-upgrade-rejected',
      data: { requestId, userId: session.userId },
    });
    toast.info('화상 방 전환 요청을 거절했습니다.');
  },

  handleIncomingEvent: (event) => {
    const payload = event.data ?? event.payload;
    const active = get().activeRequest;

    switch (event.type) {
      case 'video-upgrade-requested': {
        const request = payload as RoomUpgradeRequest;
        set({ activeRequest: request });
        if (request.requesterId !== useSessionStore.getState().userId) {
          toast.info(`${request.requesterNickname}님이 화상 방 전환을 요청했습니다.`);
        }
        return;
      }
      case 'video-upgrade-approved': {
        if (!active || active.requestId !== payload?.requestId) return;
        const userId = payload.userId as string;
        const approvals = active.approvals.includes(userId) ? active.approvals : [...active.approvals, userId];
        const next = { ...active, approvals };
        set({ activeRequest: next });
        return;
      }
      case 'video-upgrade-rejected': {
        if (!active || active.requestId !== payload?.requestId) return;
        const userId = payload.userId as string;
        const next = {
          ...active,
          rejections: active.rejections.includes(userId) ? active.rejections : [...active.rejections, userId],
          status: 'rejected' as const,
        };
        set({ activeRequest: next });
        toast.info('화상 방 전환 요청이 거절되었습니다.');
        return;
      }
      case 'video-upgrade-committed': {
        const committed = payload as RoomUpgradeRequest;
        set({ activeRequest: committed, lastCommittedRequest: committed });
        return;
      }
      case 'video-upgrade-expired': {
        if (!active || active.requestId !== payload?.requestId) return;
        set({ activeRequest: { ...active, status: 'expired' } });
        toast.info('화상 방 전환 요청 시간이 만료되었습니다.');
        return;
      }
      case 'room-migration-issued': {
        set({ lastMigration: payload as RoomMigrationIssued });
        return;
      }
      default:
        return;
    }
  },

  clearRequest: () => set({ activeRequest: null, lastMigration: null }),
}));
