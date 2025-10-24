import { VideoPreview } from "@/components/media/VideoPreview";
import { DeviceSelector } from "@/components/setting/DeviceSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLobbyStore } from "@/stores/useLobbyStore";
import { useMediaDeviceStore } from "@/stores/useMediaDeviceStore";
import { useSessionStore } from "@/stores/useSessionStore";
import { RoomType } from '@/types/room.types';
import { sessionManager } from '@/utils/session.utils';
import { Edit3, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

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
    updateNickname
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
    toggleVideo,
    changeAudioDevice,
    changeVideoDevice,
    cleanup: cleanupMediaDevice
  } = useMediaDeviceStore();

  const { setSession, updateNickname: updateSessionNickname } = useSessionStore();

  const [localNickname, setLocalNickname] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const roomTypeFromQuery = searchParams.get('type') as RoomType | null;

    if (!roomTitle) {
      toast.error('Room title is required.');
      navigate('/');
      return;
    }

    if (!roomTypeFromQuery) {
      toast.error('Room type is required. Please start from the landing page.');
      navigate('/');
      return;
    }

    const storedNickname = sessionManager.getNickname() || '';

    if (!storedNickname) {
      toast.error('Nickname is required. Redirecting to landing page...');
      navigate('/');
      return;
    }

    initialize(roomTitle, storedNickname, roomTypeFromQuery);
    setLocalNickname(storedNickname);

    return () => {
      cleanup();
    };
  }, [roomTitle, location.search, navigate, initialize, cleanup]);

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
      connectionDetails.roomType
    );

    navigate(
      `/room/${encodeURIComponent(connectionDetails.roomTitle)}?type=${connectionDetails.roomType}`
    );

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

  if (!isInitialized || !connectionDetails) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background overflow-y-auto">
        <div className="flex flex-col p-4 pb-24">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-4">Lobby</h1>

            <div className="flex items-center justify-center gap-2 mb-2">
              <Input
                type="text"
                value={localNickname}
                onChange={(e) => setLocalNickname(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNicknameChange()}
                onFocus={() => setIsEditing(true)}
                className="w-48 h-8 text-sm"
                placeholder="Enter nickname"
                aria-label="Nickname input"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNicknameChange}
                className="h-8 w-8 p-0"
                aria-label="Save nickname"
              >
                <Edit3 className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-sm text-muted-foreground mt-1">
              Room Title: <span className="text-primary font-medium">"{connectionDetails.roomTitle}"</span>
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Type: <span className="text-primary/80 font-medium">{connectionDetails.roomType}</span>
            </p>
          </div>

          <div className="mb-6 aspect-video rounded-lg overflow-hidden bg-muted">
            <VideoPreview
              stream={localStream}
              isVideoEnabled={isVideoEnabled}
              nickname={connectionDetails.nickname}
              isLocalVideo={true}
            />
          </div>

          <div className="flex gap-3 mb-6">
            <Button
              variant={isAudioEnabled ? "default" : "destructive"}
              size="lg"
              onClick={toggleAudio}
              className="flex-1"
              aria-label={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
            >
              {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </Button>
            <Button
              variant={isVideoEnabled ? "default" : "destructive"}
              size="lg"
              onClick={toggleVideo}
              className="flex-1"
              aria-label={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
            >
              {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </Button>
          </div>

          <div className="bg-card/50 backdrop-blur-sm rounded-lg p-4 mb-6 border border-border/50">
            <h3 className="text-sm font-medium mb-3">Device Settings</h3>
            <DeviceSelector
              audioDevices={audioInputs}
              videoDevices={videoInputs}
              selectedAudioDevice={selectedAudioDeviceId}
              selectedVideoDevice={selectedVideoDeviceId}
              onAudioDeviceChange={handleAudioDeviceChange}
              onVideoDeviceChange={handleVideoDeviceChange}
            />
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-xl border-t border-border/50">
          <Button
            onClick={handleJoinRoom}
            className="w-full h-12 text-lg btn-connection"
            aria-label="Join room"
          >
            Join Room
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-5xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">Lobby</h1>

          <div className="flex items-center justify-center gap-2 mb-2">
            <Input
              type="text"
              value={localNickname}
              onChange={(e) => setLocalNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNicknameChange()}
              onFocus={() => setIsEditing(true)}
              className="w-48 h-8 text-sm"
              placeholder="Enter nickname"
              aria-label="Nickname input"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNicknameChange}
              className="h-8 w-8 p-0"
              aria-label="Save nickname"
            >
              <Edit3 className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-muted-foreground mt-2">
            Room Title: <span className="text-primary font-medium">"{connectionDetails.roomTitle}"</span>
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Type: <span className="text-primary/80 font-medium">{connectionDetails.roomType}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <VideoPreview
              stream={localStream}
              isVideoEnabled={isVideoEnabled}
              nickname={connectionDetails.nickname}
              isLocalVideo={true}
            />
          </div>

          <div className="space-y-6">
            <div className="control-panel">
              <h3 className="font-medium text-foreground mb-4">Media</h3>
              <div className="flex gap-3">
                <Button
                  variant={isAudioEnabled ? "default" : "destructive"}
                  size="lg"
                  onClick={toggleAudio}
                  className="flex-1"
                  aria-label={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
                >
                  {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </Button>
                <Button
                  variant={isVideoEnabled ? "default" : "destructive"}
                  size="lg"
                  onClick={toggleVideo}
                  className="flex-1"
                  aria-label={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
                >
                  {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </Button>
              </div>
            </div>

            <div className="control-panel">
              <h3 className="font-medium text-foreground mb-4">Devices</h3>
              <DeviceSelector
                audioDevices={audioInputs}
                videoDevices={videoInputs}
                selectedAudioDevice={selectedAudioDeviceId}
                selectedVideoDevice={selectedVideoDeviceId}
                onAudioDeviceChange={handleAudioDeviceChange}
                onVideoDeviceChange={handleVideoDeviceChange}
              />
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <Button
            onClick={handleJoinRoom}
            className="btn-connection px-12 py-4 text-lg"
            aria-label="Join room"
          >
            Join Room
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Lobby;