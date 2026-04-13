import { create } from 'zustand';
import type { AvatarPreset } from '@/lib/avatar/dicebear';
import { getInitialAvatarPreset } from '@/lib/avatar/dicebear';
import { usePeerConnectionStore } from './usePeerConnectionStore';

export interface ParticipantProfile {
  userId: string;
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
  },

  setLocalUserId: (userId) => {
    set((state) => ({
      localProfile: {
        ...state.localProfile,
        userId,
      },
    }));
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
    const message = JSON.stringify({
      type: 'participant-profile',
      payload: get().localProfile,
    });
    usePeerConnectionStore.getState().sendToAllPeers(message);
  },

  cleanup: () => {
    set({ remoteProfiles: new Map() });
  },
}));
