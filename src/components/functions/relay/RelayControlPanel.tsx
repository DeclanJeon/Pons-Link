// src/components/functions/relay/RelayControlPanel.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast, Toaster } from 'sonner';
import { useHotkeys } from 'react-hotkeys-hook';

import { useRelayStore, type StreamMetadata } from '@/stores/useRelayStore';
import { useMediaDeviceStore } from '@/stores/useMediaDeviceStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useDeviceType } from '@/hooks/useDeviceType';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

import { 
  Loader2, 
  Send, 
  X,
  Tv,
  MessageSquare,
  ChevronRight,
  RotateCcw,
  Users,
  Zap,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 세련된 릴레이 컨트롤 패널
 * 
 * 디자인 원칙:
 * - Visual Hierarchy: 크기, 색상, 간격으로 중요도 표현
 * - Micro-interactions: 모든 인터랙션에 즉각적 피드백
 * - Progressive Disclosure: 필요한 정보만 단계적으로 노출
 * - Consistent Spacing: 4px 기반 spacing system
 */

interface RelayControlPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const RelayControlPanel: React.FC<RelayControlPanelProps> = ({ 
  isOpen = true, 
  onClose 
}) => {
  const { isMobile } = useDeviceType();
  
  const { 
    availableRooms, 
    loading, 
    requestRoomList, 
    sendRelayRequest, 
    relaySessions, 
    terminateRelay 
  } = useRelayStore();
  
  const { localStream, isSharingScreen } = useMediaDeviceStore();
  const { userId } = useSessionStore();
  
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [showSessions, setShowSessions] = useState(false);
  const [sessionMessages, setSessionMessages] = useState<Record<string, string>>({});
  const [recentTargets, setRecentTargets] = useState<string[]>([]);

  // 사용 가능한 모든 피어 목록
  const availablePeers = availableRooms.flatMap(room =>
    room.peers
      .filter(peer => peer.userId !== userId)
      .map(peer => ({
        ...peer,
        roomId: room.id
      }))
  );

  const canSend = !!selectedTarget;
  const totalPeers = availablePeers.length;
  const activeSourceLabel = isSharingScreen ? 'Screen share' : localStream?.getVideoTracks().length ? 'Camera' : 'Audio only';
  const activeSourceTone = isSharingScreen ? 'Screen' : localStream?.getVideoTracks().length ? 'Video' : 'Audio';

  /**
   * 릴레이 요청 전송
   */
  const handleSendRelay = useCallback(async () => {
    if (!selectedTarget) return;

    const toastId = toast.loading('Sending relay request...');

    try {
      const currentVideo = localStream?.getVideoTracks()[0];
      const hasAudio = !!localStream?.getAudioTracks().length;
      const resolution = currentVideo?.getSettings()
        ? `${currentVideo.getSettings().width}x${currentVideo.getSettings().height}`
        : 'N/A';

      const streamMetadata: StreamMetadata = {
        streamLabel: isSharingScreen ? 'Screen Share' : 'Camera',
        streamType: isSharingScreen ? 'screen' : (currentVideo ? 'video' : 'audio'),
        mediaInfo: { resolution, hasAudio },
        userId: userId || ''
      };

      await sendRelayRequest(selectedTarget, streamMetadata);

      // 최근 사용자 목록 업데이트
      setRecentTargets(prev => {
        const filtered = prev.filter(id => id !== selectedTarget);
        return [selectedTarget, ...filtered].slice(0, 3);
      });

      toast.success('Relay sent successfully!', { 
        id: toastId,
        duration: 3000 
      });
      setSelectedTarget('');

    } catch (error: unknown) {
      toast.error('Failed to send relay', {
        id: toastId,
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 4000
      });
    }
  }, [selectedTarget, localStream, isSharingScreen, userId, sendRelayRequest]);

  /**
   * 빠른 전송 (최근 사용자)
   */
  const handleQuickSend = useCallback(async (targetId: string) => {
    setSelectedTarget(targetId);
    // 다음 틱에서 전송 (상태 업데이트 후)
    setTimeout(() => {
      handleSendRelay();
    }, 0);
  }, [handleSendRelay]);

  /**
   * 세션 종료
   */
  const handleTerminate = useCallback((peerId: string) => {
    terminateRelay(peerId);
    toast.success('Relay connection closed', { duration: 2000 });
  }, [terminateRelay]);

  /**
   * 메시지 전송
   */
  const handleSendMessage = useCallback((peerId: string) => {
    const message = sessionMessages[peerId];
    if (!message?.trim()) return;

    useRelayStore.getState().sendFeedback(peerId, message);
    setSessionMessages(prev => ({ ...prev, [peerId]: '' }));
    toast.success('Message sent', { duration: 2000 });
  }, [sessionMessages]);

  /**
   * 피어 이름 조회
   */
  const getPeerName = useCallback((userId: string) => {
    const peer = availablePeers.find(p => p.userId === userId);
    return peer?.nickname || userId.slice(0, 8);
  }, [availablePeers]);

  // 키보드 단축키
  useHotkeys('mod+enter', () => canSend && handleSendRelay(), [canSend, handleSendRelay]);
  useHotkeys('escape', () => onClose?.(), [onClose]);

  // 초기 로드
  useEffect(() => {
    requestRoomList();
  }, [requestRoomList]);

  // 활성 세션이 있으면 자동으로 표시
  useEffect(() => {
    if (relaySessions.length > 0) setShowSessions(true);
  }, [relaySessions.length]);

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          role="dialog"
          aria-modal="false"
          aria-label="Media relay control panel"
          key="relay-control-panel"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className={cn(
            "room-noir-panel room-soft-edge fixed top-0 h-[100dvh] max-h-[100dvh] border-l border-white/[0.055] z-[60] flex flex-col right-0 text-foreground overflow-hidden",
            isMobile ? "w-full" : "w-full max-w-[30rem]"
          )}
        >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-16 top-8 h-44 w-44 rounded-full bg-indigo-500/15 blur-3xl" />
          <div className="absolute -left-20 bottom-16 h-52 w-52 rounded-full bg-emerald-400/10 blur-3xl" />
        </div>

        {/* Header */}
        <div className="room-panel-header relative flex items-start justify-between gap-4 border-b p-5">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="relay-signal-orb relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl">
              <Tv className="relative w-5 h-5 text-indigo-100" />
            </div>
            <div className="min-w-0">
              <p className="room-panel-eyebrow">Media Relay</p>
              <h2 className="room-panel-title font-semibold text-xl leading-tight">Relay Control</h2>
              <p className="mt-1.5 max-w-[21rem] text-sm leading-5 text-slate-300/80">
                Route camera, screen, or audio to another participant without leaving the room.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="relay-meta-chip">
                  <Zap className="h-3.5 w-3.5" />
                  {activeSourceLabel}
                </span>
                <span className="relay-meta-chip relay-meta-chip-muted">
                  <Users className="h-3.5 w-3.5" />
                  {totalPeers} targets
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close media relay panel"
            className="room-icon-button h-10 w-10 flex-shrink-0 p-0 text-slate-300 hover:bg-red-500/10 hover:text-red-200 transition-all"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="relative flex-1 overflow-y-auto p-5 space-y-5">

          {/* 통계 배지 */}
          <div className="grid grid-cols-2 gap-3" aria-label="Signal scope">
            <div className="relay-metric-card">
              <span className="relay-metric-label">Signal scope</span>
              <strong>{totalPeers}</strong>
              <span className="relay-metric-copy">available participants</span>
            </div>
            <div className="relay-metric-card relay-metric-card-accent">
              <span className="relay-metric-label">Current source</span>
              <strong>{activeSourceTone}</strong>
              <span className="relay-metric-copy">{activeSourceLabel}</span>
            </div>
          </div>

          {/* 최근 사용자 퀵 액세스 */}
          {recentTargets.length > 0 && (
            <section className="space-y-2.5" aria-label="Recent relay targets">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300/72">
                  <Clock className="w-3 h-3" />
                  Recent targets
                </h3>
                <span className="text-[11px] text-slate-500">one-tap send</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {recentTargets.map(targetId => {
                  const peer = availablePeers.find(p => p.userId === targetId);
                  if (!peer) return null;

                  return (
                    <motion.button
                      key={targetId}
                      type="button"
                      aria-label={`Quick send relay to ${peer.nickname || targetId.slice(0, 8)}`}
                      onClick={() => handleQuickSend(targetId)}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "relay-quick-target min-h-14 rounded-2xl px-3 py-2.5 text-left transition-all",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                      )}
                    >
                      <div className="text-xs font-semibold text-slate-100 truncate">
                        {peer.nickname || targetId.slice(0, 8)}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400 truncate">
                        {peer.roomId}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </section>
          )}

        {/* 주요 액션 영역 */}
          <section className="room-section-card space-y-4 rounded-[1.4rem] p-4" aria-labelledby="relay-destination-heading">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="room-panel-eyebrow text-[0.62rem]">Step 01</p>
                <h3 id="relay-destination-heading" className="mt-1 text-sm font-semibold text-slate-100">
                  1 Choose destination
                </h3>
              </div>
              <span className="relay-status-pill">Live route</span>
            </div>
            {/* 대상 선택 */}
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-300/72">
                Recipient
              </label>
              <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                <SelectTrigger
                  className={cn(
                    "h-12 rounded-2xl border-white/10 bg-slate-950/65 text-slate-100 transition-all focus:ring-indigo-300/60",
                    selectedTarget && "border-emerald-300/45 bg-emerald-300/10 shadow-[0_0_0_1px_rgba(110,231,183,0.12)_inset]"
                  )}
                  aria-label="Select media relay recipient"
                >
                  <SelectValue placeholder="Choose a participant..." />
                </SelectTrigger>
                <SelectContent className="room-more-menu border-0 p-1">
                  {availablePeers.length === 0 ? (
                    <div className="m-1 rounded-2xl border border-white/[0.06] bg-slate-950/70 p-4 text-center text-sm text-slate-400">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-medium text-slate-200">No users available</p>
                      <p className="mt-1 text-xs text-slate-500">Refresh the room list to discover active participants.</p>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={requestRoomList}
                        className="mt-2 min-h-10 text-indigo-200"
                      >
                        Refresh list
                      </Button>
                    </div>
                  ) : (
                    availablePeers.map(peer => (
                      <SelectItem
                        key={peer.userId}
                        value={peer.userId}
                        className="room-more-menu-item cursor-pointer"
                      >
                        <div className="flex items-center justify-between w-full gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-300/12 ring-1 ring-indigo-200/10">
                              <span className="text-xs font-semibold text-indigo-100">
                                {(peer.nickname || peer.userId)[0].toUpperCase()}
                              </span>
                            </div>
                            <span className="font-medium truncate text-slate-100">
                              {peer.nickname || peer.userId}
                            </span>
                          </div>
                          <Badge variant="outline" className="flex-shrink-0 border-white/10 bg-white/[0.035] px-1.5 py-0.5 text-[10px] text-slate-400">
                            {peer.roomId}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* 전송 버튼 */}
            <motion.div
              whileHover={{ scale: canSend ? 1.02 : 1 }}
              whileTap={{ scale: canSend ? 0.98 : 1 }}
            >
              <Button
                onClick={handleSendRelay}
                disabled={!canSend || loading}
                className={cn(
                  "w-full h-12 gap-2 rounded-2xl font-semibold text-base text-slate-950 transition-all",
                  "bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300",
                  "hover:from-emerald-300 hover:via-teal-200 hover:to-cyan-200",
                  "disabled:bg-none disabled:bg-slate-800 disabled:text-slate-500",
                  "shadow-[0_18px_55px_-32px_rgba(45,212,191,0.9)] hover:shadow-[0_18px_65px_-28px_rgba(45,212,191,0.95)] disabled:shadow-none",
                  canSend && "ring-2 ring-emerald-300/20 ring-offset-2 ring-offset-slate-950"
                )}
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send Relay Request
                  </>
                )}
              </Button>
            </motion.div>
          </section>

        {/* 활성 세션 */}
          {relaySessions.length > 0 && (
            <section className="room-section-card rounded-[1.4rem] p-3.5" aria-labelledby="relay-sessions-heading">
              <button
                type="button"
                aria-expanded={showSessions}
                aria-label="Toggle active relay sessions"
                onClick={() => setShowSessions(!showSessions)}
                className={cn(
                  "flex min-h-12 w-full cursor-pointer items-center justify-between rounded-2xl px-3 py-2.5",
                  "text-sm font-medium text-slate-100 transition-all",
                  "hover:bg-white/[0.055] active:bg-white/[0.075]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.85)]" />
                  <div className="min-w-0 text-left">
                    <p id="relay-sessions-heading" className="font-semibold">2 Active relay sessions</p>
                    <p className="text-xs font-normal text-slate-400">Monitor routed streams and send quick feedback.</p>
                  </div>
                  <Badge variant="secondary" className="border border-emerald-300/15 bg-emerald-300/10 px-2 py-0.5 text-xs text-emerald-100">
                    {relaySessions.length}
                  </Badge>
                </div>
                <motion.div
                  animate={{ rotate: showSessions ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </motion.div>
              </button>

              <AnimatePresence>
                {showSessions && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 mt-3">
                      {relaySessions.map((session, index) => (
                        <motion.div
                          key={session.peerId}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className={cn(
                            "relay-session-card p-4 rounded-2xl space-y-3",
                            "transition-all hover:border-emerald-300/20"
                          )}
                        >
                          {/* 세션 헤더 */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <div className="text-sm font-semibold truncate text-slate-100">
                                  {session.nickname}
                                </div>
                              </div>
                              <div className="text-xs text-slate-400 flex items-center gap-2">
                                <span>{session.metadata.streamLabel}</span>
                                <span>•</span>
                                <span>{session.metadata.mediaInfo.resolution}</span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTerminate(session.peerId)}
                              aria-label={`Close relay session with ${session.nickname}`}
                              className={cn(
                                "h-10 w-10 p-0 flex-shrink-0 rounded-full text-slate-400",
                                "hover:bg-red-500/10 hover:text-red-200",
                                "transition-all"
                              )}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>

                          {/* 메시지 입력 */}
                          <div className="flex gap-2">
                            <Input
                              value={sessionMessages[session.peerId] || ''}
                              onChange={(e) => setSessionMessages(prev => ({
                                ...prev,
                                [session.peerId]: e.target.value
                              }))}
                              placeholder="Send a message..."
                              className={cn(
                                "h-10 rounded-xl border-white/10 bg-slate-950/70 text-sm text-slate-100 placeholder:text-slate-500",
                                "focus-visible:ring-2 focus-visible:ring-indigo-300/65 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                              )}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSendMessage(session.peerId);
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              onClick={() => handleSendMessage(session.peerId)}
                              disabled={!sessionMessages[session.peerId]?.trim()}
                              aria-label={`Send relay message to ${session.nickname}`}
                              className="h-10 min-w-11 rounded-xl bg-indigo-300/14 px-3 text-indigo-100 hover:bg-indigo-300/20 disabled:bg-white/[0.035] disabled:text-slate-600"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                          </div>

                          {/* 재전송 버튼 */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              useRelayStore.getState().requestRetransmit(
                                session.peerId,
                                { quality: 'current' },
                                undefined
                              );
                              toast.info('Restart requested', { duration: 2000 });
                            }}
                            className={cn(
                              "w-full min-h-10 gap-2 rounded-xl border-white/10 bg-white/[0.035] text-xs font-medium text-slate-200",
                              "hover:border-indigo-200/25 hover:bg-indigo-300/10 hover:text-indigo-50",
                              "transition-all"
                            )}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Request Restart
                          </Button>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )}
        </div>
        </motion.div>
      </AnimatePresence>

      <Toaster
        position={isMobile ? 'top-center' : 'bottom-right'}
        richColors
        closeButton
      />
    </>
  );
};
