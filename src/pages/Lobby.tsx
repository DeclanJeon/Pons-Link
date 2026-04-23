import { LobbyIdentityStrip } from '@/components/lobby/LobbyIdentityStrip';
import { LobbyJoinFooter } from '@/components/lobby/LobbyJoinFooter';
import { LobbyPreviewStage } from '@/components/lobby/LobbyPreviewStage';
import { LobbyReadinessPanel } from '@/components/lobby/LobbyReadinessPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLobbyStore } from '@/stores/useLobbyStore';
import { useMediaDeviceStore } from '@/stores/useMediaDeviceStore';
import { useParticipantProfileStore } from '@/stores/useParticipantProfileStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { getDefaultAvatarPresets, getInitialAvatarPreset, saveAvatarPreset, type AvatarPreset } from '@/lib/avatar/dicebear';
import { PERSONAL_LINK_ACCOUNT_PROFILE_KEY } from '@/features/personal-link/storageKeys';
import { DEFAULT_ROOM_TYPE, isAudioRoom, isValidRoomType } from '@/types/roomCapabilities';
import type { RoomType } from '@/types/room.types';
import { sessionManager } from '@/utils/session.utils';
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { generateRandomNickname } from '@/utils/nickname';

const Lobby = () => {
  const navigate = useNavigate();
  const { roomTitle } = useParams<{ roomTitle: string }>();
  const location = useLocation();
  const isMobile = useIsMobile();

  const {
    connectionDetails,
    isInitialized,
    initialize,
    cleanup,
    setNavigatingToRoom,
    updateNickname,
  } = useLobbyStore();

  const {
    localStream,
    audioInputs,
    videoInputs,
    selectedAudioDeviceId,
    selectedVideoDeviceId,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    changeAudioDevice,
    changeVideoDevice,
    cleanup: cleanupMediaDevice,
  } = useMediaDeviceStore();

  const { setSession } = useSessionStore();
  const { setLocalAvatar, setLocalAvatarUrl } = useParticipantProfileStore();

  const [localNickname, setLocalNickname] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [avatarPresets] = useState<AvatarPreset[]>(() => getDefaultAvatarPresets());
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarPreset>(() => getInitialAvatarPreset());

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const typeParam = searchParams.get('type');
    const effectiveType: RoomType = isValidRoomType(typeParam) ? typeParam : DEFAULT_ROOM_TYPE;

    if (!roomTitle) {
      toast.error('Room title is required.');
      navigate('/');
      return;
    }

    const storedNickname = sessionManager.getNickname() || '';
    const nick = storedNickname || generateRandomNickname();

    if (!storedNickname) {
      sessionManager.saveNickname(nick);
    }

    initialize(roomTitle, nick, effectiveType);
    setLocalNickname(nick);
    setLocalAvatar(selectedAvatar);

    try {
      const raw = window.localStorage.getItem(PERSONAL_LINK_ACCOUNT_PROFILE_KEY);
      if (raw) {
        const profile = JSON.parse(raw) as { profileImageUrl?: string };
        if (profile.profileImageUrl) {
          setLocalAvatarUrl(profile.profileImageUrl);
        }
      }
    } catch {
      // ignore invalid local profile cache
    }

    return () => {
      cleanup();
    };
  }, [roomTitle, location.search, navigate, initialize, cleanup, selectedAvatar, setLocalAvatar, setLocalAvatarUrl]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      cleanupMediaDevice();
    };

    const handlePageHide = () => {
      cleanupMediaDevice();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [cleanupMediaDevice]);

  const handleJoinRoom = useCallback(() => {
    if (!connectionDetails || !isInitialized) {
      toast.error('Initializing...');
      return;
    }

    if (!localStream) {
      toast.error('Media stream is not available.');
      return;
    }

    setNavigatingToRoom(true);
    const userId = nanoid();

    setSession(
      userId,
      connectionDetails.nickname,
      connectionDetails.roomTitle,
      connectionDetails.roomType,
    );

    navigate(`/room/${encodeURIComponent(connectionDetails.roomTitle)}?type=${connectionDetails.roomType}`);
    toast.success('Entering room...');
  }, [connectionDetails, isInitialized, localStream, setNavigatingToRoom, setSession, navigate]);

  const handleNicknameChange = () => {
    if (localNickname.trim() && localNickname !== connectionDetails?.nickname) {
      const trimmedNickname = localNickname.trim();
      updateNickname(trimmedNickname);
      sessionManager.saveNickname(trimmedNickname);
      toast.success('Nickname updated successfully.');
    }

    setIsEditing(false);
  };

  const handleAudioDeviceChange = (deviceId: string) => {
    changeAudioDevice(deviceId);
  };

  const handleVideoDeviceChange = (deviceId: string) => {
    changeVideoDevice(deviceId);
  };

  useEffect(() => {
    if (!isEditing && connectionDetails?.nickname) {
      setLocalNickname(connectionDetails.nickname);
    }
  }, [connectionDetails?.nickname, isEditing]);

  const handleAvatarSelect = useCallback((preset: AvatarPreset) => {
    setSelectedAvatar(preset);
    saveAvatarPreset(preset);
    setLocalAvatar(preset);
  }, [setLocalAvatar]);

  if (!isInitialized || !connectionDetails) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const audioOnlyRoom = isAudioRoom(connectionDetails.roomType);
  const showParticipantGuidance = connectionDetails.roomType === 'audio-group';

  return (
    <div className="min-h-screen bg-background px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <LobbyIdentityStrip
          roomTitle={connectionDetails.roomTitle}
          roomType={connectionDetails.roomType}
          audioOnlyRoom={audioOnlyRoom}
          localNickname={localNickname}
          onNicknameInputChange={setLocalNickname}
          onNicknameSubmit={handleNicknameChange}
          onNicknameFocus={() => setIsEditing(true)}
          showParticipantGuidance={showParticipantGuidance}
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)] lg:items-start">
          <LobbyPreviewStage
            audioOnlyRoom={audioOnlyRoom}
            localStream={localStream}
            isVideoEnabled={isVideoEnabled}
            nickname={connectionDetails.nickname}
            avatarPresets={avatarPresets}
            selectedAvatar={selectedAvatar}
            onAvatarSelect={handleAvatarSelect}
          />

          <LobbyReadinessPanel
            audioOnlyRoom={audioOnlyRoom}
            nickname={connectionDetails.nickname}
            isAudioEnabled={isAudioEnabled}
            onToggleAudio={toggleAudio}
            audioDevices={audioInputs}
            videoDevices={videoInputs}
            selectedAudioDevice={selectedAudioDeviceId}
            selectedVideoDevice={selectedVideoDeviceId}
            onAudioDeviceChange={handleAudioDeviceChange}
            onVideoDeviceChange={handleVideoDeviceChange}
          />
        </div>

        <LobbyJoinFooter
          audioOnlyRoom={audioOnlyRoom}
          isMobile={isMobile}
          onJoinRoom={handleJoinRoom}
        />
      </div>
    </div>
  );
};

export default Lobby;
