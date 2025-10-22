/**
 * @fileoverview Lobby 페이지 - 방 입장 전 미디어 설정 및 프리뷰
 * @module pages/Lobby
 *
 * @description
 * 사용자가 실제 방에 입장하기 전 미디어 디바이스를 테스트하고 설정하는 대기실 페이지입니다.
 *
 * **주요 기능:**
 * - 실시간 비디오/오디오 프리뷰
 * - 미디어 디바이스 선택 및 전환
 * - 닉네임 실시간 편집
 * - 반응형 레이아웃 (모바일/데스크톱)
 * - 방 타입 검증 및 세션 초기화
 *
 * **데이터 흐름:**
 * Landing → Lobby (state: nickname, roomType) → Room (state: connectionDetails)
 */

import { VideoPreview } from "@/components/media/VideoPreview";
import { DeviceSelector } from "@/components/setting/DeviceSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLobbyStore } from "@/stores/useLobbyStore";
import { useMediaDeviceStore } from "@/stores/useMediaDeviceStore";
import { useSessionStore } from "@/stores/useSessionStore";
import { RoomType } from '@/types/room.types';
import { Edit3, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

/**
 * Lobby 컴포넌트
 *
 * @component
 * @example
 * ```tsx
 * // React Router를 통한 자동 렌더링
 * <Route path="/lobby/:roomTitle" element={<Lobby />} />
 * ```
 */
const Lobby = () => {
  const navigate = useNavigate();
  const { roomTitle } = useParams<{ roomTitle: string }>();
  const location = useLocation();
  const isMobile = useIsMobile();

  // Lobby 상태 관리
  const {
    connectionDetails,
    isInitialized,
    initialize,
    cleanup,
    setNavigatingToRoom,
    updateNickname
  } = useLobbyStore();

  // 미디어 디바이스 상태 관리
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

  // 세션 상태 관리
  const { setSession } = useSessionStore();

  // 닉네임 편집을 위한 로컬 상태
  const [localNickname, setLocalNickname] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  /**
   * 초기화 및 검증 Effect
   *
   * @description
   * Landing 페이지에서 전달된 state를 검증하고 Lobby를 초기화합니다.
   * 필수 데이터(roomTitle, roomType)가 없으면 Landing으로 리다이렉트합니다.
   */
  useEffect(() => {
    const initialNickname = location.state?.nickname || '';
    const initialRoomType: RoomType | undefined = location.state?.roomType;

    // 방 제목 검증
    if (!roomTitle) {
      toast.error('Room title is required.');
      navigate('/');
      return;
    }

    // 방 타입 검증 (필수)
    if (!initialRoomType) {
      toast.error('Room type is required.');
      navigate('/');
      return;
    }

    // Lobby 초기화 (미디어 스트림 획득 포함)
    initialize(roomTitle, initialNickname, initialRoomType);

    // 로컬 닉네임 상태 초기화
    setLocalNickname(initialNickname || connectionDetails?.nickname || '');

    // 정리 함수: 컴포넌트 언마운트 시 실행
    return () => {
      console.log('[Lobby] Cleaning up on unmount...');
      cleanup(); // LobbyStore의 cleanup이 조건부로 미디어 정리
    };
  }, [roomTitle, location.state, navigate, initialize, cleanup, connectionDetails?.nickname]);

  /**
   * 브라우저 종료/새로고침 이벤트 처리
   *
   * @description
   * 사용자가 브라우저를 닫거나 새로고침할 때 미디어 스트림을 강제로 정리합니다.
   * 이는 카메라/마이크가 계속 활성화되어 있는 것을 방지합니다.
   */
  useEffect(() => {
    /**
     * beforeunload 이벤트 핸들러
     * 브라우저 종료 또는 새로고침 시 실행
     */
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      console.log('[Lobby] Browser closing/refreshing, cleaning up...');
      cleanupMediaDevice();
    };

    /**
     * pagehide 이벤트 핸들러
     * 페이지가 완전히 숨겨질 때 실행 (모바일 Safari 등)
     */
    const handlePageHide = () => {
      console.log('[Lobby] Page hidden, cleaning up...');
      cleanupMediaDevice();
    };

    /**
     * visibilitychange 이벤트 핸들러
     * 탭 전환 감지 (현재는 로깅만 수행)
     */
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[Lobby] Tab hidden');
        // 탭이 숨겨질 때는 정리하지 않음 (사용자가 다시 돌아올 수 있음)
      }
    };

    // 이벤트 리스너 등록
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 정리 함수: 이벤트 리스너 제거
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [cleanupMediaDevice]);

  /**
   * 방 입장 핸들러
   *
   * @description
   * 모든 검증을 통과하면 사용자를 실제 방(Room)으로 이동시킵니다.
   * 세션 정보를 생성하고 미디어 스트림을 유지한 채로 네비게이션합니다.
   *
   * @callback
   */
  const handleJoinRoom = useCallback(() => {
    // 초기화 상태 확인
    if (!connectionDetails || !isInitialized) {
      toast.error('Initializing...');
      return;
    }

    // 미디어 스트림 확인
    if (!localStream) {
      toast.error('Media stream is not available.');
      return;
    }

    // Room으로 정상 이동 중임을 표시 (cleanup 방지용)
    setNavigatingToRoom(true);

    // 고유 사용자 ID 생성
    const userId = nanoid();

    // 세션 스토어에 사용자 정보 저장
    setSession(
      userId,
      connectionDetails.nickname,
      connectionDetails.roomTitle,
      connectionDetails.roomType
    );

    // 디버깅용 로그
    console.log('[Lobby] Navigating to room with stream:', {
      hasStream: !!localStream,
      audioTracks: localStream.getAudioTracks().length,
      videoTracks: localStream.getVideoTracks().length,
      roomType: connectionDetails.roomType
    });

    // Room 페이지로 네비게이션 (state에 연결 정보 전달)
    navigate(`/room/${encodeURIComponent(connectionDetails.roomTitle)}`, {
      state: {
        connectionDetails: { ...connectionDetails, userId }
      }
    });

    toast.success('Entering room...');
  }, [
    connectionDetails,
    isInitialized,
    localStream,
    setNavigatingToRoom,
    setSession,
    navigate
  ]);

  /**
   * 닉네임 변경 핸들러
   *
   * @description
   * 사용자가 입력한 닉네임을 검증하고 스토어에 업데이트합니다.
   */
  const handleNicknameChange = () => {
    if (localNickname.trim() && localNickname !== connectionDetails?.nickname) {
      updateNickname(localNickname.trim());
      toast.success('Nickname updated successfully.');
    }
    setIsEditing(false);
  };

  /**
   * 오디오 디바이스 변경 핸들러
   * @param {string} deviceId - 선택된 오디오 디바이스 ID
   */
  const handleAudioDeviceChange = (deviceId: string) => {
    changeAudioDevice(deviceId);
  };

  /**
   * 비디오 디바이스 변경 핸들러
   * @param {string} deviceId - 선택된 비디오 디바이스 ID
   */
  const handleVideoDeviceChange = (deviceId: string) => {
    changeVideoDevice(deviceId);
  };

  /**
   * 닉네임 동기화 Effect
   *
   * @description
   * connectionDetails의 닉네임이 변경되면 로컬 상태를 업데이트합니다.
   * 단, 사용자가 편집 중일 때는 동기화하지 않습니다.
   */
  useEffect(() => {
    if (!isEditing && connectionDetails?.nickname) {
      setLocalNickname(connectionDetails.nickname);
    }
  }, [connectionDetails?.nickname, isEditing]);

  /**
   * 로딩 상태 렌더링
   */
  if (!isInitialized || !connectionDetails) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  /**
   * 모바일 레이아웃
   *
   * @description
   * 세로 스크롤 가능한 단일 컬럼 레이아웃
   * 하단 고정 버튼으로 UX 최적화
   */
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background overflow-y-auto">
        <div className="flex flex-col p-4 pb-24">
          {/* 헤더 섹션 */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-4">Lobby</h1>

            {/* 닉네임 편집 필드 */}
            <div className="flex items-center justify-center gap-2 mb-2">
              <Input
                type="text"
                value={localNickname}
                onChange={(e) => setLocalNickname(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNicknameChange()}
                onFocus={() => setIsEditing(true)}
                className="w-48 h-8 text-sm"
                placeholder="Enter nickname"
                aria-label="Nickname input"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNicknameChange}
                className="h-8 w-8 p-0"
                aria-label="Save nickname"
              >
                <Edit3 className="w-4 h-4" />
              </Button>
            </div>

            {/* 방 정보 표시 */}
            <p className="text-sm text-muted-foreground mt-1">
              Room Title: <span className="text-primary font-medium">"{connectionDetails.roomTitle}"</span>
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Type: <span className="text-primary/80 font-medium">{connectionDetails.roomType}</span>
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

          {/* 미디어 컨트롤 버튼 */}
          <div className="flex gap-3 mb-6">
            <Button
              variant={isAudioEnabled ? "default" : "destructive"}
              size="lg"
              onClick={toggleAudio}
              className="flex-1"
              aria-label={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
            >
              {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </Button>
            <Button
              variant={isVideoEnabled ? "default" : "destructive"}
              size="lg"
              onClick={toggleVideo}
              className="flex-1"
              aria-label={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
            >
              {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </Button>
          </div>

          {/* 디바이스 설정 패널 */}
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

        {/* 하단 고정 Join 버튼 */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-xl border-t border-border/50">
          <Button
            onClick={handleJoinRoom}
            className="w-full h-12 text-lg btn-connection"
            aria-label="Join room"
          >
            Join Room
          </Button>
        </div>
      </div>
    );
  }

  /**
   * 데스크톱 레이아웃
   *
   * @description
   * 2:1 비율의 그리드 레이아웃 (비디오 프리뷰 : 컨트롤 패널)
   * 중앙 정렬된 대칭 구조
   */
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-5xl w-full">
        {/* 헤더 섹션 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">Lobby</h1>

          {/* 닉네임 편집 필드 */}
          <div className="flex items-center justify-center gap-2 mb-2">
            <Input
              type="text"
              value={localNickname}
              onChange={(e) => setLocalNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNicknameChange()}
              onFocus={() => setIsEditing(true)}
              className="w-48 h-8 text-sm"
              placeholder="Enter nickname"
              aria-label="Nickname input"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNicknameChange}
              className="h-8 w-8 p-0"
              aria-label="Save nickname"
            >
              <Edit3 className="w-4 h-4" />
            </Button>
          </div>

          {/* 방 정보 표시 */}
          <p className="text-muted-foreground mt-2">
            Room Title: <span className="text-primary font-medium">"{connectionDetails.roomTitle}"</span>
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Type: <span className="text-primary/80 font-medium">{connectionDetails.roomType}</span>
          </p>
        </div>

        {/* 메인 그리드 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 비디오 프리뷰 (2/3 영역) */}
          <div className="lg:col-span-2">
            <VideoPreview
              stream={localStream}
              isVideoEnabled={isVideoEnabled}
              nickname={connectionDetails.nickname}
              isLocalVideo={true}
            />
          </div>

          {/* 사이드 패널 (1/3 영역) */}
          <div className="space-y-6">
            {/* 미디어 컨트롤 패널 */}
            <div className="control-panel">
              <h3 className="font-medium text-foreground mb-4">Media</h3>
              <div className="flex gap-3">
                <Button
                  variant={isAudioEnabled ? "default" : "destructive"}
                  size="lg"
                  onClick={toggleAudio}
                  className="flex-1"
                  aria-label={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
                >
                  {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </Button>
                <Button
                  variant={isVideoEnabled ? "default" : "destructive"}
                  size="lg"
                  onClick={toggleVideo}
                  className="flex-1"
                  aria-label={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
                >
                  {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </Button>
              </div>
            </div>

            {/* 디바이스 설정 패널 */}
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

        {/* Join 버튼 */}
        <div className="text-center mt-8">
          <Button
            onClick={handleJoinRoom}
            className="btn-connection px-12 py-4 text-lg"
            aria-label="Join room"
          >
            Join Room
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
