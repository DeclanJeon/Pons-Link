// src/components/media/MobileVideoLayout.tsx

import { memo, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAdaptiveLayout } from '@/hooks/useAdaptiveLayout';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useTranscriptionStore } from '@/stores/useTranscriptionStore';
import { useUIManagementStore } from '@/stores/useUIManagementStore';
import { VideoPreview } from './VideoPreview';
import { SubtitleOverlay } from './SubtitleOverlay';
import type { Participant } from '@/hooks/useParticipants';

interface MobileVideoLayoutProps {
  participants: Participant[];
  localUserId: string;
}

export const MobileVideoLayout = memo(({ participants, localUserId }: MobileVideoLayoutProps) => {
  const { orientation } = useDeviceType();
  const layout = useAdaptiveLayout();
  const { translationTargetLanguage } = useTranscriptionStore();
  const { mobileDockPosition, mobileDockSize } = useUIManagementStore();
  const [activeRemoteId, setActiveRemoteId] = useState<string | null>(null);
  
  const { localParticipant, remoteParticipants } = useMemo(() => {
    const local = participants.find(p => p.userId === localUserId);
    const remote = participants.filter(p => p.userId !== localUserId);
    return { localParticipant: local, remoteParticipants: remote };
  }, [participants, localUserId]);
  
  const mainRemote = remoteParticipants.find(p => p.userId === activeRemoteId) 
    || remoteParticipants[0] 
    || null;
  const otherRemotes = remoteParticipants.filter(p => p.userId !== mainRemote?.userId);
  const showStrip = otherRemotes.length > 0;
  const dockOffset = mobileDockSize === 'lg' ? '5rem' : mobileDockSize === 'md' ? '4rem' : '3.5rem';
  const mobileDockPaddingBottom = mobileDockPosition === 'bottom'
    ? `calc(${dockOffset} + env(safe-area-inset-bottom))`
    : undefined;
  const mobileDockPaddingLeft = mobileDockPosition === 'left'
    ? `calc(${dockOffset} + env(safe-area-inset-left))`
    : undefined;
  const mobileDockPaddingRight = mobileDockPosition === 'right'
    ? `calc(${dockOffset} + env(safe-area-inset-right))`
    : undefined;
  const mobileLayoutPadding = {
    padding: layout.containerPadding,
    ...(mobileDockPaddingBottom ? { paddingBottom: mobileDockPaddingBottom } : {}),
    ...(mobileDockPaddingLeft ? { paddingLeft: mobileDockPaddingLeft } : {}),
    ...(mobileDockPaddingRight ? { paddingRight: mobileDockPaddingRight } : {}),
    gap: layout.videoGap,
  };

  const renderParticipantVideo = (participant: Participant, isLocalVideo: boolean) => (
    <>
      <VideoPreview
        stream={participant.stream}
        isVideoEnabled={participant.videoEnabled}
        nickname={participant.nickname}
        isLocalVideo={isLocalVideo}
        userId={participant.userId}
      />
      {participant.transcript?.text && (
        <SubtitleOverlay transcript={participant.transcript} targetLang={translationTargetLanguage} />
      )}
    </>
  );
  
  // 세로 모드
  if (orientation === 'portrait') {
    return (
      <div
        className="flex flex-col h-full w-full overflow-hidden"
        style={mobileLayoutPadding}
      >
        {/* 메인 원격 참가자 영역 */}
        <div
          className="relative flex-shrink-0 w-full rounded-lg overflow-hidden shadow-lg"
          style={{ height: showStrip ? '55%' : '60%', borderRadius: layout.borderRadius }}
        >
          {mainRemote ? (
            renderParticipantVideo(mainRemote, false)
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#0b0b10]">
              <p className="text-zinc-400">아직 연결된 참여자가 없습니다</p>
            </div>
          )}
        </div>
        
        {/* 추가 참가자 스트립 */}
        {showStrip && (
          <div
            data-testid="participant-strip"
            className="flex-shrink-0 w-full flex gap-2 overflow-x-auto"
            style={{ height: '15%' }}
          >
            {otherRemotes.map(p => (
              <button
                key={p.userId}
                data-testid={`thumb-${p.userId}`}
                aria-label={`${p.nickname} 메인 화면으로 전환`}
                onClick={() => setActiveRemoteId(p.userId)}
                className={cn(
                  "flex-shrink-0 h-full aspect-video overflow-hidden rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050507]",
                  activeRemoteId === p.userId ? "ring-2 ring-indigo-400/70" : "opacity-80 hover:opacity-100"
                )}
              >
                <VideoPreview
                  stream={p.stream}
                  isVideoEnabled={p.videoEnabled}
                  nickname={p.nickname}
                  isLocalVideo={false}
                  userId={p.userId}
                />
              </button>
            ))}
          </div>
        )}
        
        {/* 로컬 참가자 영역 */}
        <div
          className="relative flex-1 rounded-lg overflow-hidden shadow-lg"
          style={{ borderRadius: layout.borderRadius }}
        >
          {localParticipant ? (
            renderParticipantVideo(localParticipant, true)
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#0b0b10]">
              <p className="text-zinc-400">내 비디오를 사용할 수 없습니다</p>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // 가로 모드
  return (
    <div
      className="flex h-full w-full overflow-hidden"
      style={mobileLayoutPadding}
    >
      {/* 메인 원격 참가자 */}
      <div
        className="relative flex-shrink-0 h-full rounded-lg overflow-hidden shadow-lg"
        style={{ width: layout.maxVideoWidth || '65%', borderRadius: layout.borderRadius }}
      >
        {mainRemote ? (
          renderParticipantVideo(mainRemote, false)
        ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#0b0b10]">
              <p className="text-zinc-400">아직 연결된 참여자가 없습니다</p>
          </div>
        )}
      </div>
      
      {/* 오른쪽 열: 스트립 + 로컬 */}
      <div className="flex-1 flex flex-col h-full" style={{ gap: layout.videoGap }}>
        {showStrip && (
          <div
            data-testid="participant-strip"
            className="flex-shrink-0 w-full flex gap-2 overflow-x-auto"
            style={{ height: '25%' }}
          >
            {otherRemotes.map(p => (
              <button
                key={p.userId}
                data-testid={`thumb-${p.userId}`}
                aria-label={`${p.nickname} 메인 화면으로 전환`}
                onClick={() => setActiveRemoteId(p.userId)}
                className={cn(
                  "flex-shrink-0 h-full aspect-video overflow-hidden rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050507]",
                  activeRemoteId === p.userId ? "ring-2 ring-indigo-400/70" : "opacity-80 hover:opacity-100"
                )}
              >
                <VideoPreview
                  stream={p.stream}
                  isVideoEnabled={p.videoEnabled}
                  nickname={p.nickname}
                  isLocalVideo={false}
                  userId={p.userId}
                />
              </button>
            ))}
          </div>
        )}
        
        <div
          className="relative flex-1 rounded-lg overflow-hidden shadow-lg"
          style={{ borderRadius: layout.borderRadius }}
        >
          {localParticipant ? (
            renderParticipantVideo(localParticipant, true)
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#0b0b10]">
              <p className="text-zinc-400">내 비디오를 사용할 수 없습니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

MobileVideoLayout.displayName = 'MobileVideoLayout';
