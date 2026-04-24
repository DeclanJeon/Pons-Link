// src/components/media/MobileVideoLayout.tsx

import { memo, useMemo, useState } from 'react';
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
  const { orientation } = useDeviceType();
  const layout = useAdaptiveLayout();
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
  
  // 세로 모드
  if (orientation === 'portrait') {
    return (
      <div
        className="flex flex-col h-full w-full overflow-hidden"
        style={{ padding: layout.containerPadding, gap: layout.videoGap }}
      >
        {/* 메인 원격 참가자 영역 */}
        <div
          className="flex-shrink-0 w-full rounded-lg overflow-hidden shadow-lg"
          style={{ height: showStrip ? '55%' : '60%', borderRadius: layout.borderRadius }}
        >
          {mainRemote ? (
            <VideoPreview
              stream={mainRemote.stream}
              isVideoEnabled={mainRemote.videoEnabled}
              nickname={mainRemote.nickname}
              isLocalVideo={false}
              userId={mainRemote.userId}
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <p className="text-muted-foreground">Waiting for remote participant...</p>
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
                onClick={() => setActiveRemoteId(p.userId)}
                className={cn(
                  "flex-shrink-0 h-full aspect-video rounded-lg overflow-hidden border-2 transition-colors",
                  activeRemoteId === p.userId ? "border-primary" : "border-transparent"
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
          className="flex-1 rounded-lg overflow-hidden shadow-lg"
          style={{ borderRadius: layout.borderRadius }}
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
  
  // 가로 모드
  return (
    <div
      className="flex h-full w-full overflow-hidden"
      style={{ padding: layout.containerPadding, gap: layout.videoGap }}
    >
      {/* 메인 원격 참가자 */}
      <div
        className="flex-shrink-0 h-full rounded-lg overflow-hidden shadow-lg"
        style={{ width: layout.maxVideoWidth || '65%', borderRadius: layout.borderRadius }}
      >
        {mainRemote ? (
          <VideoPreview
            stream={mainRemote.stream}
            isVideoEnabled={mainRemote.videoEnabled}
            nickname={mainRemote.nickname}
            isLocalVideo={false}
            userId={mainRemote.userId}
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <p className="text-muted-foreground">Waiting for remote participant...</p>
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
                onClick={() => setActiveRemoteId(p.userId)}
                className={cn(
                  "flex-shrink-0 h-full aspect-video rounded-lg overflow-hidden border-2 transition-colors",
                  activeRemoteId === p.userId ? "border-primary" : "border-transparent"
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
          className="flex-1 rounded-lg overflow-hidden shadow-lg"
          style={{ borderRadius: layout.borderRadius }}
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
    </div>
  );
});

MobileVideoLayout.displayName = 'MobileVideoLayout';
