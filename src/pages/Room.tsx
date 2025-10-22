import { ChatPanel } from '@/components/chat/ChatPanel';
import { FileStreamingPanel } from '@/components/functions/FileStreaming/FileStreamingPanel';
import { WhiteboardPanel } from '@/components/functions/Whiteboard/WhiteboardPanel';
import { ContentLayout } from '@/components/media/ContentLayout';
import DraggableControlBar from '@/components/navigator/DraggableControlBar';
import { SettingsPanel } from '@/components/setting/SettingsPanel';
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
import { memo, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

/**
 * Room 메인 컴포넌트
 *
 * @component
 * @description
 * **데이터 흐름:**
 * ```
 * Landing → Lobby → Room
 *   ↓        ↓       ↓
 * roomType  media  peers
 * ```
 *
 * **상태 관리 계층:**
 * - UI: activePanel, viewMode (UIManagementStore)
 * - 미디어: localStream, 디바이스 설정 (MediaDeviceStore)
 * - 연결: 피어 연결, 시그널링 (PeerConnectionStore, SignalingStore)
 * - 세션: 사용자 정보, 방 정보 (SessionStore)
 * - 기능: 채팅, 화이트보드, 자막 (각 Store)
 *
 * **성능 최적화:**
 * - memo()로 불필요한 리렌더링 방지
 * - useMemo()로 roomParams 계산 최적화
 * - useCallback()로 이벤트 핸들러 메모이제이션
 */
const Room = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomTitle } = useParams<{ roomTitle: string }>();
  const isMobile = useIsMobile();

  // ============================================================
  // Store 구독
  // ============================================================

  const { activePanel, setActivePanel, setViewMode } = useUIManagementStore();
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

  // ============================================================
  // 라우터 상태에서 연결 정보 추출
  // ============================================================

  const { connectionDetails } = location.state || {};

  // ============================================================
  // roomParams 메모이제이션
  // ============================================================

  /**
   * 방 파라미터 계산
   *
   * @description
   * roomTitle, connectionDetails, localStream이 모두 준비되었을 때만
   * roomParams를 생성합니다. 하나라도 없으면 null을 반환하여
   * 초기화가 완료되지 않았음을 나타냅니다.
   *
   * **의존성:**
   * - roomTitle: URL 파라미터
   * - connectionDetails: Lobby에서 전달된 사용자 정보
   * - localStream: 미디어 디바이스에서 획득한 스트림
   */
  const roomParams = useMemo(() => {
    if (roomTitle && connectionDetails && localStream) {
      console.log('[Room] Creating roomParams with stream:', {
        hasStream: !!localStream,
        audioTracks: localStream.getAudioTracks().length,
        videoTracks: localStream.getVideoTracks().length,
        userId: connectionDetails.userId,
        nickname: connectionDetails.nickname,
        roomType: connectionDetails.roomType
      });

      return {
        roomId: decodeURIComponent(roomTitle),
        userId: connectionDetails.userId,
        nickname: connectionDetails.nickname,
        localStream: localStream,
        roomType: connectionDetails.roomType as RoomType | undefined, // ✅ 추가
      };
    }

    console.warn('[Room] roomParams is null:', {
      hasRoomTitle: !!roomTitle,
      hasConnectionDetails: !!connectionDetails,
      hasLocalStream: !!localStream
    });

    return null;
  }, [roomTitle, connectionDetails?.userId, connectionDetails?.nickname, localStream]);

  // ============================================================
  // 분석 추적
  // ============================================================

  /**
   * 방 입장/퇴장 분석 이벤트 전송
   *
   * @description
   * 사용자가 방에 머문 시간을 측정하여 분석 서버에 전송합니다.
   * 사용자 참여 패턴 분석에 활용됩니다.
   */
  useEffect(() => {
    if (!roomParams) return;

    const joinTime = Date.now();
    analytics.roomJoin(roomParams.roomId);

    return () => {
      const duration = Math.round((Date.now() - joinTime) / 1000);
      analytics.roomLeave(roomParams.roomId, duration);
    };
  }, [roomParams]);

  // ============================================================
  // 자동 레이아웃 설정
  // ============================================================

  /**
   * roomType 기반 자동 레이아웃 설정
   *
   * @description
   * **레이아웃 전략:**
   * - video-group: Grid 레이아웃 (모든 참여자 동등하게 표시)
   * - 기타 (1:1, audio-only 등): Speaker 레이아웃 (활성 발화자 강조)
   *
   * 이는 사용자의 정신 모델과 일치합니다:
   * - 그룹 회의: "모두를 보고 싶다"
   * - 1:1 회의: "상대방에게 집중하고 싶다"
   */
  useEffect(() => {
    const roomType: RoomType | undefined = connectionDetails?.roomType;

    if (!roomType) return;

    console.log('[Room] Setting view mode based on room type:', roomType);

    if (roomType === 'video-group') {
      setViewMode('grid');
      console.log('[Room] Auto-layout: Grid mode for group call');
    } else {
      setViewMode('speaker');
      console.log('[Room] Auto-layout: Speaker mode for 1:1 or audio call');
    }
  }, [connectionDetails?.roomType, setViewMode]);

  // ============================================================
  // 커스텀 훅 초기화
  // ============================================================

  useTurnCredentials(); // TURN 서버 자격증명 관리
  useRoomOrchestrator(roomParams); // 시그널링 및 피어 연결 조율
  useAutoHideControls(isMobile ? 5000 : 3000); // 컨트롤 바 자동 숨김

  // ============================================================
  // 음성 인식 (자막 기능)
  // ============================================================

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

  /**
   * 자막 기능 활성화/비활성화 처리
   */
  useEffect(() => {
    if (isTranscriptionEnabled && isSupported) {
      start();
    } else {
      stop();
    }
    return () => stop();
  }, [isTranscriptionEnabled, isSupported, start, stop]);

  // ============================================================
  // roomParams 검증 및 리다이렉트
  // ============================================================

  /**
   * roomParams가 없으면 Lobby로 리다이렉트
   *
   * @description
   * 사용자가 URL을 직접 입력하거나 새로고침하여
   * 필요한 정보 없이 Room에 접근하는 것을 방지합니다.
   */
  useEffect(() => {
    if (!roomParams) {
      console.error('[Room] No room params, redirecting to lobby');
      toast.error("Room information not found. Redirecting to lobby.");
      navigate(`/lobby/${roomTitle || ''}`);
    }
  }, [roomParams, navigate, roomTitle]);

  // ============================================================
  // 컴포넌트 정리
  // ============================================================

  /**
   * 컴포넌트 언마운트 시 모든 리소스 정리
   *
   * @description
   * **정리 순서:**
   * 1. 세션 정리 (SessionStore)
   * 2. 미디어 스트림 정리 (MediaDeviceStore)
   * 3. 피어 연결 정리 (PeerConnectionStore)
   *
   * 이 순서는 의존성 관계를 고려한 것입니다.
   */
  useEffect(() => {
    return () => {
      console.log('[Room] Component unmounting, cleaning up...');

      // 1. 세션 정리
      clearSession();

      // 2. 미디어 스트림 정리
      cleanupMediaDevice();

      // 3. 피어 연결 정리
      cleanupPeerConnection();
    };
  }, [clearSession, cleanupMediaDevice, cleanupPeerConnection]);

  // ============================================================
  // 브라우저 종료/새로고침 처리
  // ============================================================

  /**
   * 브라우저 종료/새로고침 이벤트 처리
   *
   * @description
   * **이벤트 종류:**
   * - beforeunload: 페이지 언로드 직전 (경고 메시지 표시 가능)
   * - pagehide: 페이지가 숨겨질 때 (iOS Safari 지원)
   *
   * **목적:**
   * - 리소스 누수 방지
   * - 서버에 정상적인 퇴장 알림
   * - 사용자에게 확인 메시지 제공
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

  // ============================================================
  // 로딩 상태 처리
  // ============================================================

  if (!connectionDetails) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading room information...</p>
      </div>
    );
  }

  // ============================================================
  // 모바일 패널 렌더링
  // ============================================================

  /**
   * 모바일 전용 패널 렌더링
   *
   * @description
   * 모바일에서는 패널이 전체 화면을 차지하며,
   * 한 번에 하나의 패널만 활성화됩니다.
   *
   * **z-index 계층:**
   * - z-[60]: 패널 (컨트롤 바 위)
   * - z-50: 컨트롤 바
   * - z-10: 비디오 레이아웃
   */
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

  // ============================================================
  // 메인 렌더링
  // ============================================================

  return (
    <div className={cn(
      "h-screen bg-background flex flex-col relative overflow-hidden",
      isMobile && "h-[100dvh]" // 모바일 브라우저 주소창 고려
    )}>
      {/* 비디오 레이아웃 */}
      <div className="h-full">
        <ContentLayout />
      </div>

      {/* 컨트롤 바 */}
      <DraggableControlBar />

      {/* 패널 (모바일/데스크톱 분기) */}
      {isMobile ? renderMobilePanels() : (
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

/**
 * 메모이제이션된 Room 컴포넌트
 *
 * @description
 * memo()를 사용하여 props가 변경되지 않으면 리렌더링을 방지합니다.
 * Room 컴포넌트는 props를 받지 않으므로, 실질적으로는
 * 부모 컴포넌트의 불필요한 리렌더링으로부터 보호하는 역할입니다.
 */
const MemoizedRoom = memo(Room);
export default MemoizedRoom;
