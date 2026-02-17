import { ContentLayout } from '@/components/media/ContentLayout';
import DraggableControlBar from '@/components/navigator/DraggableControlBar';
import { GlobalConnectionStatus } from '@/components/setting/GlobalConnectionStatus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDeviceType, getResponsiveClasses } from '@/hooks/useDeviceType';
import { useAutoHideControls } from '@/hooks/useAutoHideControls';
import { useRoomOrchestrator } from '@/hooks/useRoomOrchestrator';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTurnCredentials } from '@/hooks/useTurnCredentials';
import { analytics } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { useMediaDeviceStore } from '@/stores/useMediaDeviceStore';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useTranscriptionStore } from '@/stores/useTranscriptionStore';
import { useUIManagementStore } from '@/stores/useUIManagementStore';
import { useDeviceMetadataStore } from '@/stores/useDeviceMetadataStore';
import type { RoomType } from '@/types/room.types';
import { generateRandomNickname } from '@/utils/nickname';
import { sessionManager } from '@/utils/session.utils';
import { nanoid } from 'nanoid';
import { memo, Suspense, lazy, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Shuffle } from 'lucide-react';

interface NicknamePromptProps {
  isVisible: boolean;
  nicknameInput: string;
  isJoining: boolean;
  onNicknameChange: (value: string) => void;
  onJoinClick: () => void;
  onRandomNickname: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  deviceInfo: ReturnType<typeof useDeviceType>;
}

const ChatPanel = lazy(() =>
  import('@/components/functions/chat/ChatPanel').then((module) => ({ default: module.ChatPanel }))
);
const WhiteboardPanel = lazy(() =>
  import('@/components/functions/whiteboard/WhiteboardPanel').then((module) => ({ default: module.WhiteboardPanel }))
);
const RelayControlPanel = lazy(() =>
  import('@/components/functions/relay/RelayControlPanel').then((module) => ({ default: module.RelayControlPanel }))
);
const CoWatchPanel = lazy(() =>
  import('@/components/functions/cowatch/CoWatchPanel').then((module) => ({ default: module.CoWatchPanel }))
);
const SettingsPanel = lazy(() =>
  import('@/components/setting/SettingsPanel').then((module) => ({ default: module.SettingsPanel }))
);
const FileStreamingPanel = lazy(() =>
  import('@/components/functions/fileStreaming/FileStreamingPanel').then((module) => ({ default: module.FileStreamingPanel }))
);

const NicknamePrompt = memo(({
  isVisible,
  nicknameInput,
  isJoining,
  onNicknameChange,
  onJoinClick,
  onRandomNickname,
  onKeyDown,
  inputRef,
  deviceInfo
}: NicknamePromptProps) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-background/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`
        w-full rounded-lg border border-border/50 bg-card shadow-xl
        ${getResponsiveClasses(deviceInfo, {
          mobile: 'max-w-sm p-4',
          tablet: 'max-w-md p-5',
          desktop: 'max-w-lg p-6',
          largeDesktop: 'max-w-xl p-8'
        })}
      `}>
        <h2 className={`
          font-semibold mb-2
          ${getResponsiveClasses(deviceInfo, {
            mobile: 'text-lg',
            tablet: 'text-xl',
            desktop: 'text-2xl',
            largeDesktop: 'text-3xl'
          })}
        `}>
          Enter your nickname
        </h2>
        <p className={`
          text-muted-foreground mb-5
          ${getResponsiveClasses(deviceInfo, {
            mobile: 'text-xs',
            tablet: 'text-sm',
            desktop: 'text-base',
            largeDesktop: 'text-lg'
          })}
        `}>
          Choose a nickname to join room. If you skip, a random nickname will be assigned.
        </p>

        <div className={`
          space-y-4
          ${getResponsiveClasses(deviceInfo, {
            mobile: 'space-y-3',
            tablet: 'space-y-4',
            desktop: 'space-y-5',
            largeDesktop: 'space-y-6'
          })}
        `}>
          <div className={`
            flex gap-2
            ${getResponsiveClasses(deviceInfo, {
              mobile: 'gap-1',
              tablet: 'gap-2',
              desktop: 'gap-3',
              largeDesktop: 'gap-4'
            })}
          `}>
            <Input
              ref={inputRef}
              value={nicknameInput}
              onChange={(e) => onNicknameChange(e.target.value)}
              placeholder="Your nickname..."
              className="flex-1"
              autoFocus
              disabled={isJoining}
              onKeyDown={onKeyDown}
              maxLength={20}
            />
            <Button
              onClick={onJoinClick}
              disabled={isJoining}
              className={`
                ${getResponsiveClasses(deviceInfo, {
                  mobile: 'min-w-[60px] px-2 py-1 text-sm',
                  tablet: 'min-w-[80px] px-3 py-2 text-base',
                  desktop: 'min-w-[100px] px-4 py-3 text-lg',
                  largeDesktop: 'min-w-[120px] px-5 py-4 text-xl'
                })}
              `}
            >
              {isJoining ? (
                <>
                  <Loader2 className={`
                    mr-2 animate-spin
                    ${getResponsiveClasses(deviceInfo, {
                      mobile: 'w-3 h-3',
                      tablet: 'w-4 h-4',
                      desktop: 'w-5 h-5',
                      largeDesktop: 'w-6 h-6'
                    })}
                  `} />
                  {getResponsiveClasses(deviceInfo, {
                    mobile: 'Joining',
                    tablet: 'Joining...',
                    desktop: 'Joining...',
                    largeDesktop: 'Joining...'
                  })}
                </>
              ) : (
                getResponsiveClasses(deviceInfo, {
                  mobile: 'Join',
                  tablet: 'Join',
                  desktop: 'Join Room',
                  largeDesktop: 'Join Room'
                })
              )}
            </Button>
          </div>

          <div className={`
            flex items-center justify-between pt-2
            ${getResponsiveClasses(deviceInfo, {
              mobile: 'pt-1',
              tablet: 'pt-2',
              desktop: 'pt-3',
              largeDesktop: 'pt-4'
            })}
          `}>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRandomNickname}
              disabled={isJoining}
              className={`
                gap-2
                ${getResponsiveClasses(deviceInfo, {
                  mobile: 'px-2 py-1 text-xs',
                  tablet: 'px-3 py-2 text-sm',
                  desktop: 'px-4 py-3 text-base',
                  largeDesktop: 'px-5 py-4 text-lg'
                })}
              `}
            >
              <Shuffle className={`
                ${getResponsiveClasses(deviceInfo, {
                  mobile: 'w-3 h-3',
                  tablet: 'w-4 h-4',
                  desktop: 'w-5 h-5',
                  largeDesktop: 'w-6 h-6'
                })}
              `} />
              {isJoining ? (
                getResponsiveClasses(deviceInfo, {
                  mobile: 'Gen...',
                  tablet: 'Generating...',
                  desktop: 'Generating...',
                  largeDesktop: 'Generating...'
                })
              ) : (
                getResponsiveClasses(deviceInfo, {
                  mobile: 'Random',
                  tablet: 'Random',
                  desktop: 'Random nickname',
                  largeDesktop: 'Random nickname'
                })
              )}
            </Button>
            <div className={`
              text-muted-foreground
              ${getResponsiveClasses(deviceInfo, {
                mobile: 'text-xs',
                tablet: 'text-xs',
                desktop: 'text-sm',
                largeDesktop: 'text-sm'
              })}
            `}>
              Camera/Mic permission may be requested
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

NicknamePrompt.displayName = 'NicknamePrompt';

const Room = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomTitle } = useParams<{ roomTitle: string }>();
  const isMobile = useIsMobile();
  const deviceInfo = useDeviceType();

  const {
    isPanelOpen,
    closePanel,
    setViewMode
  } = useUIManagementStore();

  const {
    userId: sessionUserId,
    nickname: sessionNickname,
    clearSession,
    setSession
  } = useSessionStore();

  const { localStream, initialize: initMedia, cleanup: cleanupMediaDevice } = useMediaDeviceStore();
  const { cleanup: cleanupPeerConnection } = usePeerConnectionStore();

  const {
    isTranscriptionEnabled,
    transcriptionLanguage,
    setLocalTranscript,
    sendTranscription,
    toggleTranscription
  } = useTranscriptionStore();

  const search = new URLSearchParams(location.search);
  const queryType = (search.get('type') as RoomType) || undefined;

  const effectiveRoomType: RoomType = queryType || 'video-group';

  const storedNickname = sessionManager.getNickname() || '';

  const [nicknameInput, setNicknameInput] = useState<string>(storedNickname);
  const [shouldPromptNickname, setShouldPromptNickname] = useState<boolean>(!storedNickname && !sessionNickname);
  const [isJoining, setIsJoining] = useState(false);

  const isProcessingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!localStream) {
      initMedia().catch(() => {
        toast.error('Failed to access camera/microphone. Please allow permissions.');
      });
    }
  }, [localStream, initMedia]);

  useEffect(() => {
    if (!effectiveRoomType) return;
    if (effectiveRoomType === 'video-group') setViewMode('grid');
    else setViewMode('speaker');
  }, [effectiveRoomType, setViewMode]);

  useTurnCredentials();
  useAutoHideControls(isMobile ? 5000 : 3000);

  const { start, stop, isSupported } = useSpeechRecognition({
    lang: transcriptionLanguage,
    onResult: (text, isFinal) => {
      setLocalTranscript({ text, isFinal });
      sendTranscription(text, isFinal);
    },
    onError: (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        toast.error('Microphone access permission is required. Please check your settings.');
        toggleTranscription();
      }
    }
  });

  useEffect(() => {
    if (isTranscriptionEnabled && isSupported) start();
    else stop();
    return () => stop();
  }, [isTranscriptionEnabled, isSupported, start, stop]);

  useEffect(() => {
    if (!roomTitle) {
      toast.error('Room not specified.');
      navigate('/');
    }
  }, [roomTitle, navigate]);

  const createSession = useCallback((nickname: string): boolean => {
    if (!roomTitle) {
      console.error('[Room] Cannot create session: roomTitle is missing');
      return false;
    }

    const uid = nanoid();
    console.log('[Room] Creating session:', { uid, nickname, roomTitle });

    try {
      setSession(uid, nickname, decodeURIComponent(roomTitle), effectiveRoomType);
      sessionManager.saveNickname(nickname);
      return true;
    } catch (error) {
      console.error('[Room] Error creating session:', error);
      return false;
    }
  }, [roomTitle, effectiveRoomType, setSession]);

  const executeJoin = useCallback(async (nickname: string) => {
    if (isProcessingRef.current) {
      console.log('[Room] Already processing, ignoring');
      return;
    }

    isProcessingRef.current = true;
    setIsJoining(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalNickname = nickname.trim() || generateRandomNickname();
      console.log('[Room] Executing join with nickname:', finalNickname);

      const success = createSession(finalNickname);

      if (success) {
        setNicknameInput(finalNickname);
        setShouldPromptNickname(false);
        console.log('[Room] Session created successfully');
        toast.success(`Joined as ${finalNickname}`);
      } else {
        console.error('[Room] Failed to create session');
        toast.error('Failed to join room. Please try again.');
        setIsJoining(false);
        isProcessingRef.current = false;
      }
    } catch (error) {
      console.error('[Room] Error during join:', error);
      toast.error('An error occurred. Please try again.');
      setIsJoining(false);
      isProcessingRef.current = false;
    }
  }, [createSession]);

  const handleJoinClick = useCallback(async () => {
    if (isJoining) return;
    await executeJoin(nicknameInput);
  }, [nicknameInput, executeJoin, isJoining]);

  const handleRandomNickname = useCallback(async () => {
    if (isJoining) return;
    const randomName = generateRandomNickname();
    setNicknameInput(randomName);
    toast.info(`Random nickname: ${randomName}`);
  }, [isJoining]);

  const handleKeyDown = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isJoining) {
      e.preventDefault();
      await executeJoin(nicknameInput);
    }
  }, [nicknameInput, executeJoin, isJoining]);

  const handleNicknameChange = useCallback((value: string) => {
    setNicknameInput(value);
  }, []);

  useEffect(() => {
    if (!localStream || !roomTitle || shouldPromptNickname) {
      return;
    }

    if (sessionUserId && sessionNickname) {
      console.log('[Room] Session already exists:', { sessionUserId, sessionNickname });
      setIsJoining(false);
      isProcessingRef.current = false;
      return;
    }

    if (storedNickname && !sessionUserId && !isProcessingRef.current) {
      console.log('[Room] Auto-creating session with stored nickname:', storedNickname);
      executeJoin(storedNickname);
    }
  }, [localStream, roomTitle, shouldPromptNickname, sessionUserId, sessionNickname, storedNickname, executeJoin]);

  const roomParams = useMemo(() => {
    if (!roomTitle || !localStream || !sessionUserId || !sessionNickname) {
      return null;
    }
    return {
      roomId: decodeURIComponent(roomTitle),
      userId: sessionUserId,
      nickname: sessionNickname,
      localStream,
      roomType: effectiveRoomType as RoomType | undefined
    };
  }, [roomTitle, localStream, sessionUserId, sessionNickname, effectiveRoomType]);

  useEffect(() => {
    if (!roomParams) return;
    
    const joinTime = Date.now();
    analytics.roomJoin(roomParams.roomId);
    
    // 메타데이터 브로드캐스트 - peer 연결 후 충분한 시간 대기
    const broadcastTimer = setTimeout(() => {
      const { peers } = usePeerConnectionStore.getState();
      const connectedPeers = Array.from(peers.values()).filter(p => p.connectionState === 'connected');
      
      if (connectedPeers.length > 0) {
        useDeviceMetadataStore.getState().broadcastMetadata();
      } else {
        // 연결된 peer가 없으면 재시도
        const retryTimer = setTimeout(() => {
          useDeviceMetadataStore.getState().broadcastMetadata();
        }, 3000);
        return () => clearTimeout(retryTimer);
      }
    }, 3000); // 3초로 증가
    
    return () => {
      clearTimeout(broadcastTimer);
      analytics.roomLeave(roomParams.roomId, Math.round((Date.now() - joinTime) / 1000));
    };
  }, [roomParams]);

  useRoomOrchestrator(roomParams);

  useEffect(() => {
    return () => {
      clearSession();
      cleanupMediaDevice();
      cleanupPeerConnection();
    };
  }, [clearSession, cleanupMediaDevice, cleanupPeerConnection]);

  if (!roomTitle) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading room information...</p>
      </div>
    );
  }

  return (
    <div className={cn('h-screen bg-background flex flex-col relative overflow-hidden', 'h-[100dvh]')}>
      <GlobalConnectionStatus />

      <NicknamePrompt
        isVisible={shouldPromptNickname}
        nicknameInput={nicknameInput}
        isJoining={isJoining}
        onNicknameChange={handleNicknameChange}
        onJoinClick={handleJoinClick}
        onRandomNickname={handleRandomNickname}
        onKeyDown={handleKeyDown}
        inputRef={inputRef}
        deviceInfo={deviceInfo}
      />

      <div className="h-full w-full overflow-hidden">
        <ContentLayout />
      </div>

      <DraggableControlBar />

      <Suspense fallback={null}>
        {isPanelOpen('chat') && (
          <ChatPanel
            isOpen={true}
            onClose={() => closePanel('chat')}
          />
        )}

        {isPanelOpen('whiteboard') && (
          <WhiteboardPanel
            isOpen={true}
            onClose={() => closePanel('whiteboard')}
          />
        )}

        {isPanelOpen('settings') && (
          <SettingsPanel
            isOpen={true}
            onClose={() => closePanel('settings')}
          />
        )}

        {isPanelOpen('relay') && (
          <RelayControlPanel
            isOpen={true}
            onClose={() => closePanel('relay')}
          />
        )}

        {isPanelOpen('fileStreaming') && (
          <FileStreamingPanel
            isOpen={true}
            onClose={() => closePanel('fileStreaming')}
          />
        )}

        {isPanelOpen('cowatch') && (
          <CoWatchPanel
            isOpen={true}
            onClose={() => closePanel('cowatch')}
          />
        )}
      </Suspense>
    </div>
  );
};

const MemoizedRoom = memo(Room);
export default MemoizedRoom;
