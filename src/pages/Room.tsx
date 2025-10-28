import { ChatPanel } from '@/components/functions/chat/ChatPanel';
import { FileStreamingPanel } from '@/components/functions/fileStreaming/FileStreamingPanel';
import { WhiteboardPanel } from '@/components/functions/whiteboard/WhiteboardPanel';
import { ContentLayout } from '@/components/media/ContentLayout';
import DraggableControlBar from '@/components/navigator/DraggableControlBar';
import { SettingsPanel } from '@/components/setting/SettingsPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-mobile';
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
import type { RoomType } from '@/types/room.types';
import { generateRandomNickname } from '@/utils/nickname';
import { sessionManager } from '@/utils/session.utils';
import { nanoid } from 'nanoid';
import { memo, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

const Room = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomTitle } = useParams<{ roomTitle: string }>();
  const isMobile = useIsMobile();

  const { activePanel, setActivePanel, setViewMode } = useUIManagementStore();
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

  const finalNickname = useMemo(() => {
    if (sessionNickname) return sessionNickname;
    if (nicknameInput && nicknameInput.trim()) return nicknameInput.trim();
    return '';
  }, [sessionNickname, nicknameInput]);

  useEffect(() => {
    if (!localStream || !roomTitle) {
      return;
    }
    if (shouldPromptNickname) {
      return;
    }
    if (sessionUserId && sessionNickname) {
      return;
    }
    if (!finalNickname) {
      return;
    }
    const uid = nanoid();
    setSession(uid, finalNickname, decodeURIComponent(roomTitle), effectiveRoomType);
    sessionManager.saveNickname(finalNickname);
  }, [
    localStream,
    roomTitle,
    shouldPromptNickname,
    finalNickname,
    sessionUserId,
    sessionNickname,
    setSession,
    effectiveRoomType
  ]);

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
    return () => {
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

  const renderMobilePanels = () => (
    <>
      {activePanel === 'chat' && (
        <div className="fixed inset-0 z-[60] bg-background">
          <ChatPanel isOpen={true} onClose={() => setActivePanel('none')} />
        </div>
      )}
      {activePanel === 'settings' && (
        <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm">
          <SettingsPanel isOpen={true} onClose={() => setActivePanel('none')} />
        </div>
      )}
      {activePanel === 'whiteboard' && (
        <div className="fixed inset-0 z-[60] bg-background">
          <WhiteboardPanel isOpen={true} onClose={() => setActivePanel('none')} />
        </div>
      )}
    </>
  );

  const handleNicknameSubmit = () => {
    const finalName = nicknameInput.trim() || generateRandomNickname();
    sessionManager.saveNickname(finalName);
    setNicknameInput(finalName);
    setShouldPromptNickname(false);
  };

  const NicknamePrompt = () => {
    if (!shouldPromptNickname) return null;
    return (
      <div className="fixed inset-0 z-[70] bg-background/90 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg border border-border/50 bg-card p-5 shadow-xl">
          <h2 className="text-lg font-semibold mb-3">Enter your nickname</h2>
          <p className="text-xs text-muted-foreground mb-4">
            If you skip, a random nickname will be used.
          </p>
          <div className="flex gap-2">
            <Input
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder="Your nickname..."
              className="flex-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleNicknameSubmit();
                }
              }}
            />
            <Button onClick={handleNicknameSubmit}>
              Join
            </Button>
          </div>
          <div className="flex justify-between mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const randomName = generateRandomNickname();
                setNicknameInput(randomName);
                sessionManager.saveNickname(randomName);
                setShouldPromptNickname(false);
              }}
            >
              Use random
            </Button>
            <div className="text-xs text-muted-foreground">
              Camera/Mic permission prompt may appear
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!roomTitle) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading room information...</p>
      </div>
    );
  }

  return (
    <div className={cn('h-screen bg-background flex flex-col relative overflow-hidden', 'h-[100dvh]')}>
      <NicknamePrompt />

      <div className="h-full w-full overflow-hidden">
        <ContentLayout />
      </div>

      <DraggableControlBar />

      {isMobile ? (
        renderMobilePanels()
      ) : (
        <>
          <ChatPanel
            isOpen={activePanel === 'chat'}
            onClose={() => setActivePanel('none')}
          />
          <WhiteboardPanel
            isOpen={activePanel === 'whiteboard'}
            onClose={() => setActivePanel('none')}
          />
          <SettingsPanel
            isOpen={activePanel === 'settings'}
            onClose={() => setActivePanel('none')}
          />
        </>
      )}

      <FileStreamingPanel
        isOpen={activePanel === 'fileStreaming'}
        onClose={() => setActivePanel('none')}
      />
    </div>
  );
};

const MemoizedRoom = memo(Room);
export default MemoizedRoom;
