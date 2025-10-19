/**
 * @fileoverview Lobby 페이지 (개선판 v2)
 * @module pages/Lobby
 */

import { useEffect, useCallback, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VideoPreview } from "@/components/media/VideoPreview";
import { DeviceSelector } from "@/components/setting/DeviceSelector";
import { toast } from "sonner";
import { Mic, MicOff, Video, VideoOff, Edit3 } from "lucide-react";
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
    setNavigatingToRoom,
    updateNickname
  } = useLobbyStore();

  // 닉네임 변경을 위한 로컬 상태
  const [localNickname, setLocalNickname] = useState('');
  // 닉네임 편집 중인지 여부
  const [isEditing, setIsEditing] = useState(false);
  
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
      toast.error('Room title is required.');
      navigate('/');
      return;
    }

    initialize(roomTitle, initialNickname);
    
    // 로컬 닉네임 상태도 초기화
    setLocalNickname(initialNickname || connectionDetails?.nickname || '');

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
      toast.error('Initializing...');
      return;
    }

    if (!localStream) {
      toast.error('Media stream is not available.');
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

    toast.success('Entering room...');
  }, [connectionDetails, isInitialized, localStream, setNavigatingToRoom, setSession, navigate]);

  /**
   * 닉네임 변경 핸들러
   */
  const handleNicknameChange = () => {
    if (localNickname.trim() && localNickname !== connectionDetails?.nickname) {
      updateNickname(localNickname.trim());
      toast.success('Nickname updated successfully.');
    }
    setIsEditing(false);
  };

  /**
   * 디바이스 변경 핸들러
   */
  const handleAudioDeviceChange = (deviceId: string) => {
    changeAudioDevice(deviceId);
  };

  const handleVideoDeviceChange = (deviceId: string) => {
    changeVideoDevice(deviceId);
  };

  // connectionDetails.nickname이 변경되었을 때 로컬 닉네임 상태 업데이트 (편집 중이 아닐 때만)
  useEffect(() => {
    if (!isEditing && connectionDetails?.nickname) {
      setLocalNickname(connectionDetails.nickname);
    }
  }, [connectionDetails?.nickname, isEditing]);

  if (!isInitialized || !connectionDetails) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
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
            <h1 className="text-2xl font-bold text-foreground mb-4">Lobby</h1>
            {/* 닉네임 변경 입력 필드 */}
            <div className="flex items-center justify-center gap-2 mb-2">
              <Input
                type="text"
                value={localNickname}
                onChange={(e) => setLocalNickname(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNicknameChange()}
                className="w-48 h-8 text-sm"
                placeholder="Enter nickname"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNicknameChange}
                className="h-8 w-8 p-0"
              >
                <Edit3 className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Room Title: <span className="text-primary font-medium">"{connectionDetails.roomTitle}"</span>
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
            <h3 className="text-sm font-medium mb-3">Device Settings</h3>
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
            Join Room
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
          <h1 className="text-3xl font-bold text-foreground mb-4">Lobby</h1>
          {/* 닉네임 변경 입력 필드 */}
          <div className="flex items-center justify-center gap-2 mb-2">
            <Input
              type="text"
              value={localNickname}
              onChange={(e) => setLocalNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNicknameChange()}
              className="w-48 h-8 text-sm"
              placeholder="Enter nickname"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNicknameChange}
              className="h-8 w-8 p-0"
            >
              <Edit3 className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-muted-foreground mt-2">
            Room Title: <span className="text-primary font-medium">"{connectionDetails.roomTitle}"</span>
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
              <h3 className="font-medium text-foreground mb-4">Media</h3>
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
              <h3 className="font-medium text-foreground mb-4">Devices</h3>
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
            Join Room
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
