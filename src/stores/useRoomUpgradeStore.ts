import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';
import { usePeerConnectionStore } from './usePeerConnectionStore';
import { useSessionStore } from './useSessionStore';
import { useSignalingStore } from './useSignalingStore';
import type { RoomType } from '@/types/room.types';
import { getUpgradeTargetRoomType, isAudioRoom, isValidRoomType } from '@/types/roomCapabilities';

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
  handleIncomingEvent: (event: { type: string; from?: string; data?: unknown; payload?: unknown }) => void;
  clearRequest: () => void;
}

const REQUEST_TIMEOUT_MS = 30_000;
const MIGRATION_EVENT_TTL_MS = 2 * 60_000;

const buildTargetTitle = (roomTitle: string) => roomTitle;

const isRoomMigrationIssued = (value: unknown): value is RoomMigrationIssued => {
  if (!value || typeof value !== 'object') return false;
  const migration = value as Partial<RoomMigrationIssued>;

  return typeof migration.requestId === 'string'
    && typeof migration.sourceRoomId === 'string'
    && typeof migration.sourceRoomTitle === 'string'
    && isValidRoomType(migration.sourceRoomType)
    && typeof migration.targetRoomId === 'string'
    && typeof migration.targetRoomTitle === 'string'
    && isValidRoomType(migration.targetRoomType)
    && Array.isArray(migration.participantIds)
    && migration.participantIds.every((id) => typeof id === 'string')
    && typeof migration.issuedAt === 'number'
    && Number.isFinite(migration.issuedAt);
};

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
    toast.info('Video room upgrade request sent.');
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
    toast.info('Video room upgrade request declined.');
  },

  handleIncomingEvent: (event) => {
    const payload = event.data ?? event.payload;
    const active = get().activeRequest;

    switch (event.type) {
      case 'video-upgrade-requested': {
        const request = payload as RoomUpgradeRequest;
        set({ activeRequest: request });
        if (request.requesterId !== useSessionStore.getState().userId) {
          toast.info(`${request.requesterNickname} requested a video room upgrade.`);
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
        toast.info('Video room upgrade request was declined.');
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
        toast.info('Video room upgrade request expired.');
        return;
      }
      case 'room-migration-issued': {
        if (!isRoomMigrationIssued(payload)) {
          console.warn('[RoomUpgrade] Ignoring invalid room migration payload:', payload);
          return;
        }

        if (Date.now() - payload.issuedAt > MIGRATION_EVENT_TTL_MS) {
          console.warn('[RoomUpgrade] Ignoring stale room migration payload:', payload.requestId);
          return;
        }

        set({ lastMigration: payload });
        return;
      }
      default:
        return;
    }
  },

  clearRequest: () => set({ activeRequest: null, lastMigration: null }),
}));
