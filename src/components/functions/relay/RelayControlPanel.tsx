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
import { Separator } from '@/components/ui/separator';
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

    } catch (error: any) {
      toast.error('Failed to send relay', {
        id: toastId,
        description: error.message,
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
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className={cn(
          "fixed top-0 h-min bg-card/95 backdrop-blur-xl border-l border-border/50 shadow-[var(--shadow-elegant)] z-50 flex flex-col right-0",
          isMobile ? "w-full" : "w-full max-w-md"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-md rounded-full" />
              <Tv className="relative w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-lg leading-none">Relay Control</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Send your stream to others
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-9 w-9 p-0 hover:bg-destructive/10 hover:text-destructive transition-all"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* 통계 배지 */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5 px-2.5 py-1">
              <Users className="w-3 h-3" />
              <span className="text-xs font-medium">{totalPeers} available</span>
            </Badge>
            {isSharingScreen && (
              <Badge variant="default" className="gap-1.5 px-2.5 py-1">
                <Zap className="w-3 h-3" />
                <span className="text-xs font-medium">Screen sharing</span>
              </Badge>
            )}
          </div>

          {/* 최근 사용자 퀵 액세스 */}
          {recentTargets.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                Recent
              </label>
              <div className="flex gap-2">
                {recentTargets.map(targetId => {
                  const peer = availablePeers.find(p => p.userId === targetId);
                  if (!peer) return null;

                  return (
                    <motion.button
                      key={targetId}
                      onClick={() => handleQuickSend(targetId)}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      className={cn(
                        "flex-1 px-3 py-2.5 rounded-lg border-2 transition-all",
                        "bg-gradient-to-br from-accent/50 to-accent/30",
                        "hover:from-primary/20 hover:to-primary/10",
                        "hover:border-primary/50 hover:shadow-md",
                        "active:shadow-inner"
                      )}
                    >
                      <div className="text-xs font-medium truncate">
                        {peer.nickname || targetId.slice(0, 8)}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {peer.roomId}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

        {/* 주요 액션 영역 */}
          <div className="space-y-3 p-4 rounded-lg bg-accent/30 border">
            {/* 대상 선택 */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Select recipient
              </label>
              <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                <SelectTrigger
                  className={cn(
                    "h-11 transition-all",
                    selectedTarget && "border-primary/50 bg-primary/5"
                  )}
                >
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {availablePeers.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>No users available</p>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={requestRoomList}
                        className="mt-2"
                      >
                        Refresh list
                      </Button>
                    </div>
                  ) : (
                    availablePeers.map(peer => (
                      <SelectItem
                        key={peer.userId}
                        value={peer.userId}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center justify-between w-full gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-semibold text-primary">
                                {(peer.nickname || peer.userId)[0].toUpperCase()}
                              </span>
                            </div>
                            <span className="font-medium truncate">
                              {peer.nickname || peer.userId}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 flex-shrink-0">
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
                  "w-full h-12 gap-2 font-semibold text-base transition-all",
                  "bg-gradient-to-r from-primary to-primary/80",
                  "hover:from-primary/90 hover:to-primary/70",
                  "disabled:from-muted disabled:to-muted",
                  "shadow-lg hover:shadow-xl disabled:shadow-none",
                  canSend && "ring-2 ring-primary/20 ring-offset-2 ring-offset-background"
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
          </div>

        {/* 활성 세션 */}
          {relaySessions.length > 0 && (
            <>
              <Separator className="my-4" />

              <button
                onClick={() => setShowSessions(!showSessions)}
                className={cn(
                  "flex items-center justify-between w-full py-2.5 px-3 rounded-lg",
                  "text-sm font-medium transition-all",
                  "hover:bg-accent/50 active:bg-accent"
                )}
              >
                <div className="flex items-center gap-2">
                  <span>Active Sessions</span>
                  <Badge variant="secondary" className="text-xs px-2 py-0.5">
                    {relaySessions.length}
                  </Badge>
                </div>
                <motion.div
                  animate={{ rotate: showSessions ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
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
                            "p-4 rounded-lg space-y-3",
                            "bg-gradient-to-br from-accent/50 to-accent/30",
                            "border-2 border-accent",
                            "hover:border-primary/30 transition-all"
                          )}
                        >
                          {/* 세션 헤더 */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <div className="text-sm font-semibold truncate">
                                  {session.nickname}
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <span>{session.metadata.streamLabel}</span>
                                <span>•</span>
                                <span>{session.metadata.mediaInfo.resolution}</span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTerminate(session.peerId)}
                              className={cn(
                                "h-8 w-8 p-0 flex-shrink-0",
                                "hover:bg-destructive/10 hover:text-destructive",
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
                                "h-9 text-sm",
                                "focus-visible:ring-primary/50"
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
                              className="h-9 px-3 gap-1.5"
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
                              "w-full h-9 gap-2 text-xs font-medium",
                              "hover:bg-primary/5 hover:border-primary/50",
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
            </>
          )}
        </div>
      </motion.div>

      <Toaster
        position={isMobile ? 'top-center' : 'bottom-right'}
        richColors
        closeButton
      />
    </AnimatePresence>
  );
};
