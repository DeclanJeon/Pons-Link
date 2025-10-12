/**
 * @fileoverview Room  ()
 * @module pages/Room
 */

import { useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useUIManagementStore } from '@/stores/useUIManagementStore';
import { useMediaDeviceStore } from '@/stores/useMediaDeviceStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useTranscriptionStore } from '@/stores/useTranscriptionStore';
import { useAutoHideControls } from '@/hooks/useAutoHideControls';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useRoomOrchestrator } from '@/hooks/useRoomOrchestrator';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { WhiteboardPanel } from '@/components/functions/WhiteboardPanel';
import { SettingsPanel } from '@/components/setting/SettingsPanel';
import { FileStreamingPanel } from '@/components/functions/FileStreaming/FileStreamingPanel';
import { ContentLayout } from '@/components/media/ContentLayout';
import { DraggableControlBar } from '@/components/navigator/DraggableControlBar';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useTurnCredentials } from '@/hooks/useTurnCredentials';
import { analytics } from '@/lib/analytics';

const Room = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomTitle } = useParams<{ roomTitle: string }>();
  const isMobile = useIsMobile();

  const { activePanel, setActivePanel } = useUIManagementStore();
  const { clearSession } = useSessionStore();
  const { localStream } = useMediaDeviceStore();
  
  const { 
    isTranscriptionEnabled, 
    transcriptionLanguage, 
    setLocalTranscript, 
    sendTranscription, 
    toggleTranscription 
  } = useTranscriptionStore();

  const { connectionDetails } = location.state || {};

  const roomParams = useMemo(() => {
    if (roomTitle && connectionDetails && localStream) {
      return {
        roomId: decodeURIComponent(roomTitle),
        userId: connectionDetails.userId,
        nickname: connectionDetails.nickname,
        localStream: localStream,
      };
    }
    return null;
  }, [roomTitle, connectionDetails, localStream]);

  useEffect(() => {
    if (!roomParams) return;
    
    const joinTime = Date.now();
    analytics.roomJoin(roomParams.roomId);

    return () => {
      const duration = Math.round((Date.now() - joinTime) / 1000);
      analytics.roomLeave(roomParams.roomId, duration);
    };
  }, [roomParams]);

  useTurnCredentials();
  useRoomOrchestrator(roomParams);
  useAutoHideControls(isMobile ? 5000 : 3000);

  const { start, stop, isSupported } = useSpeechRecognition({
    lang: transcriptionLanguage,
    onResult: (text, isFinal) => {
      setLocalTranscript({ text, isFinal });
      sendTranscription(text, isFinal);
    },
    onError: (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        toast.error("음성 인식을 사용할 수 없습니다. 권한을 확인해주세요.");
        toggleTranscription();
      }
    }
  });

  useEffect(() => {
    if (isTranscriptionEnabled && isSupported) {
      start();
    } else {
      stop();
    }
    return () => stop();
  }, [isTranscriptionEnabled, isSupported, start, stop]);

  useEffect(() => {
    if (!roomParams) {
      toast.error("세션 정보가 없습니다. 로비로 돌아갑니다.");
      navigate(`/lobby/${roomTitle || ''}`);
    }
  }, [roomParams, navigate, roomTitle]);

  useEffect(() => {
    return () => {
      clearSession();
    };
  }, [clearSession]);

  if (!connectionDetails) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>세션 정보를 불러오는 중...</p>
      </div>
    );
  }

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

  return (
    <div className={cn(
      "h-screen bg-background flex flex-col relative overflow-hidden",
      isMobile && "h-[100dvh]"
    )}>
        <div className="h-full">
            <ContentLayout />
        </div>

        <DraggableControlBar />

        {isMobile ? renderMobilePanels() : (
            <>
                <ChatPanel isOpen={activePanel === "chat"} onClose={() => setActivePanel('none')} />
                <WhiteboardPanel isOpen={activePanel === "whiteboard"} onClose={() => setActivePanel('none')} />
                <SettingsPanel isOpen={activePanel === "settings"} onClose={() => setActivePanel('none')} />
                <FileStreamingPanel isOpen={activePanel === "fileStreaming"} onClose={() => setActivePanel('none')} />
            </>
        )}
    </div>
  );
};

export default Room;
