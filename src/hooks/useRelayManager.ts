import { create } from 'zustand';
import { produce } from 'immer';
import Peer from 'simple-peer/simplepeer.min.js';
import type { Instance as PeerInstance } from 'simple-peer';
import { useSignalingStore } from '@/stores/useSignalingStore';
import { useMediaDeviceStore } from '@/stores/useMediaDeviceStore';
import { useRelayStore, RelaySession, StreamMetadata } from '@/stores/useRelayStore';
import { useFileStreamingStore } from '@/stores/useFileStreamingStore';
import { toast } from 'sonner';

interface RelayManagerSate {
  connections: Map<string, PeerInstance>;
  createRelayConnection: (peerId: string, initiator: boolean, metadata: StreamMetadata, peerNickname?: string, streamOverride?: MediaStream) => void;
  signalPeer: (peerId: string, signal: any) => void;
  removeRelayConnection: (peerId: string) => void;
}

export const useRelayManager = create<RelayManagerSate>((set, get) => ({
  connections: new Map(),

  createRelayConnection: (peerId, initiator, metadata, peerNickname, streamOverride) => {
    if (get().connections.has(peerId)) return;

    const { localStream } = useMediaDeviceStore.getState();
    const { iceServers } = useSignalingStore.getState();
    const { addRelaySession, updateRelaySession } = useRelayStore.getState();

    const peerOptions: Peer.Options = {
      initiator,
      trickle: true,
      config: { iceServers: iceServers || [{ urls: 'stun:stun.l.google.com:19302' }] },
      offerOptions: { offerToReceiveAudio: true, offerToReceiveVideo: true }
    };

    if (initiator) {
      const isFileStreaming = useFileStreamingStore.getState().isStreaming
      const el = useFileStreamingStore.getState().presentationVideoEl
      let combined: MediaStream | null = null
      if (isFileStreaming && el) {
        let cap: MediaStream | null = null
        try {
          if (typeof (el as any).captureStream === 'function') cap = (el as any).captureStream(30)
        } catch {}
        try {
          if (!cap && typeof (el as any).mozCaptureStream === 'function') cap = (el as any).mozCaptureStream(30)
        } catch {}
        const s = new MediaStream()
        const vt = cap?.getVideoTracks?.()[0] || null
        if (vt) s.addTrack(vt)
        let at = cap?.getAudioTracks?.()[0] || null
        if (!at) {
          try {
            const ctx = new AudioContext()
            const src = ctx.createMediaElementSource(el)
            const dest = ctx.createMediaStreamDestination()
            src.connect(dest)
            at = dest.stream.getAudioTracks()[0] || null
          } catch {}
        }
        if (at) s.addTrack(at)
        combined = s
      }
      if (!combined) {
        const base = streamOverride || localStream || null
        if (!base) {
          toast.error('Stream to relay is not available.')
          return
        }
        const v = base.getVideoTracks()[0] || null
        const s = new MediaStream()
        if (v) s.addTrack(v.clone())
        combined = s
      }
      peerOptions.stream = combined;
    }

    const peer = new Peer(peerOptions);

    peer.on('signal', (signal) => {
      useSignalingStore.getState().emit('relay:signal', { toUserId: peerId, signal });
    });

    peer.on('stream', (stream) => {
      updateRelaySession(peerId, { stream, status: 'connected' });
      useRelayStore.getState().onRelayStream(peerId, stream);
    });

    peer.on('connect', () => {
      updateRelaySession(peerId, { status: 'connected' });
    });

    peer.on('close', () => {
      get().removeRelayConnection(peerId);
    });

    peer.on('error', () => {
      updateRelaySession(peerId, { status: 'failed' });
      get().removeRelayConnection(peerId);
    });

    set(produce((state) => {
      state.connections.set(peerId, peer);
    }));

    const peerInfo = useRelayStore.getState().availableRooms
      .flatMap(r => r.peers)
      .find(p => p.userId === peerId);

    const newSession: RelaySession = {
      peerId,
      nickname: peerNickname || peerInfo?.nickname || 'Unknown',
      stream: null,
      metadata,
      isInitiator: initiator,
      status: 'connecting',
    };
    addRelaySession(newSession);
  },

  signalPeer: (peerId, signal) => {
    const peer = get().connections.get(peerId);
    if (peer && !peer.destroyed) peer.signal(signal);
  },

  removeRelayConnection: (peerId) => {
    set(produce((state) => {
      const peer = state.connections.get(peerId);
      if (peer && !peer.destroyed) peer.destroy();
      state.connections.delete(peerId);
    }));
    const relay = useRelayStore.getState();
    if (relay.takeoverMode && relay.takeoverPeerId === peerId) {
      relay.disableTakeover();
    }
    useRelayStore.getState().removeRelaySession(peerId);
  },
}));
