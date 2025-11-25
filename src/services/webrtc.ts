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
    
    // 모바일 네트워크 변경 감지
    if (typeof window !== 'undefined') {
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (connection) {
        connection.addEventListener('change', () => {
          console.log(`[WebRTC] 📶 Network changed: ${connection.effectiveType}`);
          // 네트워크 변경 시 ICE restart 필요할 수 있음
        });
      }
      
      // 온라인/오프라인 이벤트
      window.addEventListener('online', () => {
        console.log('[WebRTC] 🌐 Network online');
      });
      
      window.addEventListener('offline', () => {
        console.log('[WebRTC] ⚠️ Network offline');
      });
    }
  }

  public updateIceServers(servers: RTCIceServer[]): void {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[WebRTC] 🔄 Updating ICE Servers');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Previous servers: ${this.iceServers.length}`);
    console.log(`New servers: ${servers.length}`);
    
    servers.forEach((server, index) => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      const hasTurn = urls.some(url => url.startsWith('turn:') || url.startsWith('turns:'));
      const hasStun = urls.some(url => url.startsWith('stun:'));
      console.log(`  [${index + 1}] ${hasTurn ? '🔄 TURN' : hasStun ? '🌐 STUN' : '❓'} Server`);
      urls.forEach(url => console.log(`    - ${url}`));
      if (server.username) console.log(`    👤 Username: ${server.username}`);
      if (server.credential) console.log(`    🔑 Credential: ✓ Present`);
    });
    
    this.iceServers = servers;
    
    if (this.peers.size > 0) {
      console.log(`[WebRTC] ℹ️ ${this.peers.size} existing peer(s) will use new ICE servers on next connection`);
    }
    
    console.log(`\n✅ ICE Servers updated successfully`);
    console.log(`Active peers: ${this.peers.size}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  public createPeer(peerId: string, initiator: boolean): PeerInstance {
    if (this.peers.has(peerId)) {
      this.removePeer(peerId);
    }
    
    // 모바일 디버깅을 위한 상세 정보
    const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`[WebRTC] 🔗 Creating Peer Connection`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Peer ID: ${peerId}`);
    console.log(`Role: ${initiator ? '📤 Initiator (Offer)' : '📥 Receiver (Answer)'}`);
    console.log(`Device: ${isMobileDevice ? '📱 Mobile' : '💻 Desktop'}`);
    console.log(`User Agent: ${navigator.userAgent}`);
    if (connection) {
      console.log(`Network: ${connection.effectiveType || 'unknown'} (${connection.downlink || 'unknown'} Mbps)`);
    }
    console.log(`ICE Servers configured: ${this.iceServers.length}`);
    
    const hasTurn = this.iceServers.some(server => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      return urls.some(url => url.startsWith('turn:') || url.startsWith('turns:'));
    });
    
    console.log(`TURN Server: ${hasTurn ? '✅ Configured' : '❌ Not configured (STUN only)'}`);
    
    if (hasTurn) {
      this.iceServers.forEach((server, index) => {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        const turnUrls = urls.filter(url => url.startsWith('turn:') || url.startsWith('turns:'));
        if (turnUrls.length > 0) {
          console.log(`  🔄 TURN [${index + 1}]:`);
          turnUrls.forEach(url => console.log(`    - ${url}`));
          if (server.username) console.log(`    👤 ${server.username}`);
        }
      });
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 모바일 최적화 설정
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    const peerConfig = {
      initiator,
      trickle: true,
      config: { 
        iceServers: this.iceServers,
        sdpSemantics: 'unified-plan' as const,
        iceCandidatePoolSize: isMobile ? 5 : 10, // 모바일은 리소스 절약
        iceTransportPolicy: 'all' as const, // 모든 candidate 타입 허용
        bundlePolicy: 'max-bundle' as const, // 대역폭 최적화
        rtcpMuxPolicy: 'require' as const // RTCP multiplexing 필수
      },
      offerOptions: { 
        offerToReceiveAudio: true, 
        offerToReceiveVideo: true,
        iceRestart: false // 초기 연결에서는 false
      },
      stream: this.localStream || false,
      channelConfig: { 
        ordered: true,
        maxRetransmits: isMobile ? 3 : 10 // 모바일은 재전송 제한
      }
    };
    
    const peer = new Peer(peerConfig);
    this.setupPeerEvents(peer, peerId);
    this.peers.set(peerId, peer);
    return peer;
  }

  private setupPeerEvents(peer: PeerInstance, peerId: string): void {
    // simple-peer의 signal 이벤트 - ICE candidates 포함
    peer.on('signal', (signal) => {
      const signalAny = signal as any;
      const signalType = signalAny.type || (signalAny.candidate ? 'candidate' : 'unknown');
      
      if (signalAny.candidate) {
        console.log(`[WebRTC] 🧊 Sending ICE candidate signal for ${peerId}`);
      }
      
      console.log(`[WebRTC] 📡 Signal generated for ${peerId}: type=${signalType}`);
      this.events.onSignal(peerId, signal);
    });
    
    peer.on('connect', () => {
      console.log(`[WebRTC] ✅ Peer connected: ${peerId}`);
      
      try {
        const ch: any = (peer as any)?._channel;
        if (ch && 'binaryType' in ch) ch.binaryType = 'arraybuffer';
      } catch {}
      
      this.events.onConnect(peerId);
    });
    
    peer.on('stream', (stream) => {
      console.log(`[WebRTC] 📺 Stream received from peer: ${peerId}`);
      this.events.onStream(peerId, stream);
    });
    
    peer.on('data', (data) => this.events.onData(peerId, data));
    
    peer.on('close', () => {
      console.log(`[WebRTC] 🔌 Peer disconnected: ${peerId}`);
      this.events.onClose(peerId);
    });
    
    peer.on('error', (err) => {
      console.error(`[WebRTC] ❌ Peer error (${peerId}):`, err);
      this.events.onError(peerId, err);
    });
    
    // RTCPeerConnection 이벤트 모니터링 (addEventListener 사용 - simple-peer 방해 안함)
    const pc = (peer as any)._pc as RTCPeerConnection;
    if (pc) {
      // ICE candidate 타입 통계
      const candidateStats = { host: 0, srflx: 0, relay: 0 };
      
      pc.addEventListener('icecandidate', (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate) {
          const type = (event.candidate as any).type || 'unknown';
          if (type === 'host') candidateStats.host++;
          else if (type === 'srflx') candidateStats.srflx++;
          else if (type === 'relay') candidateStats.relay++;
          
          console.log(`[WebRTC] 🧊 ICE Candidate (${peerId}): ${type} - Stats: host=${candidateStats.host}, srflx=${candidateStats.srflx}, relay=${candidateStats.relay}`);
        } else {
          console.log(`[WebRTC] 🏁 ICE Gathering complete (${peerId}) - Final: host=${candidateStats.host}, srflx=${candidateStats.srflx}, relay=${candidateStats.relay}`);
        }
      });
      
      pc.addEventListener('iceconnectionstatechange', () => {
        const state = pc.iceConnectionState;
        console.log(`[WebRTC] 🔄 ICE Connection State (${peerId}): ${state}`);
        
        if (state === 'connected' || state === 'completed') {
          console.log(`[WebRTC] ✅ ICE Connection Success (${peerId})`);
          
          // 성공한 candidate pair 정보 출력
          pc.getStats().then(stats => {
            stats.forEach(stat => {
              if (stat.type === 'candidate-pair' && (stat as any).state === 'succeeded') {
                console.log(`[WebRTC] 🎯 Successful pair: local=${(stat as any).localCandidateId}, remote=${(stat as any).remoteCandidateId}`);
              }
            });
          });
        } else if (state === 'failed') {
          console.error(`[WebRTC] ❌ ICE Connection FAILED (${peerId})`);
          
          // 실패 원인 분석
          pc.getStats().then(stats => {
            const pairs: any[] = [];
            stats.forEach(stat => {
              if (stat.type === 'candidate-pair') {
                pairs.push({
                  state: (stat as any).state,
                  nominated: (stat as any).nominated,
                  writable: (stat as any).writable
                });
              }
            });
            console.error(`[WebRTC] 📊 Candidate pairs: ${JSON.stringify(pairs)}`);
          });
        } else if (state === 'disconnected') {
          console.warn(`[WebRTC] ⚠️ ICE Connection DISCONNECTED (${peerId})`);
        }
      });
      
      pc.addEventListener('connectionstatechange', () => {
        console.log(`[WebRTC] 🔗 Connection State (${peerId}): ${pc.connectionState}`);
      });
      
      pc.addEventListener('signalingstatechange', () => {
        console.log(`[WebRTC] 📡 Signaling State (${peerId}): ${pc.signalingState}`);
      });
      
      pc.addEventListener('icegatheringstatechange', () => {
        console.log(`[WebRTC] 🔍 ICE Gathering State (${peerId}): ${pc.iceGatheringState}`);
      });
    }
  }

  public receiveSignal(peerId: string, signal: SignalData): void {
    const peer = this.peers.get(peerId);
    if (peer && !peer.destroyed) {
      const signalAny = signal as any;
      const signalType = signalAny.type || (signalAny.candidate ? 'candidate' : 'unknown');
      
      if (signalAny.candidate) {
        console.log(`[WebRTC] 🧊 Received ICE candidate signal for ${peerId}`);
      }
      
      console.log(`[WebRTC] 📥 Signal received for ${peerId}: type=${signalType}`);
      peer.signal(signal);
    } else {
      console.warn(`[WebRTC] ⚠️ Cannot process signal for ${peerId}: Peer not found or destroyed`);
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
          // Intentionally empty
        }
      }
    }
  }

  public async replaceSenderTrack(kind: 'audio' | 'video', newTrack?: MediaStreamTrack): Promise<boolean> {
    let success = true;
    for (const [, peer] of this.peers.entries()) {
      if (peer && !peer.destroyed) {
        try {
          const senders = ((peer as any)._pc?.getSenders && (peer as any)._pc.getSenders()) || [];
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
    
    for (const [peerId, peer] of this.peers.entries()) {
      try {
        if (peer && !peer.destroyed && (peer as any).connected && (peer as any)._channel?.readyState === 'open') {
          peer.send(message);
          successful.push(peerId);
        } else {
          failed.push(peerId);
        }
      } catch (error) {
        failed.push(peerId);
        console.error(`[WebRTC] Failed to send to peer ${peerId}:`, error);
      }
    }
    
    return { successful, failed };
  }

  public sendToPeer(peerId: string, message: any): boolean {
    const peer = this.peers.get(peerId);
    if (peer && !peer.destroyed && (peer as any).connected && (peer as any)._channel?.readyState === 'open') {
      try {
        peer.send(message);
        return true;
      } catch (error) {
        console.error(`[WebRTC] Failed to send to peer ${peerId}:`, error);
        return false;
      }
    }
    return false;
  }

  public getBufferedAmount(peerId: string): number | null {
    const peer = this.peers.get(peerId);
    const channel = (peer as any)?._channel;
    if (channel) {
      return channel.bufferedAmount || 0;
    }
    return null;
  }
  
  public getMaxBufferedAmount(): number {
    let maxBuffered = 0;
    
    for (const [peerId, peer] of this.peers.entries()) {
      const channel = (peer as any)?._channel;
      if (channel && typeof channel.bufferedAmount === 'number') {
        const amount = channel.bufferedAmount;
        maxBuffered = Math.max(maxBuffered, amount);
        
        if (amount > 256 * 1024) {
          console.warn(`[WebRTC] High buffer for peer ${peerId}: ${(amount / 1024).toFixed(0)}KB`);
        }
      }
    }
    
    return maxBuffered;
  }

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
