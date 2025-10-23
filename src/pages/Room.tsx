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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

/**
 * Room 페이지는 다음 시나리오를 지원합니다:
 * - 쿼리 스트링을 통한 직접 URL 접근 (?type=...&nickname=...)
 * - 로비에서 방으로의 전환 (하위 호환성)
 * - 직접 접근 시 장치 권한 프롬프트
 * - 닉네임이 제공되지 않은 경우 닉네임 입력 오버레이
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

  // 직접 접근을 위한 쿼리 스트링 파싱
  const search = new URLSearchParams(location.search);
  const queryType = (search.get('type') as RoomType) || undefined;
  const queryNickname = search.get('nickname') || undefined;

  // 하위 호환성: 로비에서 전달된 레거시 state
  const { connectionDetails } = (location.state || {}) as {
    connectionDetails?: { nickname: string; roomType: RoomType; userId?: string };
  };

  const effectiveRoomType: RoomType =
    queryType || connectionDetails?.roomType || 'video-group';

  // ✅ 개선 1: 닉네임 상태 관리 명확화
  const [nicknameInput, setNicknameInput] = useState<string>(() => {
    return queryNickname || connectionDetails?.nickname || '';
  });
  
  // ✅ 개선 2: 닉네임 확정 여부를 명시적으로 관리
  const [isNicknameConfirmed, setIsNicknameConfirmed] = useState<boolean>(() => {
    // 쿼리나 state로 닉네임이 제공되었으면 이미 확정된 것으로 간주
    return !!(queryNickname || connectionDetails?.nickname);
  });

  // 미디어 초기화
  useEffect(() => {
    if (!localStream) {
      initMedia().catch(() => {
        toast.error('카메라/마이크 접근에 실패했습니다. 권한을 허용해주세요.');
      });
    }
  }, [localStream, initMedia]);

  // 룸 타입에 따른 뷰 모드 설정
  useEffect(() => {
    if (!effectiveRoomType) return;
    if (effectiveRoomType === 'video-group') setViewMode('grid');
    else setViewMode('speaker');
  }, [effectiveRoomType, setViewMode]);

  useTurnCredentials();
  useAutoHideControls(isMobile ? 5000 : 3000);

  // 음성 인식 훅 바인딩
  const { start, stop, isSupported } = useSpeechRecognition({
    lang: transcriptionLanguage,
    onResult: (text, isFinal) => {
      setLocalTranscript({ text, isFinal });
      sendTranscription(text, isFinal);
    },
    onError: (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        toast.error("마이크 접근 권한이 필요합니다. 설정을 확인해주세요.");
        toggleTranscription();
      }
    }
  });

  useEffect(() => {
    if (isTranscriptionEnabled && isSupported) start();
    else stop();
    return () => stop();
  }, [isTranscriptionEnabled, isSupported, start, stop]);

  // roomTitle 필수 체크
  useEffect(() => {
    if (!roomTitle) {
      toast.error('방이 지정되지 않았습니다.');
      navigate('/');
    }
  }, [roomTitle, navigate]);

  // ✅ 개선 3: 최종 닉네임 계산 로직 단순화
  const finalNickname = useMemo(() => {
    // 닉네임이 확정되지 않았으면 현재 입력값 반환 (빈 문자열 가능)
    if (!isNicknameConfirmed) {
      return nicknameInput.trim();
    }
    
    // 확정되었으면 입력값 사용, 없으면 랜덤 생성
    return nicknameInput.trim() || generateRandomNickname();
  }, [nicknameInput, isNicknameConfirmed]);

  // ✅ 개선 4: 세션 생성 로직을 명확한 조건으로 단순화
  const didSetSessionRef = useRef(false);
  useEffect(() => {
    // 이미 세션을 설정했으면 스킵
    if (didSetSessionRef.current) return;
    
    // 필수 조건: localStream, roomTitle, 닉네임 확정
    if (!localStream || !roomTitle || !isNicknameConfirmed) return;

    // 최종 닉네임 결정 (빈 값이면 랜덤 생성)
    const nicknameToUse = finalNickname || generateRandomNickname();
    const uid = sessionUserId || nanoid();
    
    setSession(uid, nicknameToUse, decodeURIComponent(roomTitle), effectiveRoomType);
    didSetSessionRef.current = true;
  }, [
    localStream, 
    roomTitle, 
    isNicknameConfirmed, 
    finalNickname, 
    sessionUserId, 
    setSession, 
    effectiveRoomType
  ]);

  // ✅ 개선 5: roomParams null 체크 강화
  const roomParams = useMemo(() => {
    // 세션이 설정되지 않았으면 null
    if (!didSetSessionRef.current) return null;
    
    const info = { userId: sessionUserId, nickname: finalNickname };
    
    // 엄격한 null/undefined/빈문자열 체크
    if (!roomTitle || !localStream || !info.userId || !info.nickname?.trim()) {
      return null;
    }
    
    return {
      roomId: decodeURIComponent(roomTitle),
      userId: info.userId,
      nickname: info.nickname,
      localStream,
      roomType: effectiveRoomType as RoomType | undefined
    };
  }, [roomTitle, localStream, sessionUserId, finalNickname, effectiveRoomType]);

  // 분석 추적
  useEffect(() => {
    if (!roomParams) return;
    const joinTime = Date.now();
    analytics.roomJoin(roomParams.roomId);
    return () => {
      analytics.roomLeave(roomParams.roomId, Math.round((Date.now() - joinTime) / 1000));
    };
  }, [roomParams]);

  // P2P 오케스트레이션
  useRoomOrchestrator(roomParams);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      clearSession();
      cleanupMediaDevice();
      cleanupPeerConnection();
    };
  }, [clearSession, cleanupMediaDevice, cleanupPeerConnection]);

  // ✅ 개선 6: 닉네임 확정 핸들러를 useCallback으로 최적화
  const handleConfirmNickname = useCallback(() => {
    const trimmedNickname = nicknameInput.trim();
    
    // 입력값이 있으면 그대로 사용, 없으면 랜덤 생성
    if (!trimmedNickname) {
      setNicknameInput(generateRandomNickname());
    }
    
    setIsNicknameConfirmed(true);
  }, [nicknameInput]);

  const handleUseRandomNickname = useCallback(() => {
    const randomName = generateRandomNickname();
    setNicknameInput(randomName);
    setIsNicknameConfirmed(true);
  }, []);

  // 모바일 패널 렌더링
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

  // ✅ 개선 7: 닉네임 프롬프트 UI 개선
  const NicknamePrompt = () => {
    if (isNicknameConfirmed) return null;
    
    return (
      <div className="fixed inset-0 z-[70] bg-background/90 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg border border-border/50 bg-card p-5 shadow-xl">
          <h2 className="text-lg font-semibold mb-3">닉네임을 입력하세요</h2>
          <p className="text-xs text-muted-foreground mb-4">
            건너뛰면 랜덤 닉네임이 사용됩니다.
          </p>
          <div className="flex gap-2">
            <Input
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder="닉네임..."
              className="flex-1"
              autoFocus
              maxLength={20}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirmNickname();
                }
              }}
            />
            <Button 
              onClick={handleConfirmNickname}
              disabled={nicknameInput.trim().length > 20}
            >
              입장
            </Button>
          </div>
          <div className="flex justify-between items-center mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUseRandomNickname}
            >
              랜덤 사용
            </Button>
            <div className="text-xs text-muted-foreground">
              카메라/마이크 권한 요청이 표시될 수 있습니다
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!roomTitle) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>방 정보를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className={cn("h-screen bg-background flex flex-col relative overflow-hidden","h-[100dvh]")}>
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