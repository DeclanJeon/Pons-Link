import { VideoPreview } from "@/components/media/VideoPreview";
import { DeviceSelector } from "@/components/setting/DeviceSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDeviceType, getResponsiveClasses } from '@/hooks/useDeviceType';
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
import { generateRandomNickname } from "@/utils/nickname";

const Lobby = () => {
  const navigate = useNavigate();
  const { roomTitle } = useParams<{ roomTitle: string }>();
  const location = useLocation();
  const isMobile = useIsMobile();
  const deviceInfo = useDeviceType();

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

  const { setSession } = useSessionStore();

  const [localNickname, setLocalNickname] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const roomTypeFromQuery = searchParams.get('type') as RoomType | null;
    const effectiveType: RoomType = roomTypeFromQuery ?? 'video-group';
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
        <div className={`
          flex flex-col
          ${getResponsiveClasses(deviceInfo, {
            mobile: 'p-3 pb-20',
            tablet: 'p-4 pb-24'
          })}
        `}>
          <div className={`
            text-center
            ${getResponsiveClasses(deviceInfo, {
              mobile: 'mb-4',
              tablet: 'mb-6'
            })}
          `}>
            <h1 className={`
              font-bold text-foreground mb-4
              ${getResponsiveClasses(deviceInfo, {
                mobile: 'text-xl',
                tablet: 'text-2xl'
              })}
            `}>
              Lobby
            </h1>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Input
                type="text"
                value={localNickname}
                onChange={(e) => setLocalNickname(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNicknameChange()}
                onFocus={() => setIsEditing(true)}
                className={`
                  text-sm
                  ${getResponsiveClasses(deviceInfo, {
                    mobile: 'w-36 h-7',
                    tablet: 'w-48 h-8'
                  })}
                `}
                placeholder="Enter nickname"
                aria-label="Nickname input"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNicknameChange}
                className={`
                  p-0
                  ${getResponsiveClasses(deviceInfo, {
                    mobile: 'h-7 w-7',
                    tablet: 'h-8 w-8'
                  })}
                `}
                aria-label="Save nickname"
              >
                <Edit3 className={`
                  ${getResponsiveClasses(deviceInfo, {
                    mobile: 'w-3 h-3',
                    tablet: 'w-4 h-4'
                  })}
                `} />
              </Button>
            </div>
            <p className={`
              text-muted-foreground mt-1
              ${getResponsiveClasses(deviceInfo, {
                mobile: 'text-xs',
                tablet: 'text-sm'
              })}
            `}>
              Room Title: <span className="text-primary font-medium">"{connectionDetails.roomTitle}"</span>
            </p>
            <p className={`
              text-muted-foreground/70 mt-1
              ${getResponsiveClasses(deviceInfo, {
                mobile: 'text-xs',
                tablet: 'text-xs'
              })}
            `}>
              Type: <span className="text-primary/80 font-medium">{connectionDetails.roomType}</span>
            </p>
          </div>
          <div className={`
            aspect-video rounded-lg overflow-hidden bg-muted mb-6
            ${getResponsiveClasses(deviceInfo, {
              mobile: 'mb-4',
              tablet: 'mb-6'
            })}
          `}>
            <VideoPreview
              stream={localStream}
              isVideoEnabled={isVideoEnabled}
              nickname={connectionDetails.nickname}
              isLocalVideo={true}
            />
          </div>
          <div className={`
            flex gap-3 mb-6
            ${getResponsiveClasses(deviceInfo, {
              mobile: 'gap-2 mb-4',
              tablet: 'gap-3 mb-6'
            })}
          `}>
            <Button
              variant={isAudioEnabled ? "default" : "destructive"}
              size="lg"
              onClick={toggleAudio}
              className="flex-1"
              aria-label={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
            >
              <Mic className={`
                ${getResponsiveClasses(deviceInfo, {
                  mobile: 'w-4 h-4',
                  tablet: 'w-5 h-5'
                })}
              `} />
            </Button>
            <Button
              variant={isVideoEnabled ? "default" : "destructive"}
              size="lg"
              onClick={toggleVideo}
              className="flex-1"
              aria-label={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
            >
              <Video className={`
                ${getResponsiveClasses(deviceInfo, {
                  mobile: 'w-4 h-4',
                  tablet: 'w-5 h-5'
                })}
              `} />
            </Button>
          </div>
          <div className={`
            bg-card/50 backdrop-blur-sm rounded-lg p-4 border border-border/50 mb-6
            ${getResponsiveClasses(deviceInfo, {
              mobile: 'p-3 mb-4',
              tablet: 'p-4 mb-6'
            })}
          `}>
            <h3 className={`
              font-medium mb-3
              ${getResponsiveClasses(deviceInfo, {
                mobile: 'text-xs',
                tablet: 'text-sm'
              })}
            `}>
              Device Settings
            </h3>
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
        <div className={`
          fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border/50
          ${getResponsiveClasses(deviceInfo, {
            mobile: 'p-3',
            tablet: 'p-4'
          })}
        `}>
          <Button
            onClick={handleJoinRoom}
            className={`
              w-full btn-connection
              ${getResponsiveClasses(deviceInfo, {
                mobile: 'h-10 text-base',
                tablet: 'h-12 text-lg'
              })}
            `}
            aria-label="Join room"
          >
            Join Room
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`
      min-h-screen bg-background flex items-center justify-center
      ${getResponsiveClasses(deviceInfo, {
        tablet: 'p-4',
        desktop: 'p-6',
        largeDesktop: 'p-8'
      })}
    `}>
      <div className={`
        w-full
        ${getResponsiveClasses(deviceInfo, {
          tablet: 'max-w-3xl',
          desktop: 'max-w-5xl',
          largeDesktop: 'max-w-6xl'
        })}
      `}>
        <div className={`
          text-center
          ${getResponsiveClasses(deviceInfo, {
            tablet: 'mb-6',
            desktop: 'mb-8',
            largeDesktop: 'mb-10'
          })}
        `}>
          <h1 className={`
            font-bold text-foreground mb-4
            ${getResponsiveClasses(deviceInfo, {
              tablet: 'text-2xl',
              desktop: 'text-3xl',
              largeDesktop: 'text-4xl'
            })}
          `}>
            Lobby
          </h1>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Input
              type="text"
              value={localNickname}
              onChange={(e) => setLocalNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNicknameChange()}
              onFocus={() => setIsEditing(true)}
              className={`
                text-sm
                ${getResponsiveClasses(deviceInfo, {
                  tablet: 'w-40 h-8',
                  desktop: 'w-48 h-8',
                  largeDesktop: 'w-56 h-10'
                })}
              `}
              placeholder="Enter nickname"
              aria-label="Nickname input"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNicknameChange}
              className={`
                p-0
                ${getResponsiveClasses(deviceInfo, {
                  tablet: 'h-8 w-8',
                  desktop: 'h-8 w-8',
                  largeDesktop: 'h-10 w-10'
                })}
              `}
              aria-label="Save nickname"
            >
              <Edit3 className={`
                ${getResponsiveClasses(deviceInfo, {
                  tablet: 'w-4 h-4',
                  desktop: 'w-4 h-4',
                  largeDesktop: 'w-5 h-5'
                })}
              `} />
            </Button>
          </div>
          <p className={`
            text-muted-foreground mt-2
            ${getResponsiveClasses(deviceInfo, {
              tablet: 'text-sm',
              desktop: 'text-base',
              largeDesktop: 'text-lg'
            })}
          `}>
            Room Title: <span className="text-primary font-medium">"{connectionDetails.roomTitle}"</span>
          </p>
          <p className={`
            text-muted-foreground/70 mt-1
            ${getResponsiveClasses(deviceInfo, {
              tablet: 'text-xs',
              desktop: 'text-sm',
              largeDesktop: 'text-sm'
            })}
          `}>
            Type: <span className="text-primary/80 font-medium">{connectionDetails.roomType}</span>
          </p>
        </div>
        <div className={`
          grid gap-8
          ${getResponsiveClasses(deviceInfo, {
            tablet: 'grid-cols-1',
            desktop: 'lg:grid-cols-3',
            largeDesktop: 'xl:grid-cols-3'
          })}
        `}>
          <div className={`
            ${getResponsiveClasses(deviceInfo, {
              tablet: 'col-span-1',
              desktop: 'lg:col-span-2',
              largeDesktop: 'xl:col-span-2'
            })}
          `}>
            <VideoPreview
              stream={localStream}
              isVideoEnabled={isVideoEnabled}
              nickname={connectionDetails.nickname}
              isLocalVideo={true}
            />
          </div>
          <div className={`
            space-y-6
            ${getResponsiveClasses(deviceInfo, {
              tablet: 'space-y-4',
              desktop: 'space-y-6',
              largeDesktop: 'space-y-8'
            })}
          `}>
            <div className="control-panel">
              <h3 className={`
                font-medium text-foreground mb-4
                ${getResponsiveClasses(deviceInfo, {
                  tablet: 'text-sm',
                  desktop: 'text-base',
                  largeDesktop: 'text-lg'
                })}
              `}>
                Media
              </h3>
              <div className={`
                flex gap-3
                ${getResponsiveClasses(deviceInfo, {
                  tablet: 'gap-2',
                  desktop: 'gap-3',
                  largeDesktop: 'gap-4'
                })}
              `}>
                <Button
                  variant={isAudioEnabled ? "default" : "destructive"}
                  size="lg"
                  onClick={toggleAudio}
                  className="flex-1"
                  aria-label={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
                >
                  <Mic className={`
                    ${getResponsiveClasses(deviceInfo, {
                      tablet: 'w-4 h-4',
                      desktop: 'w-5 h-5',
                      largeDesktop: 'w-6 h-6'
                    })}
                  `} />
                </Button>
                <Button
                  variant={isVideoEnabled ? "default" : "destructive"}
                  size="lg"
                  onClick={toggleVideo}
                  className="flex-1"
                  aria-label={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
                >
                  <Video className={`
                    ${getResponsiveClasses(deviceInfo, {
                      tablet: 'w-4 h-4',
                      desktop: 'w-5 h-5',
                      largeDesktop: 'w-6 h-6'
                    })}
                  `} />
                </Button>
              </div>
            </div>
            <div className="control-panel">
              <h3 className={`
                font-medium text-foreground mb-4
                ${getResponsiveClasses(deviceInfo, {
                  tablet: 'text-sm',
                  desktop: 'text-base',
                  largeDesktop: 'text-lg'
                })}
              `}>
                Devices
              </h3>
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
        <div className={`
          text-center
          ${getResponsiveClasses(deviceInfo, {
            tablet: 'mt-6',
            desktop: 'mt-8',
            largeDesktop: 'mt-10'
          })}
        `}>
          <Button
            onClick={handleJoinRoom}
            className={`
              btn-connection
              ${getResponsiveClasses(deviceInfo, {
                tablet: 'px-8 py-3 text-base',
                desktop: 'px-12 py-4 text-lg',
                largeDesktop: 'px-16 py-5 text-xl'
              })}
            `}
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
