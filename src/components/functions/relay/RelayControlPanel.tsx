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

export const RelayControlPanel: React.FC = () => {
  const { availableRooms, loading, lastUpdated, requestRoomList, sendRelayRequest, relaySessions, terminateRelay } = useRelayStore();
  const socket = useSignalingStore((s) => s.socket);
  const { localStream, isSharingScreen } = useMediaDeviceStore();
  const { userId } = useSessionStore();
  const [selectedStream, setSelectedStream] = useState<string>('current');
  const [selectedTarget, setSelectedTarget] = useState<string>('');

  useEffect(() => {
    requestRoomList();
  }, [requestRoomList]);

  const handleSendRelayRequest = () => {
    if (!selectedTarget) return;
    const currentVideo = localStream?.getVideoTracks()[0];
    const hasAudio = !!localStream?.getAudioTracks().length;
    const resolution = currentVideo?.getSettings() ? `${currentVideo.getSettings().width}x${currentVideo.getSettings().height}` : 'N/A';
    
    // Determine stream type based on selection and current state
    let streamType: 'screen' | 'video' | 'audio';
    if (selectedStream === 'screen') {
      streamType = 'screen';
    } else if (selectedStream === 'current') {
      streamType = isSharingScreen ? 'screen' : (currentVideo ? 'video' : 'audio');
    } else {
      // Default to video for other cases
      streamType = currentVideo ? 'video' : 'audio';
    }
    
    const streamMetadata = {
      streamLabel: selectedStream === 'current' ? 'Current Stream' : selectedStream === 'screen' ? 'Screen Share' : 'Camera Stream',
      streamType,
      mediaInfo: {
        resolution,
        hasAudio
      },
      userId: userId || ''
    };
    sendRelayRequest(selectedTarget, streamMetadata);
    setSelectedTarget('');
  };

  const getAvailableStreams = () => {
    const streams = [];
    streams.push({ id: 'current', label: 'Current Stream' });
    if (isSharingScreen) streams.push({ id: 'screen', label: 'Screen Share' });
    return streams;
  };

  return (
    <div className="h-full w-full flex flex-col gap-3 bg-card p-4 rounded-lg border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tv className="w-4 h-4" />
          <span className="text-sm font-medium">Active Rooms</span>
          {lastUpdated && <span className="text-xs text-muted-foreground">{new Date(lastUpdated).toLocaleTimeString()}</span>}
        </div>
        <Button variant="outline" size="sm" onClick={requestRoomList} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </Button>
      </div>

      <Card className="p-3">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-2 block">Select Stream to Relay</label>
            <Select value={selectedStream} onValueChange={setSelectedStream}>
              <SelectTrigger><SelectValue placeholder="Select a stream" /></SelectTrigger>
              <SelectContent>
                {getAvailableStreams().map((stream) => (
                  <SelectItem key={stream.id} value={stream.id}>{stream.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Select Target User</label>
            <Select value={selectedTarget} onValueChange={setSelectedTarget}>
              <SelectTrigger><SelectValue placeholder="Select a user" /></SelectTrigger>
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
          <Button onClick={handleSendRelayRequest} disabled={!selectedTarget} className="w-full gap-2">
            <Send className="w-4 h-4" />
            Send Relay Request
          </Button>
        </div>
      </Card>

      {relaySessions.length > 0 && (
        <Card className="p-3">
          <div className="space-y-2">
            <label className="text-sm font-medium mb-2 block">Active Relay Sessions</label>
            {relaySessions.map((session) => (
              <div key={session.peerId} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{session.nickname}</div>
                  <div className="text-xs text-muted-foreground truncate">{session.metadata.streamLabel}</div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={session.status === 'connected' ? 'default' : 'secondary'}>{session.status}</Badge>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => terminateRelay(session.peerId)}>
                        <XCircle className="w-4 h-4 text-destructive" />
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
                  <Badge variant={p.streamCount >= p.streamLimit ? 'destructive' : 'default'}>{p.streamCount}/{p.streamLimit}</Badge>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
