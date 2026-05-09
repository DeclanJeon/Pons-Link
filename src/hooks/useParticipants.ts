import { useMemo } from 'react';
import { usePeerConnectionStore, PeerState } from '@/stores/usePeerConnectionStore';
import { useMediaDeviceStore } from '@/stores/useMediaDeviceStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useFileStreamingStore } from '@/stores/useFileStreamingStore';
import { useTranscriptionStore } from '@/stores/useTranscriptionStore';
import { useRelayStore } from '@/stores/useRelayStore';
import { useParticipantProfileStore } from '@/stores/useParticipantProfileStore';
import { useDeviceMetadataStore } from '@/stores/useDeviceMetadataStore';
import { useMediaQualityStore } from '@/stores/useMediaQualityStore';
import type { CameraPrivacyMode } from '@/lib/media/mediaQuality';

export interface Participant extends PeerState {
  isLocal: boolean;
  stream: MediaStream | null;
  isRelay?: boolean;
  avatarUrl?: string;
  cameraPrivacyMode?: CameraPrivacyMode;
}

export const useParticipants = (): Participant[] => {
  const peers = usePeerConnectionStore(state => state.peers);
  const { localStream, isVideoEnabled, isAudioEnabled, isSharingScreen, isClickCapSharing, localDisplayOverride } = useMediaDeviceStore();
  const { getSessionInfo } = useSessionStore();
  const { isStreaming: isFileStreaming } = useFileStreamingStore();
  const { localTranscript, transcriptionLanguage, detectedLanguage } = useTranscriptionStore();
  const { takeoverMode } = useRelayStore();
  const localProfile = useParticipantProfileStore(state => state.localProfile);
  const remoteProfiles = useParticipantProfileStore(state => state.remoteProfiles);
  const remoteMetadata = useDeviceMetadataStore(state => state.remoteMetadata);
  const cameraPrivacyMode = useMediaQualityStore(state => state.cameraPrivacyMode);

  const sessionInfo = getSessionInfo();
  const localUserId = sessionInfo?.userId || 'local';
  const localNickname = sessionInfo?.nickname || 'You';

  const participants = useMemo<Participant[]>(() => {
    const localParticipant: Participant = {
      userId: localUserId,
      nickname: localNickname,
      stream: localDisplayOverride || localStream,
      isLocal: true,
      audioEnabled: isAudioEnabled,
      videoEnabled: isVideoEnabled,
      isSharingScreen: isSharingScreen,
      isClickCapSharing,
      connectionState: 'connected',
      transcript: localTranscript ? {
        ...localTranscript,
        lang: transcriptionLanguage === 'auto' ? (detectedLanguage || 'auto') : transcriptionLanguage,
      } : undefined,
      isStreamingFile: isFileStreaming,
      isRelay: !!localDisplayOverride && takeoverMode,
      avatarUrl: localProfile.avatarUrl,
      cameraPrivacyMode,
    };

    const remoteParticipants: Participant[] = Array.from(peers.values()).map(peer => {
      const profile = remoteProfiles.get(peer.userId);
      const metadata = remoteMetadata.get(peer.userId);

      return {
        ...peer,
        nickname: profile?.nickname || peer.nickname || 'Unknown',
        isLocal: false,
        stream: peer.stream || null,
        avatarUrl: profile?.avatarUrl,
        cameraPrivacyMode: metadata?.cameraPrivacyMode,
      };
    });

    return [localParticipant, ...remoteParticipants];
  }, [
    peers,
    localStream,
    localDisplayOverride,
    isVideoEnabled,
    isAudioEnabled,
    isSharingScreen,
    isClickCapSharing,
    localUserId,
    localNickname,
    isFileStreaming,
    localTranscript,
    transcriptionLanguage,
    detectedLanguage,
    takeoverMode,
    localProfile.avatarUrl,
    remoteProfiles,
    remoteMetadata,
    cameraPrivacyMode,
  ]);

  return participants;
};
