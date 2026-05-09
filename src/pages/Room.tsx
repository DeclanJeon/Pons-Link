import { ContentLayout } from '@/components/media/ContentLayout';
import DraggableControlBar from '@/components/navigator/DraggableControlBar';
import { GlobalConnectionStatus } from '@/components/setting/GlobalConnectionStatus';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDeviceType, getResponsiveClasses } from '@/hooks/useDeviceType';
import { useAutoHideControls } from '@/hooks/useAutoHideControls';
import { useRoomOrchestrator } from '@/hooks/useRoomOrchestrator';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTurnCredentials } from '@/hooks/useTurnCredentials';
import { analytics } from '@/lib/analytics';
import { createMeetingMinutesCaptionId } from '@/lib/meetingMinutes';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/stores/useChatStore';
import { useMediaDeviceStore } from '@/stores/useMediaDeviceStore';
import { useParticipantProfileStore } from '@/stores/useParticipantProfileStore';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useRoomUpgradeStore } from '@/stores/useRoomUpgradeStore';
import { useTranscriptionStore } from '@/stores/useTranscriptionStore';
import { useUIManagementStore } from '@/stores/useUIManagementStore';
import { useDeviceMetadataStore } from '@/stores/useDeviceMetadataStore';
import { getConfiguredPersonalLinkApiUrl } from '@/features/personal-link/usePersonalLinkRepository';
import type { RoomType } from '@/types/room.types';
import { DEFAULT_ROOM_TYPE, getDefaultViewMode, isValidRoomType } from '@/types/roomCapabilities';
import { generateRandomNickname } from '@/utils/nickname';
import { sessionManager } from '@/utils/session.utils';
import { getRandomAvatarPreset, getStoredAvatarPreset } from '@/lib/avatar/dicebear';
import { nanoid } from 'nanoid';
import { memo, Suspense, lazy, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Shuffle } from 'lucide-react';

interface NicknamePromptProps {
  isVisible: boolean;
  nicknameInput: string;
  isJoining: boolean;
  onNicknameChange: (value: string) => void;
  onJoinClick: () => void;
  onRandomNickname: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  deviceInfo: ReturnType<typeof useDeviceType>;
  roomTitle?: string;
}

const ChatPanel = lazy(() =>
  import('@/components/functions/chat/ChatPanel').then((module) => ({ default: module.ChatPanel }))
);
const WhiteboardPanel = lazy(() =>
  import('@/components/functions/whiteboard/WhiteboardPanel').then((module) => ({ default: module.WhiteboardPanel }))
);
const RelayControlPanel = lazy(() =>
  import('@/components/functions/relay/RelayControlPanel').then((module) => ({ default: module.RelayControlPanel }))
);
const CoWatchPanel = lazy(() =>
  import('@/components/functions/cowatch/CoWatchPanel').then((module) => ({ default: module.CoWatchPanel }))
);
const SettingsPanel = lazy(() =>
  import('@/components/setting/SettingsPanel').then((module) => ({ default: module.SettingsPanel }))
);
const FileStreamingPanel = lazy(() =>
  import('@/components/functions/fileStreaming/FileStreamingPanel').then((module) => ({ default: module.FileStreamingPanel }))
);

const NicknamePrompt = memo(({
  isVisible,
  nicknameInput,
  isJoining,
  onNicknameChange,
  onJoinClick,
  onRandomNickname,
  onKeyDown,
  inputRef,
  deviceInfo,
  roomTitle
}: NicknamePromptProps) => {
  const { t } = useTranslation();

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[#050507]/92 p-4 text-white backdrop-blur-xl">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nickname-dialog-title"
        aria-describedby="nickname-dialog-desc"
        className={`
        max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-[28px] border border-white/[0.08] bg-[#111116]/95 shadow-[0_30px_120px_-65px_rgba(0,0,0,0.95)]
        ${getResponsiveClasses(deviceInfo, {
          mobile: 'max-w-sm p-4',
          tablet: 'max-w-md p-5',
          desktop: 'max-w-lg p-6',
          largeDesktop: 'max-w-xl p-8'
        })}
      `}>
        {roomTitle && (
          <div className="mb-3 inline-flex rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-200">
            {roomTitle}
          </div>
        )}
        <h2 id="nickname-dialog-title" className={`
          font-semibold mb-2
          ${getResponsiveClasses(deviceInfo, {
            mobile: 'text-lg',
            tablet: 'text-xl',
            desktop: 'text-2xl',
            largeDesktop: 'text-3xl'
          })}
        `}>
          {t('room.nicknamePrompt.title')}
        </h2>
        <p id="nickname-dialog-desc" className={`
          mb-5 text-zinc-400
          ${getResponsiveClasses(deviceInfo, {
            mobile: 'text-xs',
            tablet: 'text-sm',
            desktop: 'text-base',
            largeDesktop: 'text-lg'
          })}
        `}>
          {t('room.nicknamePrompt.description')}
        </p>

        <div className={`
          space-y-4
          ${getResponsiveClasses(deviceInfo, {
            mobile: 'space-y-3',
            tablet: 'space-y-4',
            desktop: 'space-y-5',
            largeDesktop: 'space-y-6'
          })}
        `}>
          <div className={`
            flex flex-col gap-2 sm:flex-row
            ${getResponsiveClasses(deviceInfo, {
              mobile: 'gap-1',
              tablet: 'gap-2',
              desktop: 'gap-3',
              largeDesktop: 'gap-4'
            })}
          `}>
            <Input
              ref={inputRef}
              value={nicknameInput}
              onChange={(e) => onNicknameChange(e.target.value)}
              placeholder={t('room.nicknamePrompt.placeholder')}
              className="flex-1"
              autoFocus
              disabled={isJoining}
              onKeyDown={onKeyDown}
              maxLength={20}
            />
            <Button
              onClick={onJoinClick}
              disabled={isJoining}
              className={`
                w-full sm:w-auto
                ${getResponsiveClasses(deviceInfo, {
                  mobile: 'min-w-[60px] px-2 py-1 text-sm',
                  tablet: 'min-w-[80px] px-3 py-2 text-base',
                  desktop: 'min-w-[100px] px-4 py-3 text-lg',
                  largeDesktop: 'min-w-[120px] px-5 py-4 text-xl'
                })}
              `}
            >
              {isJoining ? (
                <>
                  <Loader2 className={`
                    mr-2 animate-spin
                    ${getResponsiveClasses(deviceInfo, {
                      mobile: 'w-3 h-3',
                      tablet: 'w-4 h-4',
                      desktop: 'w-5 h-5',
                      largeDesktop: 'w-6 h-6'
                    })}
                  `} />
                  {getResponsiveClasses(deviceInfo, {
                    mobile: t('room.nicknamePrompt.joiningShort'),
                    tablet: t('room.nicknamePrompt.joining'),
                    desktop: t('room.nicknamePrompt.joining'),
                    largeDesktop: t('room.nicknamePrompt.joining')
                  })}
                </>
              ) : (
                getResponsiveClasses(deviceInfo, {
                    mobile: t('room.nicknamePrompt.join'),
                    tablet: t('room.nicknamePrompt.join'),
                    desktop: t('room.nicknamePrompt.enterLounge'),
                    largeDesktop: t('room.nicknamePrompt.enterLounge')
                })
              )}
            </Button>
          </div>

          <div className={`
            flex flex-wrap items-center justify-between gap-2 pt-2
            ${getResponsiveClasses(deviceInfo, {
              mobile: 'pt-1',
              tablet: 'pt-2',
              desktop: 'pt-3',
              largeDesktop: 'pt-4'
            })}
          `}>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRandomNickname}
              disabled={isJoining}
              aria-label={t('room.nicknamePrompt.randomAria')}
              className={`
                gap-2
                ${getResponsiveClasses(deviceInfo, {
                  mobile: 'px-2 py-1 text-xs',
                  tablet: 'px-3 py-2 text-sm',
                  desktop: 'px-4 py-3 text-base',
                  largeDesktop: 'px-5 py-4 text-lg'
                })}
              `}
            >
              <Shuffle className={`
                ${getResponsiveClasses(deviceInfo, {
                  mobile: 'w-3 h-3',
                  tablet: 'w-4 h-4',
                  desktop: 'w-5 h-5',
                  largeDesktop: 'w-6 h-6'
                })}
              `} />
              {isJoining ? (
                getResponsiveClasses(deviceInfo, {
                  mobile: t('room.nicknamePrompt.generating'),
                  tablet: t('room.nicknamePrompt.generating'),
                  desktop: t('room.nicknamePrompt.generating'),
                  largeDesktop: t('room.nicknamePrompt.generating')
                })
              ) : (
                getResponsiveClasses(deviceInfo, {
                  mobile: t('room.nicknamePrompt.random'),
                  tablet: t('room.nicknamePrompt.random'),
                  desktop: t('room.nicknamePrompt.randomNickname'),
                  largeDesktop: t('room.nicknamePrompt.randomNickname')
                })
              )}
            </Button>
            <div className={`
              text-zinc-400
              ${getResponsiveClasses(deviceInfo, {
                mobile: 'text-xs',
                tablet: 'text-xs',
                desktop: 'text-sm',
                largeDesktop: 'text-sm'
              })}
            `}>
              {t('room.nicknamePrompt.permissionNote')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

NicknamePrompt.displayName = 'NicknamePrompt';

type RoomProps = {
  roomTypeOverride?: RoomType;
};

type SessionAccessRoomTypeResponse = {
  roomType?: string;
};

const Room = ({ roomTypeOverride }: RoomProps = {}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { roomTitle } = useParams<{ roomTitle: string }>();
  const isMobile = useIsMobile();
  const deviceInfo = useDeviceType();

  const {
    isPanelOpen,
    closePanel,
    setViewMode
  } = useUIManagementStore();

  const {
    userId: sessionUserId,
    nickname: sessionNickname,
    clearSession,
    setSession
  } = useSessionStore();
  const { setLocalAvatar, setLocalUserId } = useParticipantProfileStore();
  const { activeRequest, approveUpgrade, rejectUpgrade, lastMigration, clearRequest } = useRoomUpgradeStore();

  const { localStream, initialize: initMedia, cleanup: cleanupMediaDevice } = useMediaDeviceStore();
  const { cleanup: cleanupPeerConnection } = usePeerConnectionStore();
  const addMeetingMinutesCaption = useChatStore(state => state.addMeetingMinutesCaption);

  const {
    isTranscriptionEnabled,
    transcriptionProvider,
    transcriptionLanguage,
    meetingMinutesEnabled,
    meetingMinutesConsent,
    meetingMinutesOwnerNickname,
    meetingMinutesStartedAt,
    acceptMeetingMinutesConsent,
    declineMeetingMinutesConsent,
    setLocalTranscript,
    setTranscriptionStatus,
    sendTranscription,
    toggleTranscription
  } = useTranscriptionStore();
  const hasMeetingMinutesConsent = meetingMinutesConsent === 'granted';
  const showMeetingMinutesConsentPrompt = meetingMinutesEnabled && meetingMinutesConsent === 'pending';
  const meetingMinutesStatusText = hasMeetingMinutesConsent
    ? t('room.minutes.saved')
    : meetingMinutesConsent === 'declined'
      ? t('room.minutes.excluded')
      : t('room.minutes.pending');

  const search = new URLSearchParams(location.search);
  const queryType = search.get('type');
  const queryRoomType = isValidRoomType(queryType) ? queryType : undefined;
  const joinToken = search.get('token');
  const shouldLookupJoinRoomType = !roomTypeOverride && !queryRoomType && !!joinToken && !!roomTitle && location.pathname.startsWith('/join/');
  const [lookedUpJoinRoomType, setLookedUpJoinRoomType] = useState<RoomType | undefined>();

  const effectiveRoomType = roomTypeOverride ?? queryRoomType ?? lookedUpJoinRoomType ?? (shouldLookupJoinRoomType ? undefined : DEFAULT_ROOM_TYPE);

  const storedNickname = sessionManager.getNickname() || '';
  const showUpgradeDialog = !!activeRequest && activeRequest.status === 'pending' && activeRequest.requesterId !== sessionUserId;

  const [nicknameInput, setNicknameInput] = useState<string>(storedNickname);
  const [shouldPromptNickname, setShouldPromptNickname] = useState<boolean>(!storedNickname && !sessionNickname);
  const [isJoining, setIsJoining] = useState(false);

  const isProcessingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const handledMigrationRequestsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!shouldLookupJoinRoomType || !roomTitle || !joinToken) {
      setLookedUpJoinRoomType(undefined);
      return;
    }

    const controller = new AbortController();
    const apiUrl = getConfiguredPersonalLinkApiUrl();
    const url = new URL(`/api/session-access/${encodeURIComponent(roomTitle)}`, apiUrl);
    url.searchParams.set('token', joinToken);

    fetch(url.toString(), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Join room type lookup failed with ${response.status}`);
        }
        return response.json() as Promise<SessionAccessRoomTypeResponse>;
      })
      .then((payload) => {
        setLookedUpJoinRoomType(isValidRoomType(payload.roomType) ? payload.roomType : undefined);
      })
      .catch((error) => {
        if ((error as { name?: string }).name !== 'AbortError') {
          console.warn('[Room] Could not resolve tokenized join room type; falling back to default room type.', error);
          setLookedUpJoinRoomType(DEFAULT_ROOM_TYPE);
        }
      });

    return () => controller.abort();
  }, [shouldLookupJoinRoomType, roomTitle, joinToken]);

  useEffect(() => {
    if (!effectiveRoomType) {
      return;
    }

    if (!localStream) {
      initMedia(effectiveRoomType).catch(() => {
        toast.error(t('room.toasts.mediaPermission'));
      });
    }
  }, [localStream, initMedia, effectiveRoomType, t]);

  useEffect(() => {
    if (!effectiveRoomType) return;
    setViewMode(getDefaultViewMode(effectiveRoomType));
  }, [effectiveRoomType, setViewMode]);

  useTurnCredentials();
  useAutoHideControls(isMobile ? 5000 : 3000);

  const { start, stop, isSupported } = useSpeechRecognition({
    provider: transcriptionProvider,
    lang: transcriptionLanguage,
    onResult: (text, isFinal) => {
      if (isTranscriptionEnabled) {
        setLocalTranscript({ text, isFinal });
        void sendTranscription(text, isFinal);
      }

      if (!isFinal) return;

      if (meetingMinutesEnabled && hasMeetingMinutesConsent && roomParams) {
        const capturedAt = Date.now();
        const captionPayload = {
          captionId: createMeetingMinutesCaptionId({
            roomId: roomParams.roomId,
            speakerId: roomParams.userId,
            text,
            capturedAt,
          }),
          speakerId: roomParams.userId,
          speakerNickname: roomParams.nickname,
          text,
          lang: transcriptionLanguage,
          provider: transcriptionProvider,
          capturedAt,
          meetingStartedAt: meetingMinutesStartedAt ?? undefined,
          version: 1 as const,
        };

        addMeetingMinutesCaption(captionPayload);
        usePeerConnectionStore.getState().sendToAllPeers(JSON.stringify({
          type: 'meeting-minutes-caption',
          payload: captionPayload,
        }));
      }
    },
    onStatusChange: setTranscriptionStatus,
    onError: (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        toast.error(t('room.toasts.micPermission'));
        toggleTranscription();
      }
    }
  });

  const shouldRunSpeechRecognition = isTranscriptionEnabled || (meetingMinutesEnabled && hasMeetingMinutesConsent);

  useEffect(() => {
    if (shouldRunSpeechRecognition && isSupported) {
      setTranscriptionStatus('starting');
      void start();
    } else {
      void stop();
    }
    return () => { void stop(); };
  }, [shouldRunSpeechRecognition, isSupported, setTranscriptionStatus, start, stop]);

  useEffect(() => {
    if (!roomTitle) {
      toast.error(t('room.toasts.roomMissing'));
      navigate('/');
    }
  }, [roomTitle, navigate, t]);

  useEffect(() => {
    if (!lastMigration || !sessionUserId) {
      return;
    }

    if (!lastMigration.participantIds.includes(sessionUserId)) {
      return;
    }

    if (handledMigrationRequestsRef.current.has(lastMigration.requestId)) {
      clearRequest();
      return;
    }

    handledMigrationRequestsRef.current.add(lastMigration.requestId);

    const currentRoomTitle = roomTitle ? decodeURIComponent(roomTitle) : '';
    if (currentRoomTitle === lastMigration.targetRoomTitle && effectiveRoomType === lastMigration.targetRoomType) {
      clearRequest();
      return;
    }

    clearRequest();
    navigate(
      `/room/${encodeURIComponent(lastMigration.targetRoomTitle)}?type=${lastMigration.targetRoomType}&migratedFrom=${encodeURIComponent(lastMigration.sourceRoomId)}`
    );
  }, [lastMigration, sessionUserId, roomTitle, effectiveRoomType, clearRequest, navigate]);

  const createSession = useCallback((nickname: string): boolean => {
    if (!roomTitle || !effectiveRoomType) {
      console.error('[Room] Cannot create session: room title or room type is missing');
      return false;
    }

    const uid = nanoid();
    console.log('[Room] Creating session:', { uid, nickname, roomTitle });

    try {
      setSession(uid, nickname, decodeURIComponent(roomTitle), effectiveRoomType);
      const storedAvatar = getStoredAvatarPreset();
      if (!storedAvatar) {
        setLocalAvatar(getRandomAvatarPreset(), uid);
      }
      setLocalUserId(uid);
      sessionManager.saveNickname(nickname);
      return true;
    } catch (error) {
      console.error('[Room] Error creating session:', error);
      return false;
    }
  }, [roomTitle, effectiveRoomType, setSession, setLocalAvatar, setLocalUserId]);

  const executeJoin = useCallback(async (nickname: string) => {
    if (isProcessingRef.current) {
      console.log('[Room] Already processing, ignoring');
      return;
    }

    isProcessingRef.current = true;
    setIsJoining(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalNickname = nickname.trim() || generateRandomNickname();
      console.log('[Room] Executing join with nickname:', finalNickname);

      const success = createSession(finalNickname);

      if (success) {
        setNicknameInput(finalNickname);
        setShouldPromptNickname(false);
        console.log('[Room] Session created successfully');
        toast.success(t('room.toasts.joinedAs', { nickname: finalNickname }));
      } else {
        console.error('[Room] Failed to create session');
        toast.error(t('room.toasts.joinFailed'));
        setIsJoining(false);
        isProcessingRef.current = false;
      }
    } catch (error) {
      console.error('[Room] Error during join:', error);
      toast.error(t('room.toasts.genericError'));
      setIsJoining(false);
      isProcessingRef.current = false;
    }
  }, [createSession, t]);

  const handleJoinClick = useCallback(async () => {
    if (isJoining) return;
    await executeJoin(nicknameInput);
  }, [nicknameInput, executeJoin, isJoining]);

  const handleRandomNickname = useCallback(async () => {
    if (isJoining) return;
    const randomName = generateRandomNickname();
    setNicknameInput(randomName);
    toast.info(t('room.toasts.randomNickname', { nickname: randomName }));
  }, [isJoining, t]);

  const handleKeyDown = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isJoining) {
      e.preventDefault();
      await executeJoin(nicknameInput);
    }
  }, [nicknameInput, executeJoin, isJoining]);

  const handleNicknameChange = useCallback((value: string) => {
    setNicknameInput(value);
  }, []);

  useEffect(() => {
    if (!localStream || !roomTitle || shouldPromptNickname) {
      return;
    }

    if (sessionUserId && sessionNickname) {
      console.log('[Room] Session already exists:', { sessionUserId, sessionNickname });
      setIsJoining(false);
      isProcessingRef.current = false;
      return;
    }

    if (storedNickname && !sessionUserId && !isProcessingRef.current) {
      console.log('[Room] Auto-creating session with stored nickname:', storedNickname);
      executeJoin(storedNickname);
    }
  }, [localStream, roomTitle, shouldPromptNickname, sessionUserId, sessionNickname, storedNickname, executeJoin]);

  const roomParams = useMemo(() => {
    if (!roomTitle || !localStream || !sessionUserId || !sessionNickname || !effectiveRoomType) {
      return null;
    }
    return {
      roomId: decodeURIComponent(roomTitle),
      userId: sessionUserId,
      nickname: sessionNickname,
      localStream,
      roomType: effectiveRoomType
    };
  }, [roomTitle, localStream, sessionUserId, sessionNickname, effectiveRoomType]);

  useEffect(() => {
    if (!roomParams) return;
    
    const joinTime = Date.now();
    analytics.roomJoin(roomParams.roomId);
    
    // Broadcast metadata after allowing peer connections enough time.
    const broadcastTimer = setTimeout(() => {
      const { peers } = usePeerConnectionStore.getState();
      const connectedPeers = Array.from(peers.values()).filter(p => p.connectionState === 'connected');
      
      if (connectedPeers.length > 0) {
        useDeviceMetadataStore.getState().broadcastMetadata();
      } else {
        // Retry when no peer is connected yet.
        const retryTimer = setTimeout(() => {
          useDeviceMetadataStore.getState().broadcastMetadata();
        }, 3000);
        return () => clearTimeout(retryTimer);
      }
    }, 3000); // Increased to 3 seconds.
    
    return () => {
      clearTimeout(broadcastTimer);
      analytics.roomLeave(roomParams.roomId, Math.round((Date.now() - joinTime) / 1000));
    };
  }, [roomParams]);

  useRoomOrchestrator(roomParams);

  useEffect(() => {
    return () => {
      clearSession();
      cleanupMediaDevice();
      cleanupPeerConnection();
    };
  }, [clearSession, cleanupMediaDevice, cleanupPeerConnection]);

  if (!roomTitle) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050507] text-zinc-300">
        <p>{t('room.loadingInfo')}</p>
      </div>
    );
  }

  return (
    <div className={cn('relative flex h-screen flex-col overflow-hidden bg-[#050507] text-white', 'h-[100dvh]')}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.14),transparent_34%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.06),transparent_28%)]" />
      <GlobalConnectionStatus />
      {meetingMinutesEnabled && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed left-1/2 top-3 z-40 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-rose-200/15 bg-[#130d10]/82 px-3 py-2 text-xs text-rose-50 shadow-[0_18px_60px_-34px_rgba(244,63,94,0.75)] backdrop-blur-xl"
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-300 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-300" />
          </span>
          <span className="font-semibold tracking-[-0.01em]">{t('room.minutes.recording')}</span>
          <span className="hidden text-rose-100/65 sm:inline">
            {meetingMinutesStatusText}
          </span>
          {meetingMinutesOwnerNickname && (
            <span className="hidden rounded-full border border-white/[0.08] bg-white/[0.06] px-2 py-0.5 text-rose-100/70 md:inline">
              {t('room.minutes.startedBy', { nickname: meetingMinutesOwnerNickname })}
            </span>
          )}
        </div>
      )}

      {showMeetingMinutesConsentPrompt && (
        <div className="fixed inset-x-4 top-16 z-50 mx-auto w-full max-w-md rounded-[24px] border border-rose-200/15 bg-[#140d10]/95 p-4 text-white shadow-[0_24px_80px_-42px_rgba(244,63,94,0.8)] backdrop-blur-xl">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold tracking-[-0.01em]">{t('room.minutes.consentTitle')}</p>
              <p className="text-sm text-rose-50/75">
                {t('room.minutes.consentDescription')}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" onClick={acceptMeetingMinutesConsent}>
                {t('room.minutes.allow')}
              </Button>
              <Button variant="outline" className="flex-1 border-white/[0.12] bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={declineMeetingMinutesConsent}>
                {t('room.minutes.decline')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <NicknamePrompt
        isVisible={shouldPromptNickname}
        nicknameInput={nicknameInput}
        isJoining={isJoining}
        onNicknameChange={handleNicknameChange}
        onJoinClick={handleJoinClick}
        onRandomNickname={handleRandomNickname}
        onKeyDown={handleKeyDown}
        inputRef={inputRef}
        deviceInfo={deviceInfo}
        roomTitle={roomTitle}
      />

      <AlertDialog open={showUpgradeDialog}>
        <AlertDialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md overflow-y-auto border-white/[0.08] bg-[#111116] text-white shadow-[0_30px_120px_-65px_rgba(0,0,0,0.95)]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('room.upgrade.title')}</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {t('room.upgrade.description', { nickname: activeRequest?.requesterNickname })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel className="mt-0 h-11 border-white/[0.12] bg-white/[0.04] text-zinc-100 hover:bg-white/[0.08]" onClick={() => activeRequest && rejectUpgrade(activeRequest.requestId)}>{t('room.upgrade.decline')}</AlertDialogCancel>
            <AlertDialogAction className="h-11" onClick={() => activeRequest && approveUpgrade(activeRequest.requestId)}>{t('room.upgrade.approve')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="relative h-full w-full overflow-hidden">
        <ContentLayout />
      </div>

      <DraggableControlBar />

      <Suspense fallback={null}>
        {isPanelOpen('chat') && (
          <ChatPanel
            isOpen={true}
            onClose={() => closePanel('chat')}
          />
        )}

        {isPanelOpen('whiteboard') && (
          <WhiteboardPanel
            isOpen={true}
            onClose={() => closePanel('whiteboard')}
          />
        )}

        {isPanelOpen('settings') && (
          <SettingsPanel
            isOpen={true}
            onClose={() => closePanel('settings')}
          />
        )}

        {isPanelOpen('relay') && (
          <RelayControlPanel
            isOpen={true}
            onClose={() => closePanel('relay')}
          />
        )}

        {isPanelOpen('fileStreaming') && (
          <FileStreamingPanel
            isOpen={true}
            onClose={() => closePanel('fileStreaming')}
          />
        )}

        {isPanelOpen('cowatch') && (
          <CoWatchPanel
            isOpen={true}
            onClose={() => closePanel('cowatch')}
          />
        )}
      </Suspense>
    </div>
  );
};

const MemoizedRoom = memo(Room);
export default MemoizedRoom;
