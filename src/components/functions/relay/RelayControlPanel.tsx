// src/components/functions/relay/RelayControlPanel.tsx
import React, { useEffect, useState } from 'react';
import { useRelayStore } from '@/stores/useRelayStore';
import { useSignalingStore } from '@/stores/useSignalingStore';
import { useMediaDeviceStore } from '@/stores/useMediaDeviceStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, Tv, Send, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDeviceType } from '@/hooks/useDeviceType';
import { cn } from '@/lib/utils';

interface RelayControlPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const RelayControlPanel: React.FC<RelayControlPanelProps> = ({ isOpen = true, onClose }) => {
  const { isMobile, isTablet, isDesktop } = useDeviceType();
  const { availableRooms, loading, lastUpdated, requestRoomList, sendRelayRequest, relaySessions, terminateRelay } = useRelayStore();
  const socket = useSignalingStore((s) => s.socket);
  const { localStream, isSharingScreen } = useMediaDeviceStore();
  const { userId } = useSessionStore();
  const [selectedStream, setSelectedStream] = useState<string>('current');
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [restartPrefs, setRestartPrefs] = useState<Record<string, 'current'|'lower'|'audio-only'>>({});
  const setMsg = (id: string, v: string) => setMessageDrafts(s => ({ ...s, [id]: v }));
  const setPref = (id: string, v: 'current'|'lower'|'audio-only') => setRestartPrefs(s => ({ ...s, [id]: v }));
  const handleClosePanel = () => { if (onClose) { onClose(); } };
  useEffect(() => { requestRoomList(); }, [requestRoomList]);
  if (!isOpen) { return null; }

  const handleSendRelayRequest = () => {
    if (!selectedTarget) return;
    const currentVideo = localStream?.getVideoTracks()[0];
    const hasAudio = !!localStream?.getAudioTracks().length;
    const resolution = currentVideo?.getSettings() ? `${currentVideo.getSettings().width}x${currentVideo.getSettings().height}` : 'N/A';
    let streamType: 'screen' | 'video' | 'audio';
    if (selectedStream === 'screen') {
      streamType = 'screen';
    } else {
      streamType = isSharingScreen ? 'screen' : (currentVideo ? 'video' : 'audio');
    }
    const streamMetadata = {
      streamLabel: selectedStream === 'current' ? 'Current Stream' : selectedStream === 'screen' ? 'Screen Share' : 'Camera Stream',
      streamType,
      mediaInfo: {
        resolution,
        hasAudio
      },
      userId: userId || ''
    } as any;
    sendRelayRequest(selectedTarget, streamMetadata);
    setSelectedTarget('');
  };

  const getAvailableStreams = () => {
    const streams = [];
    streams.push({ id: 'current', label: 'Current Stream' });
    if (isSharingScreen) streams.push({ id: 'screen', label: 'Screen Share' });
    return streams;
  };

  const canSend = !!selectedTarget;

  return (
    <div className={cn("h-full w-full flex flex-col gap-3 bg-card rounded-lg border",
      isMobile ? "p-3 gap-2" : "p-4 gap-3")}>
      <div className={cn("flex items-center justify-between",
        isMobile ? "gap-1" : "gap-2")}>
        <div className={cn("flex items-center gap-2",
          isMobile && "gap-1")}>
          <Tv className={cn("w-4 h-4", isMobile && "w-3 h-3")} />
          <span className={cn("font-medium",
            isMobile ? "text-xs" : "text-sm")}>Active Rooms</span>
          {lastUpdated && (
            <span className={cn("text-muted-foreground",
              isMobile ? "text-[10px]" : "text-xs")}>
              {new Date(lastUpdated).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className={cn("flex items-center gap-2",
          isMobile && "gap-1")}>
          <Button
            variant="outline"
            size={isMobile ? "sm" : "sm"}
            onClick={requestRoomList}
            disabled={loading}
            className={cn("gap-2", isMobile && "text-xs h-7 px-2")}
          >
            {loading ? (
              <Loader2 className={cn("animate-spin", isMobile ? "w-3 h-3" : "w-4 h-4")} />
            ) : (
              <RefreshCw className={cn(isMobile ? "w-3 h-3" : "w-4 h-4")} />
            )}
            {isMobile ? "" : "Refresh"}
          </Button>
          <Button
            variant="ghost"
            size={isMobile ? "sm" : "sm"}
            onClick={handleClosePanel}
            className={cn("p-0", isMobile ? "h-6 w-6" : "h-8 w-8")}
          >
            <XCircle className={cn(isMobile ? "w-3 h-3" : "w-4 h-4")} />
          </Button>
        </div>
      </div>

      <Card className={cn("p-3", isMobile && "p-2")}>
        <div className={cn("space-y-3", isMobile && "space-y-2")}>
          <div>
            <label className={cn("font-medium mb-2 block",
              isMobile ? "text-xs" : "text-sm")}>Select Stream to Relay</label>
            <Select value={selectedStream} onValueChange={setSelectedStream}>
              <SelectTrigger className={cn(isMobile && "h-8 text-xs")}>
                <SelectValue placeholder="Select a stream" />
              </SelectTrigger>
              <SelectContent>
                {getAvailableStreams().map((stream) => (
                  <SelectItem key={stream.id} value={stream.id}>
                    {stream.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={cn("font-medium mb-2 block",
              isMobile ? "text-xs" : "text-sm")}>Select Target User</label>
            <Select value={selectedTarget} onValueChange={setSelectedTarget}>
              <SelectTrigger className={cn(isMobile && "h-8 text-xs")}>
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {availableRooms.flatMap((room) =>
                  room.peers
                    .filter(peer => peer.userId !== userId)
                    .map((peer) => (
                      <SelectItem key={peer.userId} value={peer.userId}>
                        {peer.nickname || peer.userId} ({room.id})
                      </SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleSendRelayRequest}
            disabled={!canSend}
            className={cn("w-full gap-2", isMobile && "text-xs h-8")}
          >
            <Send className={cn(isMobile ? "w-3 h-3" : "w-4 h-4")} />
            {isMobile ? "Send" : "Send Relay Request"}
          </Button>
        </div>
      </Card>

      {relaySessions.length > 0 && (
        <Card className={cn("p-3", isMobile && "p-2")}>
          <div className={cn("space-y-2", isMobile && "space-y-1")}>
            <label className={cn("font-medium mb-2 block",
              isMobile ? "text-xs" : "text-sm")}>Active Relay Sessions</label>
            {relaySessions.map((session) => (
              <div key={session.peerId} className={cn("rounded-md border space-y-2",
                isMobile ? "p-2 space-y-1" : "p-3 space-y-2")}>
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className={cn("font-medium truncate",
                      isMobile ? "text-xs" : "text-sm")}>{session.nickname}</div>
                    <div className={cn("text-muted-foreground truncate",
                      isMobile ? "text-[10px]" : "text-xs")}>{session.metadata.streamLabel}</div>
                  </div>
                  <div className={cn("flex items-center gap-2",
                    isMobile && "gap-1")}>
                    <Badge variant={session.status === 'connected' ? 'default' : 'secondary'}
                           className={cn(isMobile && "text-[10px] px-1 py-0")}>
                      {session.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn("p-0", isMobile ? "h-5 w-5" : "h-6 w-6")}
                      onClick={() => terminateRelay(session.peerId)}
                    >
                      <XCircle className={cn("text-destructive",
                        isMobile ? "w-3 h-3" : "w-4 h-4")} />
                    </Button>
                  </div>
                </div>

                <div className={cn("flex gap-2", isMobile && "gap-1")}>
                  <Input
                    value={messageDrafts[session.peerId] || ''}
                    onChange={(e) => setMsg(session.peerId, e.target.value)}
                    placeholder="Message to sender"
                    className={cn(isMobile && "h-7 text-xs")}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!messageDrafts[session.peerId]) return;
                      useRelayStore.getState().sendFeedback(session.peerId, messageDrafts[session.peerId]);
                      setMsg(session.peerId, '');
                    }}
                    className={cn(isMobile && "h-7 text-xs px-2")}
                  >
                    {isMobile ? "S" : "Send"}
                  </Button>
                </div>

                <div className={cn("flex items-center gap-2",
                  isMobile && "gap-1 flex-wrap")}>
                  <Select
                    value={restartPrefs[session.peerId] || 'current'}
                    onValueChange={(v) => setPref(session.peerId, v as any)}
                  >
                    <SelectTrigger className={cn(
                      isMobile ? "h-7 w-[120px] text-xs" : "h-8 w-[160px]"
                    )}>
                      <SelectValue placeholder="Quality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">Keep current</SelectItem>
                      <SelectItem value="lower">Lower quality</SelectItem>
                      <SelectItem value="audio-only">Audio only</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const pref = restartPrefs[session.peerId] || 'current';
                      useRelayStore.getState().requestRetransmit(session.peerId, { quality: pref }, undefined);
                    }}
                    className={cn(isMobile && "h-7 text-xs px-2")}
                  >
                    {isMobile ? "Restart" : "Request Restart"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex-1 overflow-auto space-y-3">
        {loading && availableRooms.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">Loading...</div>}
        {!loading && availableRooms.length === 0 && <div className="text-center py-10 text-sm text-muted-foreground">No active rooms found.</div>}
        {availableRooms.map((room) => (
          <Card key={room.id} className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">{room.id}</div>
              <Badge variant="secondary">{room.peers.length} peers</Badge>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {room.peers.map((p) => (
                <div key={p.userId} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.nickname || p.userId}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
