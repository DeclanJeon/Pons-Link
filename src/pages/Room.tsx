/**
 * @fileoverview Room 페이지 (개선판 v2)
 * @module pages/Room
 */

import { useEffect, useMemo, useCallback, memo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useUIManagementStore } from '@/stores/useUIManagementStore';
import { useMediaDeviceStore } from '@/stores/useMediaDeviceStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useTranscriptionStore } from '@/stores/useTranscriptionStore';
import { useAutoHideControls } from '@/hooks/useAutoHideControls';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useRoomOrchestrator } from '@/hooks/useRoomOrchestrator';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { WhiteboardPanel } from '@/components/functions/Whiteboard/WhiteboardPanel';
import { SettingsPanel } from '@/components/setting/SettingsPanel';
import { FileStreamingPanel } from '@/components/functions/FileStreaming/FileStreamingPanel';
import { ContentLayout } from '@/components/media/ContentLayout';
import DraggableControlBar from '@/components/navigator/DraggableControlBar';
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
  const { localStream, cleanup: cleanupMediaDevice } = useMediaDeviceStore();
  const { cleanup: cleanupPeerConnection } = usePeerConnectionStore();
  
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
      console.log('[Room] Creating roomParams with stream:', {
        hasStream: !!localStream,
        audioTracks: localStream.getAudioTracks().length,
        videoTracks: localStream.getVideoTracks().length,
        userId: connectionDetails.userId,
        nickname: connectionDetails.nickname
      });
      
      return {
        roomId: decodeURIComponent(roomTitle),
        userId: connectionDetails.userId,
        nickname: connectionDetails.nickname,
        localStream: localStream,
      };
    }
    
    console.warn('[Room] roomParams is null:', {
      hasRoomTitle: !!roomTitle,
      hasConnectionDetails: !!connectionDetails,
      hasLocalStream: !!localStream
    });
    
    return null;
  }, [roomTitle, connectionDetails?.userId, connectionDetails?.nickname, localStream]);

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
        toast.error("Microphone access permission is required. Please check your settings.");
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

  /**
   * roomParams가 없으면 Lobby로 리다이렉트
   */
  useEffect(() => {
    if (!roomParams) {
      console.error('[Room] No room params, redirecting to lobby');
      toast.error("Room information not found. Redirecting to lobby.");
      navigate(`/lobby/${roomTitle || ''}`);
    }
  }, [roomParams, navigate, roomTitle]);

  /**
   * 컴포넌트 언마운트 시 정리
   */
  useEffect(() => {
    return () => {
      console.log('[Room] Component unmounting, cleaning up...');
      
      // 세션 정리
      clearSession();
      
      // 미디어 스트림 정리
      cleanupMediaDevice();
      
      // 피어 연결 정리
      cleanupPeerConnection();
    };
  }, [clearSession, cleanupMediaDevice, cleanupPeerConnection]);

  /**
   * 브라우저 종료/새로고침 이벤트 처리
   */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      console.log('[Room] Browser closing/refreshing, cleaning up...');
      
      // 미디어 스트림 정리
      cleanupMediaDevice();
      
      // 피어 연결 정리
      cleanupPeerConnection();
      
      // 경고 메시지 표시
      e.preventDefault();
      e.returnValue = '통화를 종료하시겠습니까?';
    };

    const handlePageHide = () => {
      console.log('[Room] Page hidden, cleaning up...');
      cleanupMediaDevice();
      cleanupPeerConnection();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [cleanupMediaDevice, cleanupPeerConnection]);

  if (!connectionDetails) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading room information...</p>
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

const MemoizedRoom = memo(Room);
export default MemoizedRoom;
