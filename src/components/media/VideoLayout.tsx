import { DraggableVideo } from "@/components/media/DraggableVideo";
import { VideoPreview } from "@/components/media/VideoPreview";
import { Participant, useParticipants } from '@/hooks/useParticipants';
import { useResponsiveVideoGrid } from '@/hooks/useResponsiveGrid';
import { useScreenOrientation } from "@/hooks/useScreenOrientation";
import { cn } from "@/lib/utils";
import { useMediaDeviceStore } from "@/stores/useMediaDeviceStore";
import { useSubtitleStore } from "@/stores/useSubtitleStore";
import { useTranscriptionStore } from "@/stores/useTranscriptionStore";
import { useUIManagementStore } from "@/stores/useUIManagementStore";
import { Loader2, RotateCw } from "lucide-react";
import { useCallback, useMemo, useState } from 'react';
import { SubtitleOverlay } from '../functions/SubtitleOverlay';
import { Button } from '../ui/button';
import MobileSpeakerStrip from './MobileSpeakerStrip';

/**
 * LocalVideoTile 컴포넌트
 *
 * 로컬 사용자의 비디오 타일을 렌더링하며, 모바일 환경에서 카메라 전환 기능을 제공합니다.
 *
 * **주요 기능:**
 * - 로컬 비디오 스트림 표시
 * - 모바일 환경에서 전면/후면 카메라 전환 버튼 제공
 * - 다중 카메라 지원 시에만 전환 버튼 표시
 *
 * @param participant - 로컬 참가자 정보
 * @param isMobile - 모바일 환경 여부
 */
const LocalVideoTile = ({
  participant,
  isMobile
}: {
  participant: Participant;
  isMobile: boolean;
}) => {
  const { switchCamera, isMobile: isDeviceMobile, hasMultipleCameras } = useMediaDeviceStore();

  /**
   * 카메라 전환 버튼 표시 조건:
   * 1. 모바일 레이아웃 모드
   * 2. 실제 모바일 디바이스
   * 3. 다중 카메라 지원
   */
  const shouldShowCameraSwitch = isMobile && isDeviceMobile && hasMultipleCameras;

  return (
    <div className="relative w-full h-full overflow-hidden rounded-lg bg-muted">
      <VideoPreview
        stream={participant.stream}
        nickname={participant.nickname}
        isVideoEnabled={participant.videoEnabled}
        isLocalVideo={true}
        audioLevel={0}
        showSubtitles={false}
        isScreenShare={participant.isSharingScreen}
        isFileStreaming={participant.isStreamingFile}
      />

      {shouldShowCameraSwitch && (
        <Button
          variant="ghost"
          size="sm"
          onClick={switchCamera}
          className="absolute top-2 right-2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm p-0 hover:bg-black/50 transition-colors"
          aria-label="Switch camera"
        >
          <RotateCw className="w-5 h-5 text-white" />
        </Button>
      )}
    </div>
  );
};

/**
 * RemoteVideoTile 컴포넌트
 *
 * 원격 참가자의 비디오 타일을 렌더링하며, 자막, 연결 상태, 트랜스크립션을 표시합니다.
 *
 * **주요 기능:**
 * - 원격 비디오 스트림 표시
 * - 파일 스트리밍 시 자막 오버레이 표시
 * - 실시간 트랜스크립션 및 번역 자막 표시
 * - 연결 상태 표시 (연결 중, 연결 끊김, 실패)
 *
 * @param participant - 원격 참가자 정보
 * @param showAudioVisualizer - 오디오 시각화 표시 여부 (현재 미사용)
 */
const RemoteVideoTile = ({
  participant,
  showAudioVisualizer = false
}: {
  participant: Participant;
  showAudioVisualizer?: boolean;
}) => {
  const { isRemoteSubtitleEnabled, remoteSubtitleCue } = useSubtitleStore();
  const { translationTargetLanguage } = useTranscriptionStore();

  /**
   * 파일 스트리밍 중 자막 표시 조건:
   * 1. 참가자가 파일 스트리밍 중
   * 2. 원격 자막 활성화
   * 3. 자막 큐 데이터 존재
   */
  const shouldShowFileSubtitle = participant.isStreamingFile &&
                                 isRemoteSubtitleEnabled &&
                                 remoteSubtitleCue;

  /**
   * 실시간 트랜스크립션 표시 조건:
   * 1. 파일 스트리밍 중이 아님
   * 2. 트랜스크립션 데이터 존재
   */
  const shouldShowTranscript = !participant.isStreamingFile && participant.transcript;

  return (
    <div className="relative w-full h-full overflow-hidden rounded-lg bg-muted">
      <VideoPreview
        stream={participant.stream}
        nickname={participant.nickname}
        isVideoEnabled={participant.videoEnabled}
        isLocalVideo={false}
        audioLevel={0}
        showSubtitles={false}
        showVoiceFrame={false}
        isScreenShare={participant.isSharingScreen}
        isFileStreaming={participant.isStreamingFile}
      />

      {/* 파일 스트리밍 자막 오버레이 */}
      {shouldShowFileSubtitle && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-fit max-w-[90%] p-2.5 rounded-lg bg-black/60 backdrop-blur-md text-center pointer-events-none z-20">
          <p className="text-base sm:text-lg lg:text-xl font-semibold text-white leading-tight">
            {remoteSubtitleCue.text}
          </p>
        </div>
      )}

      {/* 실시간 트랜스크립션 자막 */}
      {shouldShowTranscript && (
        <SubtitleOverlay
          transcript={participant.transcript}
          targetLang={translationTargetLanguage}
        />
      )}

      {/* 연결 중 상태 표시 */}
      {participant.connectionState === 'connecting' && (
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center rounded-lg gap-4">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
          <p className="text-white text-base sm:text-lg font-medium px-4 text-center">
            Connecting to {participant.nickname}...
          </p>
        </div>
      )}

      {/* 연결 끊김/실패 상태 표시 */}
      {(participant.connectionState === 'disconnected' ||
        participant.connectionState === 'failed') && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-lg">
          <p className="text-white text-base sm:text-lg font-medium px-4 text-center">
            Connection to {participant.nickname} lost.
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * ViewerGallery 컴포넌트
 *
 * 뷰어 모드 및 콘텐츠 뷰어용 하단 참가자 갤러리를 렌더링합니다.
 * ContentLayout의 ParticipantGallery와 동일한 시각/행동 규칙을 따릅니다.
 *
 * **반응형 동작:**
 * - 세로 모드: 작은 높이(12vh), 좁은 간격
 * - 가로 모드: 큰 높이(20vh), 넓은 간격
 *
 * **상호작용:**
 * - 참가자 클릭 시 메인 뷰로 전환
 * - 현재 메인 참가자는 파란색 링으로 강조
 * - 수평 스크롤 지원
 *
 * @param participants - 갤러리에 표시할 참가자 목록
 * @param mainParticipantId - 현재 메인 뷰에 표시 중인 참가자 ID
 * @param onSelect - 참가자 선택 시 호출되는 콜백 함수
 */
const ViewerGallery = ({
  participants,
  mainParticipantId,
  onSelect,
}: {
  participants: Participant[];
  mainParticipantId: string | null;
  onSelect?: (userId: string) => void;
}) => {
  const { isPortrait } = useScreenOrientation();

  const galleryHeight = isPortrait
    ? "h-[12vh] min-h-[70px] max-h-[100px]"
    : "h-[20vh] min-h-[120px] max-h-[180px]";

  const spacing = isPortrait ? "space-x-1.5" : "space-x-2 sm:space-x-3";
  const padding = isPortrait ? "p-1.5" : "p-2 sm:p-3";

  if (participants.length === 0) return null;

  return (
    <div
      className={cn(
        "bg-background/80 backdrop-blur-sm flex items-center overflow-x-auto overflow-y-hidden",
        "scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent",
        galleryHeight,
        padding
      )}
    >
      <div className={cn("flex items-center h-full", spacing)}>
        {participants.map((p) => {
          const isMainParticipant = p.userId === mainParticipantId;

          return (
            <div
              key={p.userId}
              className={cn(
                "h-full flex-shrink-0 rounded-md overflow-hidden relative group transition-all duration-200",
                "aspect-video cursor-pointer",
                isMainParticipant && "ring-2 ring-blue-500 ring-offset-2 ring-offset-background shadow-lg scale-105"
              )}
              onClick={() => onSelect?.(p.userId)}
              role="button"
              tabIndex={0}
              aria-label={`Switch to ${p.nickname}'s video`}
              aria-pressed={isMainParticipant}
            >
              <VideoPreview
                stream={p.stream}
                isVideoEnabled={p.videoEnabled}
                nickname={p.nickname}
                isLocalVideo={p.isLocal}
                showSubtitles={true}
                isScreenShare={p.isSharingScreen}
                isFileStreaming={p.isStreamingFile}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * VideoTile 컴포넌트
 *
 * 참가자가 로컬인지 원격인지에 따라 적절한 타일 컴포넌트를 렌더링합니다.
 * 이는 팩토리 패턴으로, 타일 타입 결정 로직을 캡슐화합니다.
 *
 * @param participant - 참가자 정보
 * @param isMobile - 모바일 환경 여부
 */
const VideoTile = ({
  participant,
  isMobile
}: {
  participant: Participant;
  isMobile: boolean;
}) => {
  return participant.isLocal ? (
    <LocalVideoTile participant={participant} isMobile={isMobile} />
  ) : (
    <RemoteVideoTile participant={participant} showAudioVisualizer={false} />
  );
};

/**
 * WaitingScreen 컴포넌트
 *
 * 참가자 대기 화면을 렌더링합니다.
 * 스피커 모드와 뷰어 모드에서 다른 메시지를 표시합니다.
 *
 * @param mode - 현재 뷰 모드
 */
const WaitingScreen = ({ mode }: { mode: 'speaker' | 'viewer' }) => {
  const messages = {
    speaker: {
      title: "Waiting for another participant to join...",
      subtitle: "Your video will appear in the corner once someone joins"
    },
    viewer: {
      title: "Waiting for participants...",
      subtitle: "Select a participant from the gallery below"
    }
  };

  const message = messages[mode];

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50 rounded-lg gap-4 m-4">
      <Loader2 className="w-12 h-12 text-muted-foreground animate-spin" />
      <div className="text-center px-4">
        <p className="text-muted-foreground text-base sm:text-lg font-medium mb-2">
          {message.title}
        </p>
        <p className="text-muted-foreground/70 text-sm">
          {message.subtitle}
        </p>
      </div>
    </div>
  );
};

/**
 * VideoLayout 컴포넌트
 *
 * 통화 화면의 메인 레이아웃을 관리하며, 다양한 뷰 모드를 지원합니다.
 *
 * **뷰 모드:**
 *
 * 1. **그리드 모드 (grid):**
 *    - 모든 참가자를 동일한 크기의 타일로 표시
 *    - 3명: 커스텀 레이아웃 (세로: 1+2, 가로: 2+1)
 *    - 4명: 2x2 그리드
 *    - 5명 이상: 자동 그리드 계산
 *
 * 2. **스피커 모드 (speaker):**
 *    - 메인 참가자를 전체 화면에 표시
 *    - **모바일**: 상단 가로 스크롤 스트립으로 참가자 전환
 *    - **데스크톱**: 우측 하단 PIP 스택 (드래그 가능, 위치 영구 저장)
 *    - PIP 숨김/표시 토글 기능
 *
 * 3. **뷰어 모드 (viewer):**
 *    - 선택된 참가자를 메인 뷰에 표시
 *    - 하단 갤러리에서 참가자 전환 가능 (메인 참가자 제외)
 *    - 갤러리는 수평 스크롤 지원
 *
 * **반응형 동작:**
 * - 화면 방향(세로/가로) 자동 감지
 * - 참가자 수에 따른 레이아웃 자동 조정
 * - 모바일/데스크톱 최적화
 *
 * **성능 최적화:**
 * - useMemo를 통한 계산 결과 캐싱
 * - useCallback을 통한 함수 메모이제이션
 * - 불필요한 리렌더링 방지
 */
export const VideoLayout = () => {
  const { viewMode, viewerModeParticipantId, setViewerModeParticipant } = useUIManagementStore();
  const participants = useParticipants();
  const { isPortrait } = useScreenOrientation();

  const [showLocalVideo, setShowLocalVideo] = useState(true);
  const [focusedParticipantId, setFocusedParticipantId] = useState<string | null>(null);

  const gridConfig = useResponsiveVideoGrid(participants.length);

  /**
   * 참가자 분류
   * 로컬 참가자와 원격 참가자를 분리하여 관리합니다.
   */
  const { localParticipant, remoteParticipants, hasRemoteParticipant } = useMemo(() => {
    const local = participants.find(p => p.isLocal);
    const remote = participants.filter(p => !p.isLocal);

    return {
      localParticipant: local,
      remoteParticipants: remote,
      hasRemoteParticipant: remote.length > 0
    };
  }, [participants]);

  /**
   * 메인 뷰에 표시할 참가자를 결정합니다.
   *
   * **우선순위:**
   * 1. 뷰어 모드: viewerModeParticipantId
   * 2. 스피커 모드: focusedParticipantId
   * 3. 기본값: 첫 번째 원격 참가자
   */
  const getMainParticipant = useCallback((): Participant | null => {
    if (!hasRemoteParticipant) return null;

    if (viewMode === 'viewer' && viewerModeParticipantId) {
      const viewerParticipant = participants.find(p => p.userId === viewerModeParticipantId);
      return viewerParticipant || remoteParticipants[0];
    }

    if (focusedParticipantId) {
      const focused = participants.find(p => p.userId === focusedParticipantId);
      return focused || remoteParticipants[0];
    }

    return remoteParticipants[0];
  }, [
    hasRemoteParticipant,
    viewMode,
    viewerModeParticipantId,
    focusedParticipantId,
    participants,
    remoteParticipants
  ]);

  /**
   * PIP(Picture-in-Picture) 또는 갤러리에 표시할 참가자 목록을 반환합니다.
   * 메인 참가자를 제외한 모든 참가자를 포함합니다.
   */
  const getPIPParticipants = useCallback((): Participant[] => {
    if (!localParticipant) return [];
    if (!hasRemoteParticipant) return [localParticipant];

    const mainParticipant = getMainParticipant();
    return participants.filter(p => p.userId !== mainParticipant?.userId);
  }, [localParticipant, hasRemoteParticipant, participants, getMainParticipant]);

  /**
   * 참가자 포커스 핸들러
   *
   * 뷰어 모드에서는 viewerModeParticipant를 설정하고,
   * 스피커 모드에서는 focusedParticipantId를 설정합니다.
   */
  const handleFocusParticipant = useCallback((userId: string) => {
    if (viewMode === 'viewer') {
      setViewerModeParticipant(userId);
    } else {
      setFocusedParticipantId(userId);
    }
  }, [viewMode, setViewerModeParticipant]);

  /**
   * PIP 숨김 핸들러
   * 모든 PIP를 숨기고, 표시 버튼을 활성화합니다.
   */
  const handleHidePIP = useCallback(() => {
    setShowLocalVideo(false);
  }, []);

  /**
   * PIP 표시 핸들러
   * 숨겨진 PIP를 다시 표시합니다.
   */
  const handleShowPIP = useCallback(() => {
    setShowLocalVideo(true);
  }, []);

  // 로컬 참가자 없으면 렌더링 중단
  if (!localParticipant) return null;

  const mainParticipant = getMainParticipant();
  const pipParticipants = getPIPParticipants();

  // ============================================================
  // 스피커 모드: 메인 뷰 + 모바일 스트립 또는 데스크톱 PIP
  // ============================================================
  if (viewMode === 'speaker') {
    return (
      <div className="relative h-full">
        {mainParticipant ? (
          <div className="absolute inset-0">
            <VideoTile participant={mainParticipant} isMobile={gridConfig.isMobile} />
          </div>
        ) : (
          <WaitingScreen mode="speaker" />
        )}

        {/* 모바일: 상단 가로 스크롤 스트립으로 PIP 대체 */}
        {gridConfig.isMobile ? (
          <>
            {showLocalVideo && (
              <MobileSpeakerStrip
                participants={pipParticipants}
                mainParticipantId={mainParticipant?.userId || null}
                onSelect={handleFocusParticipant}
                onHide={handleHidePIP}
              />
            )}
            {!showLocalVideo && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleShowPIP}
                className="fixed top-4 right-4 z-40 shadow-lg"
                aria-label="Show videos"
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                Show videos
              </Button>
            )}
          </>
        ) : (
          /* 데스크톱: 드래그 가능한 PIP 스택 */
          <>
            {showLocalVideo && pipParticipants.map((participant, index) => (
              <DraggableVideo
                key={participant.userId}
                userId={participant.userId}
                stream={participant.stream}
                nickname={participant.nickname}
                isVideoEnabled={participant.videoEnabled}
                isLocalVideo={participant.isLocal}
                onHide={handleHidePIP}
                onFocus={() => handleFocusParticipant(participant.userId)}
                canFocus={hasRemoteParticipant}
                isFocused={focusedParticipantId === participant.userId}
                stackIndex={index}
                stackGap={12}
              />
            ))}
            {!showLocalVideo && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleShowPIP}
                className="fixed bottom-20 right-4 z-40 shadow-lg"
                aria-label="Show hidden videos"
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                Show videos
              </Button>
            )}
          </>
        )}
      </div>
    );
  }

  // ============================================================
  // 뷰어 모드: 메인 뷰 + 하단 갤러리 (메인 참가자 제외)
  // ============================================================
  if (viewMode === 'viewer') {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex-1 relative overflow-hidden min-h-0">
          {mainParticipant ? (
            <div className="absolute inset-0">
              <VideoTile participant={mainParticipant} isMobile={gridConfig.isMobile} />
            </div>
          ) : (
            <WaitingScreen mode="viewer" />
          )}
        </div>
        {/* 메인 참가자 중복 제거: 하단 갤러리에서 제외 */}
        <ViewerGallery
          participants={
            mainParticipant
              ? participants.filter(p => p.userId !== mainParticipant.userId)
              : participants
          }
          mainParticipantId={mainParticipant?.userId || null}
          onSelect={setViewerModeParticipant}
        />
      </div>
    );
  }

  // ============================================================
  // 그리드 모드: 3명 커스텀 레이아웃
  // ============================================================
  if (gridConfig.layout === 'custom-3') {
    if (isPortrait) {
      // 세로 모드: 상단 1개 + 하단 2개
      return (
        <div className="flex flex-col h-full w-full p-2 gap-2 overflow-hidden">
          <div
            className="w-full overflow-hidden"
            style={{ height: 'calc(50% - 4px)' }}
          >
            <VideoTile participant={participants[0]} isMobile={true} />
          </div>

          <div
            className="w-full grid grid-cols-2 gap-2 overflow-hidden"
            style={{ height: 'calc(50% - 4px)' }}
          >
            {participants.slice(1).map(participant => (
              <div key={participant.userId} className="w-full h-full overflow-hidden">
                <VideoTile participant={participant} isMobile={true} />
              </div>
            ))}
          </div>
        </div>
      );
    }

    // 가로 모드: 상단 2개 + 하단 중앙 1개
    return (
      <div className="flex flex-col h-full w-full p-2 sm:p-4 gap-2 sm:gap-4 overflow-hidden">
        <div
          className="w-full grid grid-cols-2 gap-2 sm:gap-4 overflow-hidden"
          style={{ height: 'calc(50% - 4px)' }}
        >
          {participants.slice(0, 2).map(participant => (
            <div key={participant.userId} className="w-full h-full overflow-hidden">
              <VideoTile participant={participant} isMobile={gridConfig.isMobile} />
            </div>
          ))}
        </div>

        <div
          className="w-full flex items-center justify-center overflow-hidden"
          style={{ height: 'calc(50% - 4px)' }}
        >
          <div className="w-full max-w-[50%] h-full overflow-hidden">
            <VideoTile participant={participants[2]} isMobile={gridConfig.isMobile} />
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // 그리드 모드: 4명 커스텀 레이아웃 (2x2)
  // ============================================================
  if (gridConfig.layout === 'custom-4') {
    return (
      <div className="flex flex-col h-full w-full p-2 sm:p-4 gap-2 sm:gap-4 overflow-hidden">
        <div
          className="w-full grid grid-cols-2 gap-2 sm:gap-4 overflow-hidden"
          style={{ height: 'calc(50% - 4px)' }}
        >
          {participants.slice(0, 2).map(participant => (
            <div key={participant.userId} className="w-full h-full overflow-hidden">
              <VideoTile participant={participant} isMobile={gridConfig.isMobile} />
            </div>
          ))}
        </div>

        <div
          className="w-full grid grid-cols-2 gap-2 sm:gap-4 overflow-hidden"
          style={{ height: 'calc(50% - 4px)' }}
        >
          {participants.slice(2, 4).map(participant => (
            <div key={participant.userId} className="w-full h-full overflow-hidden">
              <VideoTile participant={participant} isMobile={gridConfig.isMobile} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ============================================================
  // 기본 그리드 레이아웃 (5명 이상)
  // ============================================================
  return (
    <div className={cn(
      gridConfig.containerClass,
      gridConfig.gridClass,
      gridConfig.gap,
      "overflow-hidden"
    )}>
      {participants.map(participant => (
        <div
          key={participant.userId}
          className={cn(gridConfig.itemClass, "overflow-hidden")}
        >
          <VideoTile participant={participant} isMobile={gridConfig.isMobile} />
        </div>
      ))}
    </div>
  );
};
