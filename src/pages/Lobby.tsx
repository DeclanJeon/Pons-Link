import { VideoPreview } from "@/components/media/VideoPreview";
import { AvatarPicker } from '@/components/lobby/AvatarPicker';
import { DeviceSelector } from "@/components/setting/DeviceSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDeviceType, getResponsiveClasses } from '@/hooks/useDeviceType';
import { useLobbyStore } from "@/stores/useLobbyStore";
import { useMediaDeviceStore } from "@/stores/useMediaDeviceStore";
import { useParticipantProfileStore } from '@/stores/useParticipantProfileStore';
import { useSessionStore } from "@/stores/useSessionStore";
import { RoomType } from '@/types/room.types';
import { DEFAULT_ROOM_TYPE, isAudioRoom, isValidRoomType } from '@/types/roomCapabilities';
import { getDefaultAvatarPresets, getInitialAvatarPreset, saveAvatarPreset, type AvatarPreset } from '@/lib/avatar/dicebear';
import { sessionManager } from '@/utils/session.utils';
import { Edit3, Mic, MicOff, Radio, ShieldCheck, Sparkles, Users, Waves } from "lucide-react";
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useState } from "react";
import { PERSONAL_LINK_ACCOUNT_PROFILE_KEY } from '@/features/personal-link/storageKeys';
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
    changeAudioDevice,
    changeVideoDevice,
    cleanup: cleanupMediaDevice
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
  const mobileParticipantGuidance = connectionDetails.roomType === 'audio-group' && isMobile;

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
            {audioOnlyRoom && (
              <div className="mx-auto mb-3 flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">
                <Radio className="h-3.5 w-3.5" />
                Audio lounge
              </div>
            )}
            <h1 className={`
              font-bold text-foreground mb-4
              ${getResponsiveClasses(deviceInfo, {
                mobile: 'text-xl',
                tablet: 'text-2xl'
              })}
            `}>
              {audioOnlyRoom ? 'Voice Lobby' : 'Lobby'}
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
            {mobileParticipantGuidance && (
              <p className="mt-2 text-[11px] text-amber-500/90">
                Mobile audio rooms support up to 8 people, but 6 or fewer is recommended for more stable calls.
              </p>
            )}
          </div>
          {!audioOnlyRoom && (
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
          )}
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
          </div>
          {audioOnlyRoom && (
            <div className={`
              relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-sm mb-6
              ${getResponsiveClasses(deviceInfo, {
                mobile: 'p-3 mb-4',
                tablet: 'p-4 mb-6'
              })}
            `}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(var(--primary),0.14),transparent_38%)] opacity-80" />
              <div className="relative space-y-3">
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="h-4 w-4" />
                  <h3 className={`
                    font-semibold
                    ${getResponsiveClasses(deviceInfo, {
                      mobile: 'text-xs',
                      tablet: 'text-sm'
                    })}
                  `}>
                    Choose how others recognize you
                  </h3>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  오디오 방에서는 카메라 대신 프로필과 이름이 분위기를 만듭니다. 편하고 눈에 잘 들어오는 캐릭터를 골라두세요.
                </p>
                <AvatarPicker
                  presets={avatarPresets}
                  selectedAvatar={selectedAvatar}
                  onSelect={handleAvatarSelect}
                />
              </div>
            </div>
          )}
          <div className={`
            bg-card/70 backdrop-blur-sm rounded-3xl p-4 border border-border/50 mb-6 shadow-sm
            ${getResponsiveClasses(deviceInfo, {
              mobile: 'p-3 mb-4',
              tablet: 'p-4 mb-6'
            })}
          `}>
            <div className="mb-3 flex items-center gap-2">
              <Waves className="h-4 w-4 text-primary" />
              <h3 className={`
                font-semibold
                ${getResponsiveClasses(deviceInfo, {
                  mobile: 'text-xs',
                  tablet: 'text-sm'
                })}
              `}>
                Audio check
              </h3>
            </div>
            <DeviceSelector
              audioDevices={audioInputs}
              videoDevices={videoInputs}
              selectedAudioDevice={selectedAudioDeviceId}
              selectedVideoDevice={selectedVideoDeviceId}
              onAudioDeviceChange={handleAudioDeviceChange}
              onVideoDeviceChange={handleVideoDeviceChange}
              showVideoSelector={!audioOnlyRoom}
            />
          </div>
        </div>
        <div className={`
          fixed bottom-0 left-0 right-0 border-t border-border/50 bg-background/90 backdrop-blur-xl
          ${getResponsiveClasses(deviceInfo, {
            mobile: 'p-3',
            tablet: 'p-4'
          })}
        `}>
          {audioOnlyRoom && (
            <div className="mx-auto mb-3 flex max-w-xl items-center justify-between gap-2 rounded-2xl border border-primary/10 bg-primary/5 px-3 py-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> 카메라는 켜지지 않아요</span>
              <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-primary" /> 목소리와 프로필로 입장</span>
            </div>
          )}
          <Button
            onClick={handleJoinRoom}
            className={`
              w-full btn-connection rounded-2xl shadow-lg shadow-primary/20
              ${getResponsiveClasses(deviceInfo, {
                mobile: 'h-11 text-base',
                tablet: 'h-12 text-lg'
              })}
            `}
            aria-label="Join room"
          >
            {audioOnlyRoom ? 'Enter Voice Room' : 'Join Room'}
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
          {audioOnlyRoom && (
            <div className="mx-auto mb-3 flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">
              <Radio className="h-3.5 w-3.5" />
              Audio lounge
            </div>
          )}
          <h1 className={`
            font-bold text-foreground mb-4
            ${getResponsiveClasses(deviceInfo, {
              tablet: 'text-2xl',
              desktop: 'text-3xl',
              largeDesktop: 'text-4xl'
            })}
          `}>
            {audioOnlyRoom ? 'Voice Lobby' : 'Lobby'}
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
          {connectionDetails.roomType === 'audio-group' && (
            <p className="mt-2 text-xs text-amber-500/90">
              Audio group rooms allow up to 8 participants. On mobile, 6 or fewer is recommended for more stable calls.
            </p>
          )}
        </div>
        <div className={`
          grid gap-8
          ${getResponsiveClasses(deviceInfo, {
            tablet: 'grid-cols-1',
            desktop: 'lg:grid-cols-3',
            largeDesktop: 'xl:grid-cols-3'
          })}
        `}>
          {!audioOnlyRoom && (
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
          )}
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
              </div>
            </div>
            {audioOnlyRoom && (
              <div className="relative overflow-hidden rounded-[28px] border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-sm">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(var(--primary),0.14),transparent_36%)] opacity-75" />
                <div className="relative">
                  <div className="mb-3 flex items-center gap-2 text-primary">
                    <Sparkles className="h-4 w-4" />
                    <h3 className={`
                      font-semibold text-foreground
                      ${getResponsiveClasses(deviceInfo, {
                        tablet: 'text-sm',
                        desktop: 'text-base',
                        largeDesktop: 'text-lg'
                      })}
                    `}>
                      Profile Avatar
                    </h3>
                  </div>
                  <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                    오디오 방에서는 화면 대신 이름과 프로필이 첫인상을 만듭니다. 지금 이 방 분위기에 어울리는 캐릭터를 골라두세요.
                  </p>
                  <AvatarPicker
                    presets={avatarPresets}
                    selectedAvatar={selectedAvatar}
                    onSelect={handleAvatarSelect}
                  />
                </div>
              </div>
            )}
            <div className="control-panel rounded-[28px] border border-border/50 bg-card/80 p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-primary">
                <Waves className="h-4 w-4" />
                <h3 className={`
                  font-semibold text-foreground
                  ${getResponsiveClasses(deviceInfo, {
                    tablet: 'text-sm',
                    desktop: 'text-base',
                    largeDesktop: 'text-lg'
                  })}
                `}>
                  Audio check
                </h3>
              </div>
              <DeviceSelector
                audioDevices={audioInputs}
                videoDevices={videoInputs}
                selectedAudioDevice={selectedAudioDeviceId}
                selectedVideoDevice={selectedVideoDeviceId}
                onAudioDeviceChange={handleAudioDeviceChange}
                onVideoDeviceChange={handleVideoDeviceChange}
                showVideoSelector={!audioOnlyRoom}
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
          {audioOnlyRoom && (
            <div className="mx-auto mb-4 flex max-w-2xl flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/10 bg-primary/5 px-3 py-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Camera hidden</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/10 bg-primary/5 px-3 py-1.5"><Users className="h-3.5 w-3.5 text-primary" /> Voice-first entry</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/10 bg-primary/5 px-3 py-1.5"><Waves className="h-3.5 w-3.5 text-primary" /> Mic test ready</span>
            </div>
          )}
          <Button
            onClick={handleJoinRoom}
            className={`
              btn-connection rounded-2xl shadow-lg shadow-primary/20
              ${getResponsiveClasses(deviceInfo, {
                tablet: 'px-8 py-3 text-base',
                desktop: 'px-12 py-4 text-lg',
                largeDesktop: 'px-16 py-5 text-xl'
              })}
            `}
            aria-label="Join room"
          >
            {audioOnlyRoom ? 'Enter Voice Room' : 'Join Room'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
