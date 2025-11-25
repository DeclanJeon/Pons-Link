import { Participant } from '@/hooks/useParticipants';
import { cn } from '@/lib/utils';
import { useCallback, useRef, useState } from 'react';
import { VideoPreview } from './VideoPreview';

/**
 * 상단 고정형 모바일 스피커 스트립
 * - 가로 스크롤(스와이프)로 참가자 이동
 * - 탭하면 메인 비디오와 교체
 * - 위로 스와이프하면 스트립 숨김(onHide)
 */
interface MobileSpeakerStripProps {
  participants: Participant[];
  mainParticipantId: string | null;
  onSelect: (userId: string) => void;
  onHide: () => void;
  hidden?: boolean;
}

export const MobileSpeakerStrip = ({
  participants,
  mainParticipantId,
  onSelect,
  onHide,
  hidden = false,
}: MobileSpeakerStripProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [isHiding, setIsHiding] = useState(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
    setIsHiding(false);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!startRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - startRef.current.x;
    const dy = t.clientY - startRef.current.y;

    // 위로 스와이프: 수직이 수평보다 크고, 위로 -40px 이상
    if (Math.abs(dy) > Math.abs(dx) && dy < -40) {
      setIsHiding(true);
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (isHiding) {
      onHide();
    }
    startRef.current = null;
    setIsHiding(false);
  }, [isHiding, onHide]);

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-[55] transition-transform duration-200',
        hidden ? '-translate-y-full pointer-events-none' : 'translate-y-0'
      )}
      aria-hidden={hidden}
    >
      {/* 배경/블러 바 (safe-area 대응) */}
      <div className="bg-background/90 backdrop-blur-md border-b border-border/40 pt-safe">
        {/* 작은 그립(숨김 제스처 힌트) */}
        <div className="flex items-center justify-center py-1">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/40" />
        </div>

        <div
          ref={containerRef}
          className={cn(
            'overflow-x-auto scrollbar-hide',
            'px-2 pb-2'
          )}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div
            className={cn(
              'flex gap-2',
              'snap-x snap-mandatory'
            )}
          >
            {participants.map((p) => {
              const isMain = p.userId === mainParticipantId;
              return (
                <button
                  key={p.userId}
                  onClick={() => onSelect(p.userId)}
                  className={cn(
                    'relative flex-shrink-0 snap-start',
                    // 카드 사이즈: 모바일 상단 스트립용 16:9
                    'w-[42vw] max-w-[240px] aspect-video rounded-md overflow-hidden border border-border/40 bg-muted',
                    'active:scale-[0.98] transition-transform'
                  )}
                  aria-pressed={isMain}
                  aria-label={`Switch to ${p.nickname}`}
                >
                  <VideoPreview
                    stream={p.stream}
                    nickname={p.nickname}
                    isVideoEnabled={p.videoEnabled}
                    isLocalVideo={p.isLocal}
                    showSubtitles={false}
                    isScreenShare={p.isSharingScreen}
                    isFileStreaming={p.isStreamingFile}
                    userId={p.userId}
                  />

                  {/* 메인 표시 배지 */}
                  {isMain && (
                    <div className="absolute top-1 left-1 bg-blue-600/90 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow">
                      Main
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileSpeakerStrip;
