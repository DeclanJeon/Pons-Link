/**
 * @fileoverview Lobby 페이지 (개선판 v2)
 * @module pages/Lobby
 */

import { useEffect, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { VideoPreview } from "@/components/media/VideoPreview";
import { DeviceSelector } from "@/components/setting/DeviceSelector";
import { toast } from "sonner";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import { useLobbyStore } from "@/stores/useLobbyStore";
import { useMediaDeviceStore } from "@/stores/useMediaDeviceStore";
import { useSessionStore } from "@/stores/useSessionStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { nanoid } from 'nanoid';

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
    setNavigatingToRoom 
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

  /**
   * 초기화
   */
  useEffect(() => {
    const initialNickname = location.state?.nickname || '';
    
    if (!roomTitle) {
      toast.error('방 제목이 필요합니다.');
      navigate('/');
      return;
    }

    initialize(roomTitle, initialNickname);

    // 정리 함수
    return () => {
      console.log('[Lobby] Cleaning up on unmount...');
      cleanup(); // LobbyStore의 cleanup이 조건부로 미디어 정리
    };
  }, [roomTitle, location.state, navigate, initialize, cleanup]);

  /**
   * 브라우저 종료/새로고침 이벤트 처리
   */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      console.log('[Lobby] Browser closing/refreshing, cleaning up...');
      
      // 강제로 미디어 스트림 정리
      cleanupMediaDevice();
    };

    const handlePageHide = () => {
      console.log('[Lobby] Page hidden, cleaning up...');
      cleanupMediaDevice();
    };

    // Visibility API로 탭 전환 감지
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[Lobby] Tab hidden');
        // 탭이 숨겨질 때는 정리하지 않음 (다시 돌아올 수 있음)
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [cleanupMediaDevice]);

  /**
   * 방 입장 핸들러 (수정됨)
   */
  const handleJoinRoom = useCallback(() => {
    if (!connectionDetails || !isInitialized) {
      toast.error('초기화 중입니다.');
      return;
    }

    if (!localStream) {
      toast.error('미디어 스트림을 사용할 수 없습니다.');
      return;
    }

    // Room으로 정상 이동 중임을 표시
    setNavigatingToRoom(true);

    const userId = nanoid();
    setSession(userId, connectionDetails.nickname, connectionDetails.roomTitle);

    console.log('[Lobby] Navigating to room with stream:', {
      hasStream: !!localStream,
      audioTracks: localStream.getAudioTracks().length,
      videoTracks: localStream.getVideoTracks().length
    });

    navigate(`/room/${encodeURIComponent(connectionDetails.roomTitle)}`, {
      state: {
        connectionDetails: { ...connectionDetails, userId }
      }
    });

    toast.success('입장 중...');
  }, [connectionDetails, isInitialized, localStream, setNavigatingToRoom, setSession, navigate]);

  /**
   * 디바이스 변경 핸들러
   */
  const handleAudioDeviceChange = (deviceId: string) => {
    changeAudioDevice(deviceId);
  };

  const handleVideoDeviceChange = (deviceId: string) => {
    changeVideoDevice(deviceId);
  };

  if (!isInitialized || !connectionDetails) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>로딩 중...</p>
      </div>
    );
  }

  // 모바일 레이아웃
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background overflow-y-auto">
        <div className="flex flex-col p-4 pb-24">
          {/* 헤더 */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-2">대기실</h1>
            <p className="text-sm text-muted-foreground">
              닉네임: <span className="text-accent font-medium">{connectionDetails.nickname}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              방 제목: <span className="text-primary font-medium">"{connectionDetails.roomTitle}"</span>
            </p>
          </div>

          {/* 비디오 프리뷰 */}
          <div className="mb-6 aspect-video rounded-lg overflow-hidden bg-muted">
            <VideoPreview
              stream={localStream}
              isVideoEnabled={isVideoEnabled}
              nickname={connectionDetails.nickname}
              isLocalVideo={true}
            />
          </div>

          {/* 미디어 컨트롤 */}
          <div className="flex gap-3 mb-6">
            <Button
              variant={isAudioEnabled ? "default" : "destructive"}
              size="lg"
              onClick={toggleAudio}
              className="flex-1"
            >
              {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </Button>
            <Button
              variant={isVideoEnabled ? "default" : "destructive"}
              size="lg"
              onClick={toggleVideo}
              className="flex-1"
            >
              {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </Button>
          </div>

          {/* 디바이스 설정 */}
          <div className="bg-card/50 backdrop-blur-sm rounded-lg p-4 mb-6 border border-border/50">
            <h3 className="text-sm font-medium mb-3">디바이스 설정</h3>
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

        {/* 하단 Join 버튼 */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-xl border-t border-border/50">
          <Button
            onClick={handleJoinRoom}
            className="w-full h-12 text-lg btn-connection"
          >
            입장하기
          </Button>
        </div>
      </div>
    );
  }

  // 데스크톱 레이아웃
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-5xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">대기실</h1>
          <p className="text-muted-foreground">
            닉네임: <span className="text-accent font-medium">{connectionDetails.nickname}</span>
          </p>
          <p className="text-muted-foreground mt-2">
            방 제목: <span className="text-primary font-medium">"{connectionDetails.roomTitle}"</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 비디오 프리뷰 */}
          <div className="lg:col-span-2">
            <VideoPreview
              stream={localStream}
              isVideoEnabled={isVideoEnabled}
              nickname={connectionDetails.nickname}
              isLocalVideo={true}
            />
          </div>

          {/* 사이드 패널 */}
          <div className="space-y-6">
            {/* 컨트롤 */}
            <div className="control-panel">
              <h3 className="font-medium text-foreground mb-4">미디어</h3>
              <div className="flex gap-3">
                <Button
                  variant={isAudioEnabled ? "default" : "destructive"}
                  size="lg"
                  onClick={toggleAudio}
                  className="flex-1"
                >
                  {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </Button>
                <Button
                  variant={isVideoEnabled ? "default" : "destructive"}
                  size="lg"
                  onClick={toggleVideo}
                  className="flex-1"
                >
                  {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </Button>
              </div>
            </div>

            {/* 디바이스 설정 */}
            <div className="control-panel">
              <h3 className="font-medium text-foreground mb-4">디바이스</h3>
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
          <Button onClick={handleJoinRoom} className="btn-connection px-12 py-4 text-lg">
            입장하기
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
