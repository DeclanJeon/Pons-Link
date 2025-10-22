// components/media/ContentLayout.tsx
import { useIsMobile } from '@/hooks/use-mobile';
import { Participant, useParticipants } from '@/hooks/useParticipants';
import { useScreenOrientation } from '@/hooks/useScreenOrientation';
import { cn } from '@/lib/utils';
import { useSessionStore } from '@/stores/useSessionStore';
import { useUIManagementStore } from '@/stores/useUIManagementStore';
import { ScreenShare } from 'lucide-react';
import { useMemo } from 'react';
import { VideoLayout } from './VideoLayout';
import { VideoPreview } from './VideoPreview';

/**
 * Main Content Viewer Component
 *
 * Displays the primary content (screen share or file stream) in full view
 */
const MainContentViewer = ({ participant }: { participant: Participant }) => {
    return (
        <div className="w-full h-full bg-black flex items-center justify-center">
            <VideoPreview
                stream={participant.stream}
                isVideoEnabled={true}
                nickname={participant.nickname}
                isLocalVideo={participant.isLocal}
                showSubtitles={true}
                isScreenShare={participant.isSharingScreen}
                isFileStreaming={participant.isStreamingFile}
            />
        </div>
    );
};

/**
 * Participant Gallery Component
 *
 * Displays a horizontal scrollable gallery of participant thumbnails
 * with responsive sizing based on device type
 */
const ParticipantGallery = ({
    participants,
    mainParticipantId
}: {
    participants: Participant[],
    mainParticipantId: string | null
}) => {
    const { isPortrait } = useScreenOrientation(); // 추가
    const isMobile = useIsMobile();

    // 세로 모드에서는 더 작은 갤러리
    const galleryHeight = isPortrait
        ? 'h-[12vh] min-h-[70px] max-h-[100px]'
        : 'h-[20vh] min-h-[120px] max-h-[180px]';

    if (participants.length === 0) return null;


    return (
        <div className={cn(
            "bg-background/80 backdrop-blur-sm flex items-center overflow-x-auto overflow-y-hidden",
            "scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent",
            galleryHeight,
            isPortrait ? "p-1.5" : "p-2 sm:p-3" // 세로 모드에서 패딩 축소
        )}>
            <div className={cn(
                "flex items-center h-full",
                isPortrait ? "space-x-1.5" : "space-x-2 sm:space-x-3"
            )}>
                {participants.map(p => (
                    <div
                        key={p.userId}
                        className={cn(
                            "h-full flex-shrink-0 rounded-md overflow-hidden relative group transition-all duration-200",
                            "aspect-video", // 항상 16:9 비율 유지
                            p.userId === mainParticipantId && "ring-2 ring-blue-500 ring-offset-2 ring-offset-background shadow-lg scale-105"
                        )}
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
                        {p.userId === mainParticipantId && (
                            <div className="absolute top-1 left-1 bg-blue-500/90 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 opacity-100 transition-opacity shadow-md">
                                <ScreenShare size={10} />
                                <span className="hidden sm:inline text-[10px]">Sharing</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

/**
 * Content Layout Component
 *
 * Main layout component that switches between:
 * - Content sharing mode: Main content + participant gallery
 * - Normal mode: Standard video layout
 *
 * Automatically detects screen sharing or file streaming and adjusts layout
 */
export const ContentLayout = () => {
    const { mainContentParticipantId } = useUIManagementStore();
    const participants = useParticipants();
    const localUserId = useSessionStore(state => state.userId);

    const mainParticipant = participants.find(p => p.userId === mainContentParticipantId);

    /**
     * Calculates which participants should appear in the gallery
     * Ensures local user is visible when not the main presenter
     */
    const galleryParticipants = useMemo(() => {
        if (!mainParticipant) {
            return participants;
        }

        const otherParticipants = participants.filter(p => p.userId !== mainParticipant.userId);

        // 로컬 유저가 메인이면 갤러리에서 제외
        if (mainParticipant.isLocal) {
            return otherParticipants;
        }

        // 로컬 유저가 갤러리에 있는지 확인
        const isLocalInGallery = otherParticipants.some(p => p.isLocal);
        if (!isLocalInGallery) {
            const localUser = participants.find(p => p.isLocal);
            if (localUser) {
                return [localUser, ...otherParticipants];
            }
        }
        return otherParticipants;

    }, [participants, mainParticipant]);

    // 메인 컨텐츠가 있는 경우: 컨텐츠 + 갤러리 레이아웃
    if (mainParticipant) {
        return (
            <div className="w-full h-full flex flex-col">
                <div className="flex-1 relative overflow-hidden min-h-0">
                    <MainContentViewer participant={mainParticipant} />
                </div>
                <ParticipantGallery
                    participants={galleryParticipants}
                    mainParticipantId={mainParticipant.userId}
                />
            </div>
        );
    }

    // 기본 비디오 레이아웃
    return <VideoLayout />;
};
