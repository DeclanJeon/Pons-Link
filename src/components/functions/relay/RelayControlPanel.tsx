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
  const [selectedStream, setSelectedStream] = useState<string>('camera');
  const [selectedTarget, setSelectedTarget] = useState<string>('');

  useEffect(() => {
    requestRoomList();
  }, [requestRoomList]);
  
  // Note: The socket listener is now managed inside useSignalingStore, no need for a separate one here.

  const handleSendRelayRequest = () => {
    if (!selectedTarget) {
      console.error('[RelayControlPanel] No target selected');
      return;
    }
    
    let streamForInfo = localStream; // Assume camera/mic stream
    let streamType: 'video' | 'audio' | 'screen' = 'video';
    
    if (selectedStream === 'screen') {
        streamType = 'screen';
        // Screen share stream might be different, but we'll use localStream's settings for simplicity
    } else if (localStream?.getVideoTracks().length === 0 && localStream?.getAudioTracks().length > 0) {
        streamType = 'audio';
    }

    const videoTrack = streamForInfo?.getVideoTracks()[0];
    const settings = videoTrack?.getSettings();

    const streamMetadata = {
      streamLabel: selectedStream === 'camera' ? 'Camera Stream' :
                 selectedStream === 'screen' ? 'Screen Share' : 'Audio Stream',
      streamType: streamType,
      mediaInfo: {
        resolution: settings ? `${settings.width}x${settings.height}` : 'N/A',
        hasAudio: !!streamForInfo?.getAudioTracks().length,
      },
      userId: userId || '',
    };

    sendRelayRequest(selectedTarget, streamMetadata);
    setSelectedTarget('');
  };

  const getAvailableStreams = () => {
    const streams = [];
    if (localStream) {
      if (localStream.getVideoTracks().length > 0) streams.push({ id: 'camera', label: 'Camera Stream' });
      if (localStream.getAudioTracks().length > 0 && localStream.getVideoTracks().length === 0) streams.push({ id: 'audio', label: 'Audio Stream' });
    }
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
                    .filter(peer => peer.userId !== userId) // 자기 자신 제외
                    .map((peer) => (
                      <SelectItem key={peer.userId} value={peer.userId}>
                        {peer.nickname || peer.userId} ({room.id})
                      </SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSendRelayRequest} disabled={!selectedTarget || getAvailableStreams().length === 0} className="w-full gap-2">
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