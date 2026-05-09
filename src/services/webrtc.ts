import Peer from 'simple-peer/simplepeer.min.js';
import type { Instance as PeerInstance, SignalData } from 'simple-peer';
import { getRealtimeChannelPolicy } from './realtimeTransport';
import type { RealtimeChannelName } from './realtimeTransport';

interface WebRTCEvents {
  onSignal: (peerId: string, signal: SignalData) => void;
  onConnect: (peerId: string) => void;
  onStream: (peerId: string, stream: MediaStream) => void;
  onData: (peerId: string, data: unknown) => void;
  onClose: (peerId: string) => void;
  onError: (peerId: string, error: Error) => void;
}

type RealtimePayload = Record<string, unknown>;
type RealtimeMessage = string | RealtimePayload;
type SignalInspection = Partial<SignalData> & { candidate?: unknown };
type NetworkInformationLike = EventTarget & {
  effectiveType?: string;
  downlink?: number;
};
type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformationLike;
  mozConnection?: NetworkInformationLike;
  webkitConnection?: NetworkInformationLike;
};
type SimplePeerInternals = PeerInstance & {
  connected?: boolean;
  _channel?: RTCDataChannel;
  _pc?: RTCPeerConnection;
  _needsNegotiation?: boolean;
  _onNegotiationNeeded?: () => void;
  replaceTrack?: (oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack, stream: MediaStream) => void | Promise<void>;
};
type RoutedMessage = string | ArrayBuffer | Uint8Array | RealtimePayload;
type CandidatePairStats = RTCStats & {
  state?: string;
  nominated?: boolean;
  writable?: boolean;
  localCandidateId?: string;
  remoteCandidateId?: string;
};
type RtpSendParametersWithDegradation = RTCRtpSendParameters & {
  degradationPreference?: 'maintain-framerate' | 'maintain-resolution' | 'balanced';
};

const DEFAULT_CAMERA_MAX_BITRATE = 2_500_000;
const DEFAULT_CAMERA_MAX_FRAMERATE = 30;

const getNetworkConnection = (): NetworkInformationLike | undefined => {
  const nav = navigator as NavigatorWithConnection;
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
};

const inspectSignal = (signal: SignalData): { type: string; hasCandidate: boolean } => {
  const candidateSignal = signal as SignalInspection;
  return {
    type: typeof candidateSignal.type === 'string' ? candidateSignal.type : candidateSignal.candidate ? 'candidate' : 'unknown',
    hasCandidate: Boolean(candidateSignal.candidate),
  };
};

const getPeerInternals = (peer: PeerInstance): SimplePeerInternals => peer as SimplePeerInternals;

export class WebRTCManager {
  private peers: Map<string, PeerInstance> = new Map();
  private dataChannels: Map<string, Map<RealtimeChannelName, RTCDataChannel>> = new Map();
  private localStream: MediaStream | null;
  private events: WebRTCEvents;
  private iceServers: RTCIceServer[] = [];
  private outboundSeq = 0;
  private readonly epoch: string;

  constructor(localStream: MediaStream | null, events: WebRTCEvents) {
    this.localStream = localStream;
    this.events = events;
    this.iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
    this.epoch = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    // 모바일 네트워크 변경 감지
    if (typeof window !== 'undefined') {
      const connection = getNetworkConnection();
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

  private wrapRealtimeMessage<T>(message: T): T | string | RealtimePayload {
    if (typeof message === 'string') {
      try {
        const parsed = JSON.parse(message);
        if (!parsed || typeof parsed !== 'object') {
          return message;
        }
        if ((parsed as { __rt?: string }).__rt === 'v1') {
          return message;
        }
        if (typeof (parsed as { type?: unknown }).type !== 'string') {
          return message;
        }

        const envelope = {
          __rt: 'v1',
          msgId: typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          seq: ++this.outboundSeq,
          epoch: this.epoch,
          sentAt: Date.now(),
          payload: parsed,
        };

        return JSON.stringify(envelope);
      } catch {
        return message;
      }
    }

    if (!message || typeof message !== 'object') {
      return message;
    }

    if ((message as { __rt?: string }).__rt === 'v1') {
      return message;
    }

    if (typeof (message as { type?: unknown }).type !== 'string') {
      return message;
    }

    return {
      __rt: 'v1',
      msgId: typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      seq: ++this.outboundSeq,
      epoch: this.epoch,
      sentAt: Date.now(),
      payload: message,
    };
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
    const connection = getNetworkConnection();
    
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
    this.setupPeerEvents(peer, peerId, initiator);
    this.peers.set(peerId, peer);
    return peer;
  }

  private setupPeerEvents(peer: PeerInstance, peerId: string, initiator: boolean): void {
    // simple-peer의 signal 이벤트 - ICE candidates 포함
    peer.on('signal', (signal) => {
      const { type: signalType, hasCandidate } = inspectSignal(signal);
      
      if (hasCandidate) {
        console.log(`[WebRTC] 🧊 Sending ICE candidate signal for ${peerId}`);
      }
      
      console.log(`[WebRTC] 📡 Signal generated for ${peerId}: type=${signalType}`);
      this.events.onSignal(peerId, signal);
    });
    
    peer.on('connect', () => {
      console.log(`[WebRTC] ✅ Peer connected: ${peerId}`);
      
      try {
        const ch = getPeerInternals(peer)._channel;
        if (ch && 'binaryType' in ch) ch.binaryType = 'arraybuffer';
      } catch (error) {
        console.warn('[WebRTC] Failed to configure data channel binaryType:', error);
      }
      this.ensureRealtimeDataChannels(peer, peerId, initiator);
      void this.applyOutboundEncodingParameters(peerId, peer);
      
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
    const pc = getPeerInternals(peer)._pc;
    if (pc) {
      // ICE candidate 타입 통계
      const candidateStats = { host: 0, srflx: 0, relay: 0 };
      
      pc.addEventListener('icecandidate', (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate) {
          const type = event.candidate.type || 'unknown';
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
              const pair = stat as CandidatePairStats;
              if (pair.type === 'candidate-pair' && pair.state === 'succeeded') {
                console.log(`[WebRTC] 🎯 Successful pair: local=${pair.localCandidateId}, remote=${pair.remoteCandidateId}`);
              }
            });
          });
        } else if (state === 'failed') {
          console.error(`[WebRTC] ❌ ICE Connection FAILED (${peerId})`);
          
          // 실패 원인 분석
          pc.getStats().then(stats => {
            const pairs: Array<{ state?: string; nominated?: boolean; writable?: boolean }> = [];
            stats.forEach(stat => {
              const pair = stat as CandidatePairStats;
              if (pair.type === 'candidate-pair') {
                pairs.push({
                  state: pair.state,
                  nominated: pair.nominated,
                  writable: pair.writable
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

      pc.addEventListener('datachannel', (event) => {
        this.registerRealtimeDataChannel(peerId, event.channel);
      });

      if (initiator) {
        this.ensureRealtimeDataChannels(peer, peerId, true);
      }
    }
  }

  private async applyOutboundEncodingParameters(peerId: string, peer: PeerInstance): Promise<void> {
    const pc = getPeerInternals(peer)._pc;
    if (!pc || pc.signalingState === 'closed') return;

    const videoSenders = pc.getSenders().filter((sender) => sender.track?.kind === 'video');
    for (const sender of videoSenders) {
      try {
        const parameters = sender.getParameters() as RtpSendParametersWithDegradation;
        parameters.encodings = parameters.encodings?.length ? parameters.encodings : [{}];
        parameters.encodings[0] = {
          ...parameters.encodings[0],
          maxBitrate: DEFAULT_CAMERA_MAX_BITRATE,
          maxFramerate: DEFAULT_CAMERA_MAX_FRAMERATE,
          scaleResolutionDownBy: parameters.encodings[0].scaleResolutionDownBy ?? 1,
        };
        parameters.degradationPreference = 'balanced';

        await sender.setParameters(parameters);
        console.log(`[WebRTC] Applied balanced video sender parameters for ${peerId}`, {
          maxBitrate: DEFAULT_CAMERA_MAX_BITRATE,
          maxFramerate: DEFAULT_CAMERA_MAX_FRAMERATE,
        });
      } catch (error) {
        console.warn(`[WebRTC] Unable to apply video sender parameters for ${peerId}:`, error);
      }
    }
  }

  private ensureRealtimeDataChannels(peer: PeerInstance, peerId: string, initiator: boolean): void {
    if (!initiator) return;

    const pc = getPeerInternals(peer)._pc;
    if (!pc || pc.signalingState === 'closed') return;

    const channels: RealtimeChannelName[] = ['control', 'text', 'whiteboard', 'file', 'media', 'diagnostics'];
    for (const channelName of channels) {
      if (this.getRealtimeDataChannel(peerId, channelName)) continue;

      try {
        const policy = getRealtimeChannelPolicy(channelName);
        const channel = pc.createDataChannel(`pons:${channelName}`, {
          ordered: policy.ordered,
          maxRetransmits: policy.maxRetransmits,
        });
        this.registerRealtimeDataChannel(peerId, channel, channelName);
      } catch (error) {
        console.warn(`[WebRTC] Failed to create ${channelName} data channel for ${peerId}:`, error);
      }
    }
  }

  private registerRealtimeDataChannel(
    peerId: string,
    channel: RTCDataChannel,
    fallbackName?: RealtimeChannelName,
  ): void {
    const channelName = this.normalizeRealtimeChannelLabel(channel.label, fallbackName);
    if (!channelName || channelName === 'legacy') return;

    channel.binaryType = 'arraybuffer';
    const peerChannels = this.getOrCreatePeerDataChannels(peerId);
    peerChannels.set(channelName, channel);

    channel.onmessage = (event) => this.events.onData(peerId, event.data);
    channel.onclose = () => {
      const current = this.dataChannels.get(peerId)?.get(channelName);
      if (current === channel) this.dataChannels.get(peerId)?.delete(channelName);
    };
    channel.onerror = (event) => {
      console.warn(`[WebRTC] ${channelName} data channel error (${peerId}):`, event);
    };
  }

  private normalizeRealtimeChannelLabel(
    label: string,
    fallbackName?: RealtimeChannelName,
  ): RealtimeChannelName | null {
    if (fallbackName) return fallbackName;
    if (!label.startsWith('pons:')) return null;

    const channelName = label.slice('pons:'.length);
    if (
      channelName === 'control' ||
      channelName === 'text' ||
      channelName === 'whiteboard' ||
      channelName === 'file' ||
      channelName === 'media' ||
      channelName === 'diagnostics'
    ) {
      return channelName;
    }

    return null;
  }

  private getOrCreatePeerDataChannels(peerId: string): Map<RealtimeChannelName, RTCDataChannel> {
    let peerChannels = this.dataChannels.get(peerId);
    if (!peerChannels) {
      peerChannels = new Map();
      this.dataChannels.set(peerId, peerChannels);
    }
    return peerChannels;
  }

  private getRealtimeDataChannel(peerId: string, channelName: RealtimeChannelName): RTCDataChannel | undefined {
    const channel = this.dataChannels.get(peerId)?.get(channelName);
    return channel?.readyState === 'open' ? channel : undefined;
  }

  private getSendChannel(peerId: string, peer: PeerInstance, message: RoutedMessage): RTCDataChannel | undefined {
    const preferred = this.classifyRealtimeChannel(message);
    const channel = this.getRealtimeDataChannel(peerId, preferred);
    if (channel) return channel;

    const legacyChannel = getPeerInternals(peer)._channel;
    return legacyChannel?.readyState === 'open' ? legacyChannel : undefined;
  }

  private toDataChannelPayload(message: RoutedMessage): string | ArrayBuffer | ArrayBufferView | Blob {
    if (typeof message === 'string' || message instanceof ArrayBuffer || ArrayBuffer.isView(message)) {
      return message;
    }

    return JSON.stringify(message);
  }

  private classifyRealtimeChannel(message: RoutedMessage): RealtimeChannelName {
    const binaryType = this.getBinaryPacketType(message);
    if (binaryType === 9) return 'media';
    if (binaryType === 1 || binaryType === 2) return 'file';

    const type = this.getMessageType(message);
    if (!type) return 'legacy';
    if (type === 'text' || type === 'gif' || type.startsWith('cowatch-')) return 'text';
    if (type === 'meeting-minutes-state') return 'control';
    if (type === 'meeting-minutes-caption') return 'text';
    if (type.startsWith('whiteboard-')) return 'whiteboard';
    if (type.startsWith('file-') || type === 'request-missing-chunk') return 'file';
    if (type.startsWith('subtitle-')) return 'file';
    if (
      type === 'device-metadata' ||
      type === 'participant-profile' ||
      type === 'screen-share-state' ||
      type === 'clickcap-capture-state' ||
      type === 'file-streaming-state'
    ) {
      return 'control';
    }

    return 'legacy';
  }

  private getMessageType(message: RoutedMessage): string | null {
    if (typeof message === 'string') {
      try {
        const parsed = JSON.parse(message);
        const payload = parsed?.__rt === 'v1' && parsed?.payload ? parsed.payload : parsed;
        return typeof payload?.type === 'string' ? payload.type : null;
      } catch {
        return null;
      }
    }

    if (message && typeof message === 'object' && !(message instanceof ArrayBuffer) && !ArrayBuffer.isView(message)) {
      const payload = (message as { __rt?: string; payload?: unknown }).__rt === 'v1'
        ? (message as { payload?: unknown }).payload
        : message;
      return typeof (payload as { type?: unknown })?.type === 'string'
        ? String((payload as { type: string }).type)
        : null;
    }

    return null;
  }

  private getBinaryPacketType(message: RoutedMessage): number | null {
    if (message instanceof ArrayBuffer) {
      return message.byteLength > 0 ? new Uint8Array(message)[0] : null;
    }

    if (message instanceof Uint8Array) {
      return message.byteLength > 0 ? message[0] : null;
    }

    return null;
  }

  public receiveSignal(peerId: string, signal: SignalData): void {
    const peer = this.peers.get(peerId);
    if (peer && !peer.destroyed) {
      const { type: signalType, hasCandidate } = inspectSignal(signal);
      
      if (hasCandidate) {
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
        const peerInternals = getPeerInternals(peer);
        if (peer && !peer.destroyed && typeof peerInternals.replaceTrack === 'function') {
          await peerInternals.replaceTrack(oldTrack, newTrack, stream);
        }
      } catch {
        try {
          const peerInternals = getPeerInternals(peer);
          peerInternals._needsNegotiation = true;
          peerInternals._onNegotiationNeeded?.();
        } catch {
          // Intentionally empty
        }
      }
    }
  }

  public async replaceSenderTrack(kind: 'audio' | 'video', newTrack?: MediaStreamTrack): Promise<boolean> {
    let success = true;
    for (const [peerId, peer] of this.peers.entries()) {
      if (peer && !peer.destroyed) {
        try {
          const pc = getPeerInternals(peer)._pc;
          const senders = pc?.getSenders() ?? [];
          const sender = senders.find((s: RTCRtpSender) => s.track?.kind === kind);
          if (sender && newTrack) {
            await sender.replaceTrack(newTrack);
            if (kind === 'video') {
              await this.applyOutboundEncodingParameters(peerId, peer);
            }
          } else if (!sender && newTrack) {
            peer.addTrack(newTrack, this.localStream || new MediaStream());
            if (kind === 'video') {
              await this.applyOutboundEncodingParameters(peerId, peer);
            }
          } else if (sender && !newTrack) {
            await sender.replaceTrack(null);
          }
        } catch {
          try {
            const peerInternals = getPeerInternals(peer);
            peerInternals._needsNegotiation = true;
            peerInternals._onNegotiationNeeded?.();
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
      this.dataChannels.delete(peerId);
    }
  }

  public sendToAllPeers(message: unknown): { successful: string[]; failed: string[] } {
    const successful: string[] = [];
    const failed: string[] = [];
    const outboundMessage = this.wrapRealtimeMessage(message) as RoutedMessage;
    
    for (const [peerId, peer] of this.peers.entries()) {
      try {
        const peerInternals = getPeerInternals(peer);
        const channel = this.getSendChannel(peerId, peer, outboundMessage);
        if (peer && !peer.destroyed && peerInternals.connected && channel) {
          channel.send(this.toDataChannelPayload(outboundMessage));
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

  public sendToPeer(peerId: string, message: unknown): boolean {
    const peer = this.peers.get(peerId);
    const peerInternals = peer ? getPeerInternals(peer) : null;
    const outboundMessage = this.wrapRealtimeMessage(message) as RoutedMessage;
    const channel = peer ? this.getSendChannel(peerId, peer, outboundMessage) : undefined;
    if (peer && !peer.destroyed && peerInternals?.connected && channel) {
      try {
        channel.send(this.toDataChannelPayload(outboundMessage));
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
    const channel = peer ? getPeerInternals(peer)._channel : undefined;
    const routedChannels = this.dataChannels.get(peerId);
    let total = 0;
    let hasChannel = false;
    if (routedChannels) {
      for (const routedChannel of routedChannels.values()) {
        total += routedChannel.bufferedAmount || 0;
        hasChannel = true;
      }
    }
    if (channel) {
      return total + (channel.bufferedAmount || 0);
    }
    return hasChannel ? total : null;
  }
  
  public getMaxBufferedAmount(): number {
    let maxBuffered = 0;
    
    for (const [peerId, peer] of this.peers.entries()) {
      const channel = getPeerInternals(peer)._channel;
      if (channel && typeof channel.bufferedAmount === 'number') {
        const amount = channel.bufferedAmount;
        maxBuffered = Math.max(maxBuffered, amount);
        
        if (amount > 256 * 1024) {
          console.warn(`[WebRTC] High buffer for peer ${peerId}: ${(amount / 1024).toFixed(0)}KB`);
        }
      }
      const routedChannels = this.dataChannels.get(peerId);
      if (routedChannels) {
        for (const [channelName, routedChannel] of routedChannels.entries()) {
          const amount = routedChannel.bufferedAmount || 0;
          maxBuffered = Math.max(maxBuffered, amount);

          if (amount > 256 * 1024) {
            console.warn(`[WebRTC] High ${channelName} buffer for peer ${peerId}: ${(amount / 1024).toFixed(0)}KB`);
          }
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
      .filter(([, peer]) => Boolean(getPeerInternals(peer).connected) && !peer.destroyed)
      .map(([peerId]) => peerId);
  }

  public destroyAll(): void {
    for (const peer of this.peers.values()) {
      if (!peer.destroyed) {
        peer.destroy();
      }
    }
    this.peers.clear();
    this.dataChannels.clear();
  }

  public getCurrentOutboundTracks(): { video?: MediaStreamTrack; audio?: MediaStreamTrack } {
    let video: MediaStreamTrack | undefined;
    let audio: MediaStreamTrack | undefined;
    for (const [, peer] of this.peers.entries()) {
      const senders = getPeerInternals(peer)._pc?.getSenders() ?? [];
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
    const peer = this.peers.get(peerId);
    const pc = peer ? getPeerInternals(peer)._pc : undefined;
    const value = pc?.sctp?.maxMessageSize;
    if (typeof value === 'number' && isFinite(value) && value > 0) return value;
    return null;
  }
}
