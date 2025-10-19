import { DraggableVideo } from "@/components/media/DraggableVideo";
import { VideoPreview } from "@/components/media/VideoPreview";
import { useIsMobile } from '@/hooks/use-mobile';
import { Participant, useParticipants } from '@/hooks/useParticipants';
import { useMediaDeviceStore } from "@/stores/useMediaDeviceStore";
import { useSubtitleStore } from "@/stores/useSubtitleStore";
import { useTranscriptionStore } from "@/stores/useTranscriptionStore";
import { useUIManagementStore } from "@/stores/useUIManagementStore";
import { Eye, Loader2, RotateCw } from "lucide-react";
import { useState } from 'react';
import { SubtitleOverlay } from '../functions/SubtitleOverlay';
import { Button } from '../ui/button';

const LocalVideoTile = ({ participant, isMobile }: { participant: Participant; isMobile: boolean }) => {
  const { switchCamera, isMobile: isDeviceMobile, hasMultipleCameras } = useMediaDeviceStore();

  return (
    <div className="relative w-full h-full">
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

      {isMobile && isDeviceMobile && hasMultipleCameras && (
        <Button
          variant="ghost"
          size="sm"
          onClick={switchCamera}
          className="absolute top-2 right-2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm p-0"
        >
          <RotateCw className="w-5 h-5 text-white" />
        </Button>
      )}
    </div>
  );
};

const RemoteVideoTile = ({
  participant,
  showAudioVisualizer
}: {
  participant: Participant;
  showAudioVisualizer: boolean;
}) => {
  const { isRemoteSubtitleEnabled } = useSubtitleStore();
  const { translationTargetLanguage } = useTranscriptionStore();
  const { remoteSubtitleCue } = useSubtitleStore();

  return (
    <div className="relative w-full h-full">
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

      {participant.isStreamingFile && isRemoteSubtitleEnabled && remoteSubtitleCue && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-fit max-w-[90%] p-2.5 rounded-lg bg-black/60 backdrop-blur-md text-center pointer-events-none z-20">
          <p className="text-lg lg:text-xl font-semibold text-white">
            {remoteSubtitleCue.text}
          </p>
        </div>
      )}

      {!participant.isStreamingFile && participant.transcript && (
        <SubtitleOverlay
          transcript={participant.transcript}
          targetLang={translationTargetLanguage}
        />
      )}

      {participant.connectionState === 'connecting' && (
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center rounded-lg gap-4">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
          <p className="text-white text-lg font-medium">Connecting to {participant.nickname}...</p>
        </div>
      )}

      {(participant.connectionState === 'disconnected' || participant.connectionState === 'failed') && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-lg">
          <p className="text-white text-lg font-medium">Connection to {participant.nickname} lost.</p>
        </div>
      )}
    </div>
  );
};

export const VideoLayout = () => {
  const { viewMode, viewerModeParticipantId, setViewerModeParticipant } = useUIManagementStore();
  const participants = useParticipants();
  const { localStream, isVideoEnabled } = useMediaDeviceStore();
  const localParticipant = participants.find(p => p.isLocal);
  const remoteParticipants = participants.filter(p => !p.isLocal);

  const isMobileView = useIsMobile();
  const [showLocalVideo, setShowLocalVideo] = useState(true);

  /**
   * 포커스된 참가자 ID
   * null: 기본 상태 (첫 번째 원격 참가자 자동 포커스)
   * userId: 해당 참가자가 메인에 표시됨
   */
  const [focusedParticipantId, setFocusedParticipantId] = useState<string | null>(null);

  if (!localParticipant) return null;

  /**
   * 원격 유저 존재 여부
   */
  const hasRemoteParticipant = remoteParticipants.length > 0;

  /**
   * 메인에 표시할 참가자 결정
   */
  const getMainParticipant = (): Participant | null => {
    if (!hasRemoteParticipant) {
      // 원격 유저 없음: 대기 화면 표시
      return null;
    }

    if (viewMode === 'viewer' && viewerModeParticipantId) {
      // 뷰어 모드: 선택된 참가자 우선
      const viewerParticipant = participants.find(p => p.userId === viewerModeParticipantId);
      return viewerParticipant || remoteParticipants[0]; // 선택된 참가자가 없으면 첫 번째 원격
    }

    if (focusedParticipantId) {
      // 특정 참가자가 포커스됨
      const focused = participants.find(p => p.userId === focusedParticipantId);
      return focused || remoteParticipants[0]; // 포커스된 참가자가 없으면 첫 번째 원격
    }

    // 기본: 첫 번째 원격 참가자
    return remoteParticipants[0];
  };

  /**
   * PIP에 표시할 참가자들
   */
  const getPIPParticipants = (): Participant[] => {
    if (!hasRemoteParticipant) {
      // 원격 유저 없음: 로컬만 표시하되 포커스 불가
      return [localParticipant];
    }

    const mainParticipant = getMainParticipant();

    // 메인에 표시되지 않는 모든 참가자를 PIP에 표시
    return participants.filter(p => p.userId !== mainParticipant?.userId);
  };

  /**
   * 참가자 포커스 핸들러
   */
  const handleFocusParticipant = (userId: string) => {
    if (viewMode === 'viewer') {
      // 뷰어 모드에서는 viewerModeParticipantId를 업데이트
      setViewerModeParticipant(userId);
    } else {
      // 다른 모드에서는 기존 focusedParticipantId를 사용
      setFocusedParticipantId(userId);
    }
  };

  const mainParticipant = getMainParticipant();
  const pipParticipants = getPIPParticipants();

  // 모바일 그리드 뷰
  if (isMobileView && viewMode === 'grid') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 relative">
          {hasRemoteParticipant ? (
            <RemoteVideoTile
              participant={remoteParticipants[0]}
              showAudioVisualizer={false}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-muted/50 rounded-lg">
              <p className="text-muted-foreground">Waiting for participant...</p>
            </div>
          )}
        </div>
        <div className="flex-1 relative">
          <LocalVideoTile
            participant={localParticipant}
            isMobile={true}
          />
        </div>
      </div>
    );
  }

  // 스피커 뷰 (모바일/데스크톱 공통)
  if (viewMode === 'speaker') {
    return (
      <div className="relative h-full">
        {/* 메인 비디오 */}
        {mainParticipant ? (
          <div className="absolute inset-0">
            {mainParticipant.isLocal ? (
              <LocalVideoTile
                participant={mainParticipant}
                isMobile={isMobileView}
              />
            ) : (
              <RemoteVideoTile
                participant={mainParticipant}
                showAudioVisualizer={false}
              />
            )}
          </div>
        ) : (
          <div className="absolute inset-4 flex flex-col items-center justify-center bg-muted/50 rounded-lg gap-4">
            <Loader2 className="w-12 h-12 text-muted-foreground animate-spin" />
            <p className="text-muted-foreground text-lg">Waiting for another participant to join...</p>
            <p className="text-muted-foreground/70 text-sm">Your video will appear in the corner once someone joins</p>
          </div>
        )}
  
        {/* PIP 비디오들 */}
        {showLocalVideo && pipParticipants.map((participant, index) => (
          <DraggableVideo
            key={participant.userId}
            stream={participant.stream}
            nickname={participant.nickname}
            isVideoEnabled={participant.videoEnabled}
            isLocalVideo={participant.isLocal}
            onHide={() => setShowLocalVideo(false)}
            onFocus={() => handleFocusParticipant(participant.userId)}
            canFocus={hasRemoteParticipant} // 원격 유저가 있을 때만 포커스 가능
            isFocused={focusedParticipantId === participant.userId}
          />
        ))}
  
        {/* PIP 숨김 시 복원 버튼 */}
        {!showLocalVideo && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowLocalVideo(true)}
            className="fixed bottom-20 right-4 z-40 shadow-lg"
          >
            <Eye className="w-4 h-4 mr-2" />
            Show videos
          </Button>
        )}
  
        {/* 원격 유저 없을 때 안내 */}
        {/* {!hasRemoteParticipant && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-500/90 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg z-30">
            💡 PIP will be interactive once someone joins
          </div>
        )} */}
      </div>
    );
  }
  
  // 뷰어 모드 (모바일/데스크톱 공통)
  if (viewMode === 'viewer') {
    return (
      <div className="relative h-full">
        {/* 메인 비디오 */}
        {mainParticipant ? (
          <div className="absolute inset-0">
            {mainParticipant.isLocal ? (
              <LocalVideoTile
                participant={mainParticipant}
                isMobile={isMobileView}
              />
            ) : (
              <RemoteVideoTile
                participant={mainParticipant}
                showAudioVisualizer={false}
              />
            )}
          </div>
        ) : (
          <div className="absolute inset-4 flex flex-col items-center justify-center bg-muted/50 rounded-lg gap-4">
            <Loader2 className="w-12 h-12 text-muted-foreground animate-spin" />
            <p className="text-muted-foreground text-lg">Waiting for another participant to join...</p>
            <p className="text-muted-foreground/70 text-sm">Your video will appear in the corner once someone joins</p>
          </div>
        )}
  
        {/* PIP 비디오들 */}
        {showLocalVideo && pipParticipants.map((participant, index) => (
          <DraggableVideo
            key={participant.userId}
            stream={participant.stream}
            nickname={participant.nickname}
            isVideoEnabled={participant.videoEnabled}
            isLocalVideo={participant.isLocal}
            onHide={() => setShowLocalVideo(false)}
            onFocus={() => handleFocusParticipant(participant.userId)}
            canFocus={hasRemoteParticipant} // 원격 유저가 있을 때만 포커스 가능
            isFocused={viewerModeParticipantId === participant.userId}
          />
        ))}
  
        {/* PIP 숨김 시 복원 버튼 */}
        {!showLocalVideo && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowLocalVideo(true)}
            className="fixed bottom-20 right-4 z-40 shadow-lg"
          >
            <Eye className="w-4 h-4 mr-2" />
            Show videos
          </Button>
        )}
      </div>
    );
  }

  // 데스크톱 그리드 뷰
  const gridClass = participants.length <= 2 ? 'grid-cols-2' :
                   participants.length <= 4 ? 'grid-cols-2' :
                   participants.length <= 6 ? 'grid-cols-3' : 'grid-cols-4';

  return (
    <div className={`grid ${gridClass} gap-4 w-full h-full p-4`}>
      {participants.map(participant => (
        <div key={participant.userId} className="w-full h-full relative">
          {participant.isLocal ? (
            <LocalVideoTile participant={participant} isMobile={false} />
          ) : (
            <RemoteVideoTile
              participant={participant}
              showAudioVisualizer={false}
            />
          )}
        </div>
      ))}
    </div>
  );
};
