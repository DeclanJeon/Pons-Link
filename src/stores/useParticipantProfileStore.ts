import { create } from 'zustand';
import type { AvatarPreset } from '@/lib/avatar/dicebear';
import { getInitialAvatarPreset } from '@/lib/avatar/dicebear';
import { usePeerConnectionStore } from './usePeerConnectionStore';
import { useSessionStore } from './useSessionStore';

export interface ParticipantProfile {
  userId: string;
  nickname?: string;
  avatarId: string;
  avatarSeed: string;
  avatarStyle: string;
  avatarUrl: string;
}

interface ParticipantProfileState {
  localProfile: ParticipantProfile;
  remoteProfiles: Map<string, ParticipantProfile>;
}

interface ParticipantProfileActions {
  setLocalAvatar: (avatar: AvatarPreset, userId?: string) => void;
  setLocalAvatarUrl: (avatarUrl: string, userId?: string) => void;
  clearLocalAvatarUrl: () => void;
  setLocalUserId: (userId: string) => void;
  updateRemoteProfile: (userId: string, profile: ParticipantProfile) => void;
  removeRemoteProfile: (userId: string) => void;
  broadcastLocalProfile: () => void;
  cleanup: () => void;
}

const toProfile = (avatar: AvatarPreset, userId = 'local'): ParticipantProfile => ({
  userId,
  avatarId: avatar.id,
  avatarSeed: avatar.seed,
  avatarStyle: avatar.style,
  avatarUrl: avatar.url,
});

const initialAvatar = getInitialAvatarPreset();

export const useParticipantProfileStore = create<ParticipantProfileState & ParticipantProfileActions>((set, get) => ({
  localProfile: toProfile(initialAvatar),
  remoteProfiles: new Map(),

  setLocalAvatar: (avatar, userId) => {
    set((state) => ({
      localProfile: toProfile(avatar, userId || state.localProfile.userId),
    }));
    get().broadcastLocalProfile();
  },

  setLocalAvatarUrl: (avatarUrl, userId) => {
    set((state) => ({
      localProfile: {
        ...state.localProfile,
        userId: userId || state.localProfile.userId,
        avatarUrl,
      },
    }));
    get().broadcastLocalProfile();
  },

  clearLocalAvatarUrl: () => {
    set((state) => ({
      localProfile: {
        ...state.localProfile,
        avatarUrl: initialAvatar.url,
      },
    }));
    get().broadcastLocalProfile();
  },

  setLocalUserId: (userId) => {
    set((state) => ({
      localProfile: {
        ...state.localProfile,
        userId,
      },
    }));
    get().broadcastLocalProfile();
  },

  updateRemoteProfile: (userId, profile) => {
    set((state) => {
      const next = new Map(state.remoteProfiles);
      next.set(userId, { ...profile, userId });
      return { remoteProfiles: next };
    });
  },

  removeRemoteProfile: (userId) => {
    set((state) => {
      const next = new Map(state.remoteProfiles);
      next.delete(userId);
      return { remoteProfiles: next };
    });
  },

  broadcastLocalProfile: () => {
    const sessionInfo = useSessionStore.getState().getSessionInfo?.();
    const localProfile = get().localProfile;
    const message = JSON.stringify({
      type: 'participant-profile',
      payload: {
        ...localProfile,
        userId: sessionInfo?.userId || localProfile.userId,
        nickname: sessionInfo?.nickname,
      },
    });
    usePeerConnectionStore.getState().sendToAllPeers(message);
  },

  cleanup: () => {
    set({ remoteProfiles: new Map() });
  },
}));
