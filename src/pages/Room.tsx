// src/pages/Room.tsx
import { ChatPanel } from '@/components/chat/ChatPanel';
import { FileStreamingPanel } from '@/components/functions/FileStreaming/FileStreamingPanel';
import { WhiteboardPanel } from '@/components/functions/Whiteboard/WhiteboardPanel';
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
import { nanoid } from 'nanoid';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

/**
 * Room page supports:
 * - direct URL access with query string (?type=...&nickname=...)
 * - lobby-to-room transition (backward compatible)
 * - device permission prompt when accessed directly
 * - nickname prompt overlay if not provided
 */
const Room = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomTitle } = useParams<{ roomTitle: string }>();
  const isMobile = useIsMobile();

  const { activePanel, setActivePanel, setViewMode } = useUIManagementStore();
  const { clearSession, setSession, userId: sessionUserId } = useSessionStore();
  const { localStream, initialize: initMedia, cleanup: cleanupMediaDevice } = useMediaDeviceStore();
  const { cleanup: cleanupPeerConnection } = usePeerConnectionStore();

  const {
    isTranscriptionEnabled,
    transcriptionLanguage,
    setLocalTranscript,
    sendTranscription,
    toggleTranscription
  } = useTranscriptionStore();

  // Parse query string for direct access
  const search = new URLSearchParams(location.search);
  const queryType = (search.get('type') as RoomType) || undefined;
  const queryNickname = search.get('nickname') || undefined;

  // Backward compatibility: legacy state from Lobby (will be removed in new flow)
  const { connectionDetails } = (location.state || {}) as {
    connectionDetails?: { nickname: string; roomType: RoomType; userId?: string };
  };

  const effectiveRoomType: RoomType =
    queryType || connectionDetails?.roomType || 'video-group';

  // Nickname prompt logic
  const [nicknameInput, setNicknameInput] = useState<string>(queryNickname || connectionDetails?.nickname || '');
  const [shouldPromptNickname, setShouldPromptNickname] = useState<boolean>(() => !queryNickname && !connectionDetails?.nickname);

  // Try to initialize media on direct access
  useEffect(() => {
    if (!localStream) {
      initMedia().catch(() => {
        toast.error('Failed to access camera/microphone. Please allow permissions.');
      });
    }
  }, [localStream, initMedia]);

  // Decide view mode by room type
  useEffect(() => {
    if (!effectiveRoomType) return;
    if (effectiveRoomType === 'video-group') setViewMode('grid');
    else setViewMode('speaker');
  }, [effectiveRoomType, setViewMode]);

  useTurnCredentials(); // TURN
  useAutoHideControls(isMobile ? 5000 : 3000);

  // Transcription hook binding
  const { start, stop, isSupported } = useSpeechRecognition({
    lang: transcriptionLanguage,
    onResult: (text, isFinal) => {
      setLocalTranscript({ text, isFinal });
      sendTranscription(text, isFinal);
    },
    onError: (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        toast.error("Microphone access permission is required. Please check your settings.");
        toggleTranscription();
      }
    }
  });

  useEffect(() => {
    if (isTranscriptionEnabled && isSupported) start();
    else stop();
    return () => stop();
  }, [isTranscriptionEnabled, isSupported, start, stop]);

  // Guard: must have roomTitle
  useEffect(() => {
    if (!roomTitle) {
      toast.error('Room not specified.');
      navigate('/');
    }
  }, [roomTitle, navigate]);

  // Prepare nickname
  const finalNickname = useMemo(() => {
    if (nicknameInput && nicknameInput.trim()) return nicknameInput.trim();
    if (!shouldPromptNickname) return generateRandomNickname();
    return '';
  }, [nicknameInput, shouldPromptNickname]);

  // Create session when ready (localStream + nickname + roomTitle)
  const didSetSessionRef = useRef(false);
  useEffect(() => {
    if (didSetSessionRef.current) return;
    if (!localStream || !roomTitle) return;

    // If we must prompt nickname, wait until user confirms
    if (shouldPromptNickname) return;

    const nicknameToUse = finalNickname || generateRandomNickname();
    const uid = sessionUserId || nanoid();
    setSession(uid, nicknameToUse, decodeURIComponent(roomTitle), effectiveRoomType);
    didSetSessionRef.current = true;
  }, [localStream, roomTitle, shouldPromptNickname, finalNickname, sessionUserId, setSession, effectiveRoomType]);

  // Build room params only when session/localStream are ready
  const roomParams = useMemo(() => {
    const info = { userId: sessionUserId, nickname: finalNickname };
    if (!roomTitle || !localStream || !info.userId || !info.nickname) return null;
    return {
      roomId: decodeURIComponent(roomTitle),
      userId: info.userId,
      nickname: info.nickname,
      localStream,
      roomType: effectiveRoomType as RoomType | undefined
    };
  }, [roomTitle, localStream, sessionUserId, finalNickname, effectiveRoomType]);

  // Analytics
  useEffect(() => {
    if (!roomParams) return;
    const joinTime = Date.now();
    analytics.roomJoin(roomParams.roomId);
    return () => {
      analytics.roomLeave(roomParams.roomId, Math.round((Date.now() - joinTime) / 1000));
    };
  }, [roomParams]);

  // Orchestrate P2P when ready
  useRoomOrchestrator(roomParams);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearSession();
      cleanupMediaDevice();
      cleanupPeerConnection();
    };
  }, [clearSession, cleanupMediaDevice, cleanupPeerConnection]);

  // Mobile-specific panels renderer remains unchanged
  const renderMobilePanels = () => (
    <>
      {activePanel === "chat" && (
        <div className="fixed inset-0 z-[60] bg-background">
          <ChatPanel isOpen={true} onClose={() => setActivePanel('none')} />
        </div>
      )}
      {activePanel === "settings" && (
        <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm">
          <SettingsPanel isOpen={true} onClose={() => setActivePanel('none')} />
        </div>
      )}
      {activePanel === "fileStreaming" && (
        <FileStreamingPanel isOpen={true} onClose={() => setActivePanel('none')} />
      )}
      {activePanel === "whiteboard" && (
        <div className="fixed inset-0 z-[60] bg-background">
          <WhiteboardPanel isOpen={true} onClose={() => setActivePanel('none')} />
        </div>
      )}
    </>
  );

  // Nickname prompt overlay (only if nickname missing on direct access)
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setShouldPromptNickname(false);
                }
              }}
            />
            <Button onClick={() => setShouldPromptNickname(false)}>
              Join
            </Button>
          </div>
          <div className="flex justify-between mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setNicknameInput(generateRandomNickname());
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
    <div className={cn("h-screen bg-background flex flex-col relative overflow-hidden","h-[100dvh]")}>
      {/* Nickname prompt if needed */}
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
            isOpen={activePanel === "chat"}
            onClose={() => setActivePanel('none')}
          />
          <WhiteboardPanel
            isOpen={activePanel === "whiteboard"}
            onClose={() => setActivePanel('none')}
          />
          <SettingsPanel
            isOpen={activePanel === "settings"}
            onClose={() => setActivePanel('none')}
          />
          <FileStreamingPanel
            isOpen={activePanel === "fileStreaming"}
            onClose={() => setActivePanel('none')}
          />
        </>
      )}
    </div>
  );
};

const MemoizedRoom = memo(Room);
export default MemoizedRoom;
