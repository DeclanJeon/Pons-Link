// src/components/media/MobileVideoLayout.tsx

import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useAdaptiveLayout } from '@/hooks/useAdaptiveLayout';
import { useDeviceType } from '@/hooks/useDeviceType';
import { VideoPreview } from './VideoPreview';
import type { Participant } from '@/hooks/useParticipants';

interface MobileVideoLayoutProps {
  participants: Participant[];
  localUserId: string;
}

export const MobileVideoLayout = memo(({ participants, localUserId }: MobileVideoLayoutProps) => {
  const { orientation, width } = useDeviceType();
  const layout = useAdaptiveLayout();
  
  // 로컬 유저를 맨 위로, 나머지는 스크롤 가능한 영역에
  const { localParticipant, remoteParticipants } = useMemo(() => {
    const local = participants.find(p => p.userId === localUserId);
    const remote = participants.filter(p => p.userId !== localUserId);
    return { localParticipant: local, remoteParticipants: remote };
  }, [participants, localUserId]);
  
  // 세로 모드: 상단에 큰 비디오, 하단에 작은 비디오들
 if (orientation === 'portrait') {
    return (
      <div
        className="flex flex-col h-full w-full overflow-hidden"
        style={{ padding: layout.containerPadding }}
      >
        {/* 메인 비디오 영역 (60% 높이) */}
        <div
          className="flex-shrink-0 w-full rounded-lg overflow-hidden shadow-lg"
          style={{
            height: '60%',
            marginBottom: layout.videoGap,
            borderRadius: layout.borderRadius
          }}
        >
          {localParticipant && (
            <VideoPreview
              stream={localParticipant.stream}
              isVideoEnabled={localParticipant.videoEnabled}
              nickname={localParticipant.nickname}
              isLocalVideo={true}
              userId={localParticipant.userId}
            />
          )}
        </div>
        
        {/* 원격 참가자 그리드 (40% 높이, 스크롤 가능) */}
        <div
          className="flex-1 overflow-y-auto scrollbar-hide"
          style={{ gap: layout.videoGap }}
        >
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: remoteParticipants.length === 1
                ? '1fr'
                : 'repeat(2, 1fr)',
              gap: layout.videoGap
            }}
          >
            {remoteParticipants.map(participant => (
              <div
                key={participant.userId}
                className="aspect-video rounded-lg overflow-hidden shadow-md"
                style={{
                  minHeight: '120px',
                  borderRadius: layout.borderRadius
                }}
              >
                <VideoPreview
                  stream={participant.stream}
                  isVideoEnabled={participant.videoEnabled}
                  nickname={participant.nickname}
                  isLocalVideo={false}
                  userId={participant.userId}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  // 가로 모드: 왼쪽에 메인 비디오, 오른쪽에 세로 스크롤
  return (
    <div
      className="flex h-full w-full overflow-hidden"
      style={{ padding: layout.containerPadding, gap: layout.videoGap }}
    >
      {/* 메인 비디오 (70% 너비) */}
      <div
        className="flex-shrink-0 h-full rounded-lg overflow-hidden shadow-lg"
        style={{
          width: layout.maxVideoWidth || '70%',
          borderRadius: layout.borderRadius
        }}
      >
        {localParticipant && (
          <VideoPreview
            stream={localParticipant.stream}
            isVideoEnabled={localParticipant.videoEnabled}
            nickname={localParticipant.nickname}
            isLocalVideo={true}
            userId={localParticipant.userId}
          />
        )}
      </div>
      
      {/* 원격 참가자 리스트 (30% 너비) */}
      <div
        className="flex-1 h-full overflow-y-auto scrollbar-hide"
        style={{ gap: layout.videoGap }}
      >
        <div
          className="flex flex-col"
          style={{ gap: layout.videoGap }}
        >
          {remoteParticipants.map(participant => (
            <div
              key={participant.userId}
              className="w-full aspect-video rounded-lg overflow-hidden shadow-md flex-shrink-0"
              style={{
                minHeight: '100px',
                borderRadius: layout.borderRadius
              }}
            >
              <VideoPreview
                stream={participant.stream}
                isVideoEnabled={participant.videoEnabled}
                nickname={participant.nickname}
                isLocalVideo={false}
                userId={participant.userId}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

MobileVideoLayout.displayName = 'MobileVideoLayout';
