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
  
  // 세로 모드: 상단에 리모트 유저, 하단에 로컬 유저로 배치
 if (orientation === 'portrait') {
   return (
     <div
       className="flex flex-col h-full w-full overflow-hidden"
       style={{ padding: layout.containerPadding }}
     >
       {/* 원격 참가자 메인 비디오 영역 (60% 높이) */}
       <div
         className="flex-shrink-0 w-full rounded-lg overflow-hidden shadow-lg"
         style={{
           height: '60%',
           marginBottom: layout.videoGap,
           borderRadius: layout.borderRadius
         }}
       >
         {remoteParticipants.length > 0 ? (
           <VideoPreview
             stream={remoteParticipants[0].stream}
             isVideoEnabled={remoteParticipants[0].videoEnabled}
             nickname={remoteParticipants[0].nickname}
             isLocalVideo={false}
             userId={remoteParticipants[0].userId}
           />
         ) : (
           <div className="w-full h-full bg-muted flex items-center justify-center">
             <p className="text-muted-foreground">Waiting for remote participant...</p>
           </div>
         )}
       </div>
       
       {/* 로컬 참가자 영역 (40% 높이) */}
       <div
         className="flex-1 rounded-lg overflow-hidden shadow-lg"
         style={{
           borderRadius: layout.borderRadius
         }}
       >
         {localParticipant ? (
           <VideoPreview
             stream={localParticipant.stream}
             isVideoEnabled={localParticipant.videoEnabled}
             nickname={localParticipant.nickname}
             isLocalVideo={true}
             userId={localParticipant.userId}
           />
         ) : (
           <div className="w-full h-full bg-muted flex items-center justify-center">
             <p className="text-muted-foreground">Local video not available</p>
           </div>
         )}
       </div>
     </div>
   );
 }
  
  // 가로 모드: 왼쪽에 리모트 유저, 오른쪽에 로컬 유저로 배치
  return (
    <div
      className="flex h-full w-full overflow-hidden"
      style={{ padding: layout.containerPadding, gap: layout.videoGap }}
    >
      {/* 원격 참가자 메인 비디오 (70% 너비) */}
      <div
        className="flex-shrink-0 h-full rounded-lg overflow-hidden shadow-lg"
        style={{
          width: layout.maxVideoWidth || '70%',
          borderRadius: layout.borderRadius
        }}
      >
        {remoteParticipants.length > 0 ? (
          <VideoPreview
            stream={remoteParticipants[0].stream}
            isVideoEnabled={remoteParticipants[0].videoEnabled}
            nickname={remoteParticipants[0].nickname}
            isLocalVideo={false}
            userId={remoteParticipants[0].userId}
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <p className="text-muted-foreground">Waiting for remote participant...</p>
          </div>
        )}
      </div>
      
      {/* 로컬 참가자 (30% 너비) */}
      <div
        className="flex-1 h-full rounded-lg overflow-hidden shadow-lg"
        style={{
          borderRadius: layout.borderRadius
        }}
      >
        {localParticipant ? (
          <VideoPreview
            stream={localParticipant.stream}
            isVideoEnabled={localParticipant.videoEnabled}
            nickname={localParticipant.nickname}
            isLocalVideo={true}
            userId={localParticipant.userId}
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <p className="text-muted-foreground">Local video not available</p>
          </div>
        )}
      </div>
    </div>
  );
});

MobileVideoLayout.displayName = 'MobileVideoLayout';
