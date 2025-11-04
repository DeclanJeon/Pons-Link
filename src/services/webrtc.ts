import Peer from 'simple-peer/simplepeer.min.js';
import type { Instance as PeerInstance, SignalData } from 'simple-peer';

interface WebRTCEvents {
  onSignal: (peerId: string, signal: SignalData) => void;
  onConnect: (peerId: string) => void;
  onStream: (peerId: string, stream: MediaStream) => void;
  onData: (peerId: string, data: any) => void;
  onClose: (peerId: string) => void;
  onError: (peerId: string, error: Error) => void;
}

export class WebRTCManager {
  private peers: Map<string, PeerInstance> = new Map();
  private localStream: MediaStream | null;
  private events: WebRTCEvents;
  private iceServers: RTCIceServer[] = [];

  constructor(localStream: MediaStream | null, events: WebRTCEvents) {
    this.localStream = localStream;
    this.events = events;
    this.iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
  }

  public updateIceServers(servers: RTCIceServer[]): void {
    this.iceServers = servers;
  }

  public createPeer(peerId: string, initiator: boolean): PeerInstance {
    if (this.peers.has(peerId)) {
      this.removePeer(peerId);
    }
    const peerConfig: {
      initiator: boolean;
      trickle: boolean;
      config: {
        iceServers: RTCIceServer[];
        sdpSemantics: string;
      };
      offerOptions: {
        offerToReceiveAudio: boolean;
        offerToReceiveVideo: boolean;
      };
      stream: MediaStream | boolean;
      channelConfig: {
        ordered: boolean;
      };
    } = {
      initiator,
      trickle: true,
      config: { iceServers: this.iceServers, sdpSemantics: 'unified-plan' },
      offerOptions: { offerToReceiveAudio: true, offerToReceiveVideo: true },
      stream: this.localStream || false,
      channelConfig: { ordered: true }
    };
    const peer = new Peer(peerConfig);
    this.setupPeerEvents(peer, peerId);
    this.peers.set(peerId, peer);
    return peer;
  }

  private setupPeerEvents(peer: PeerInstance, peerId: string): void {
    peer.on('signal', (signal) => this.events.onSignal(peerId, signal));
    peer.on('connect', () => {
      try {
        const ch: any = (peer as any)?._channel;
        if (ch && 'binaryType' in ch) ch.binaryType = 'arraybuffer';
      } catch {}
      this.events.onConnect(peerId);
    });
    peer.on('stream', (stream) => this.events.onStream(peerId, stream));
    peer.on('data', (data) => this.events.onData(peerId, data));
    peer.on('close', () => this.events.onClose(peerId));
    peer.on('error', (err) => this.events.onError(peerId, err));
  }

  public receiveSignal(peerId: string, signal: SignalData): void {
    const peer = this.peers.get(peerId);
    if (peer && !peer.destroyed) {
      peer.signal(signal);
    }
  }

  public async replaceTrack(oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack, stream: MediaStream): Promise<void> {
    for (const [, peer] of this.peers.entries()) {
      try {
        if (peer && !peer.destroyed && typeof (peer as any).replaceTrack === 'function') {
          await (peer as any).replaceTrack(oldTrack, newTrack, stream);
        }
      } catch {
        try {
          (peer as any)._needsNegotiation = true;
          (peer as any)._onNegotiationNeeded();
        } catch {
          // Intentionally empty - we continue if negotiation fails
        }
      }
    }
  }

  public async replaceSenderTrack(kind: 'audio' | 'video', newTrack?: MediaStreamTrack): Promise<boolean> {
    let success = true;
    for (const [, peer] of this.peers.entries()) {
      if (peer && !peer.destroyed) {
        try {
          const senders = (peer as any)._pc?.getSenders() || [];
          const sender = senders.find((s: RTCRtpSender) => s.track?.kind === kind);
          if (sender && newTrack) {
            await sender.replaceTrack(newTrack);
          } else if (!sender && newTrack) {
            peer.addTrack(newTrack, this.localStream || new MediaStream());
          } else if (sender && !newTrack) {
            await sender.replaceTrack(null);
          }
        } catch {
          try {
            (peer as any)._needsNegotiation = true;
            (peer as any)._onNegotiationNeeded();
          } catch {
            success = false;
          }
        }
      }
    }
    return success;
  }

  public async replaceLocalStream(newStream: MediaStream): Promise<boolean> {
    this.localStream = newStream;
    const newVideoTrack = newStream.getVideoTracks()[0];
    const newAudioTrack = newStream.getAudioTracks()[0];
    let success = true;
    if (newVideoTrack && newVideoTrack.readyState === 'live') {
      const videoSuccess = await this.replaceSenderTrack('video', newVideoTrack);
      if (!videoSuccess) success = false;
    } else {
      const videoSuccess = await this.replaceSenderTrack('video', undefined as unknown as MediaStreamTrack);
      if (!videoSuccess) success = false;
    }
    if (newAudioTrack && newAudioTrack.readyState === 'live') {
      const audioSuccess = await this.replaceSenderTrack('audio', newAudioTrack);
      if (!audioSuccess) success = false;
    } else {
      const audioSuccess = await this.replaceSenderTrack('audio', undefined as unknown as MediaStreamTrack);
      if (!audioSuccess) success = false;
    }
    return success;
  }

  public removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      if (!peer.destroyed) {
        peer.destroy();
      }
      this.peers.delete(peerId);
    }
  }

  public sendToAllPeers(message: any): { successful: string[]; failed: string[] } {
    const successful: string[] = [];
    const failed: string[] = [];
    
    console.log(`[WebRTC] Sending message to ${this.peers.size} peers`);
    
    for (const [peerId, peer] of this.peers.entries()) {
      try {
        if (peer && !peer.destroyed && (peer as any).connected && (peer as any)._channel?.readyState === 'open') {
          peer.send(message);
          successful.push(peerId);
          console.log(`[WebRTC] Message sent to peer ${peerId}`);
        } else {
          failed.push(peerId);
          console.warn(`[WebRTC] Peer ${peerId} not ready:`, {
            connected: (peer as any).connected,
            destroyed: peer.destroyed,
            channelState: (peer as any)._channel?.readyState
          });
        }
      } catch (error) {
        failed.push(peerId);
        console.error(`[WebRTC] Failed to send to peer ${peerId}:`, error);
      }
    }
    
    console.log(`[WebRTC] Send results: ${successful.length} successful, ${failed.length} failed`);
    return { successful, failed };
  }

  public sendToPeer(peerId: string, message: any): boolean {
    const peer = this.peers.get(peerId);
    if (peer && !peer.destroyed && (peer as any).connected && (peer as any)._channel?.readyState === 'open') {
      try {
        peer.send(message);
        console.log(`[WebRTC] Message sent to peer ${peerId}`);
        return true;
      } catch (error) {
        console.error(`[WebRTC] Failed to send to peer ${peerId}:`, error);
        return false;
      }
    }
    
    console.warn(`[WebRTC] Peer ${peerId} not ready for send:`, {
      exists: !!peer,
      connected: peer ? (peer as any).connected : 'N/A',
      destroyed: peer ? peer.destroyed : 'N/A',
      channelState: peer ? (peer as any)._channel?.readyState : 'N/A'
    });
    return false;
  }

  public getBufferedAmount(peerId: string): number | null {
    const peer = this.peers.get(peerId);
    const channel = (peer as any)?._channel;
    if (channel) {
      return channel.bufferedAmount || 0; // ✅ undefined 방지
    }
    return null;
  }
  
  // ✅ 개선된 버퍼 조회
  public getMaxBufferedAmount(): number {
    let maxBuffered = 0;
    
    for (const [peerId, peer] of this.peers.entries()) {
      const channel = (peer as any)?._channel;
      if (channel && typeof channel.bufferedAmount === 'number') {
        const amount = channel.bufferedAmount;
        maxBuffered = Math.max(maxBuffered, amount);
        
        // 경고 로그
        if (amount > 256 * 1024) {
          console.warn(`[WebRTC] High buffer for peer ${peerId}: ${(amount / 1024).toFixed(0)}KB`);
        }
      }
    }
    
    return maxBuffered;
  }

  // ✅ 버퍼 상태 모니터링
  public startBufferMonitoring(callback: (buffered: number) => void) {
    const interval = setInterval(() => {
      const buffered = this.getMaxBufferedAmount();
      callback(buffered);
    }, 200);

    return () => clearInterval(interval);
  }

  public getConnectedPeerIds(): string[] {
    return Array.from(this.peers.entries())
      .filter(([_, peer]) => (peer as any).connected && !peer.destroyed)
      .map(([peerId]) => peerId);
  }

  public destroyAll(): void {
    for (const peer of this.peers.values()) {
      if (!peer.destroyed) {
        peer.destroy();
      }
    }
    this.peers.clear();
  }

  public getCurrentOutboundTracks(): { video?: MediaStreamTrack; audio?: MediaStreamTrack } {
    let video: MediaStreamTrack | undefined;
    let audio: MediaStreamTrack | undefined;
    for (const [, peer] of this.peers.entries()) {
      const senders: RTCRtpSender[] = ((peer as any)._pc?.getSenders && (peer as any)._pc.getSenders()) || [];
      for (const s of senders) {
        if (!video && s.track && s.track.kind === 'video') video = s.track;
        if (!audio && s.track && s.track.kind === 'audio') audio = s.track;
      }
      if (video && audio) break;
    }
    if (!video && this.localStream) video = this.localStream.getVideoTracks()[0];
    if (!audio && this.localStream) audio = this.localStream.getAudioTracks()[0];
    return { video, audio };
  }

  public getMaxMessageSize(peerId: string): number | null {
    const peer = this.peers.get(peerId) as any;
    const pc = peer?._pc as RTCPeerConnection | undefined;
    const sctp = (pc as any)?.sctp as RTCSctpTransport | undefined;
    const value = (sctp as any)?.maxMessageSize;
    if (typeof value === 'number' && isFinite(value) && value > 0) return value;
    return null;
  }
}
