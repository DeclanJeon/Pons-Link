/**
 * @fileoverview WebRTC     
 * @module services/webrtc
 * @description simple-peer   Peer , ,
 *                ,     .
 */

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

/**
 * WebRTC     
 */
export class WebRTCManager {
  private peers: Map<string, PeerInstance> = new Map();
  private localStream: MediaStream | null;
  private events: WebRTCEvents;
  private iceServers: RTCIceServer[] = [];

  constructor(localStream: MediaStream | null, events: WebRTCEvents) {
    this.localStream = localStream;
    this.events = events;
    this.iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
    console.log('[WebRTC] Manager initialized');
  }

  public updateIceServers(servers: RTCIceServer[]): void {
    this.iceServers = servers;
    console.log('[WebRTC] ICE servers updated. Total servers:', servers.length);
  }

  public createPeer(peerId: string, initiator: boolean): PeerInstance {
    if (this.peers.has(peerId)) {
      this.removePeer(peerId);
    }

    const peerConfig: any = {
      initiator,
      trickle: true,
      config: { iceServers: this.iceServers },
      offerOptions: { offerToReceiveAudio: true, offerToReceiveVideo: true },
      stream: this.localStream || false,
    };

    const peer = new Peer(peerConfig);
    this.setupPeerEvents(peer, peerId);
    this.peers.set(peerId, peer);

    console.log(`[WebRTC] Peer created for ${peerId}, initiator: ${initiator}`);
    return peer;
  }

  private setupPeerEvents(peer: PeerInstance, peerId: string): void {
    peer.on('signal', (signal) => this.events.onSignal(peerId, signal));
    peer.on('connect', () => this.events.onConnect(peerId));
    peer.on('stream', (stream) => this.events.onStream(peerId, stream));
    peer.on('data', (data) => this.events.onData(peerId, data));
    peer.on('close', () => this.events.onClose(peerId));
    peer.on('error', (err) => this.events.onError(peerId, err));
  }

  public receiveSignal(peerId: string, signal: SignalData): void {
    const peer = this.peers.get(peerId);
    if (peer && !peer.destroyed) {
      peer.signal(signal);
    } else {
      console.warn(`[WebRTC] Peer not found or destroyed for signal from ${peerId}`);
    }
  }

  public async replaceTrack(oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack, stream: MediaStream): Promise<void> {
    for (const [peerId, peer] of this.peers.entries()) {
        try {
            if (peer && !peer.destroyed && typeof peer.replaceTrack === 'function') {
                await peer.replaceTrack(oldTrack, newTrack, stream);
            }
        } catch (error) {
            console.error(`[WebRTC] Failed to replace track for peer ${peerId}:`, error);
            (peer as any)._needsNegotiation = true;
            (peer as any)._onNegotiationNeeded();
        }
    }
  }

  public async replaceSenderTrack(kind: 'audio' | 'video', newTrack?: MediaStreamTrack): Promise<boolean> {
    let success = true;

    for (const [peerId, peer] of this.peers.entries()) {
      if (peer && !peer.destroyed) {
        try {
          const senders = (peer as any)._pc?.getSenders() || [];
          const sender = senders.find((s: RTCRtpSender) => s.track?.kind === kind);

          if (sender && newTrack) {
            // 기존 sender가 있고 새 트랙이 있으면 교체
            console.log(`[WebRTC] Replacing ${kind} track for peer ${peerId}`);
            await sender.replaceTrack(newTrack);
          } else if (!sender && newTrack) {
            // sender가 없고 새 트랙이 있으면 추가
            console.log(`[WebRTC] Adding new ${kind} track for peer ${peerId}`);
            // addTrack은 negotiation을 유발할 수 있으므로 주의
            peer.addTrack(newTrack, this.localStream || new MediaStream());
          } else if (sender && !newTrack) {
            // sender가 있고 새 트랙이 없으면 제거
            console.log(`[WebRTC] Removing ${kind} track for peer ${peerId}`);
            await sender.replaceTrack(null);
          }
          // sender가 없고 새 트랙도 없으면 아무것도 하지 않음

        } catch (error) {
          console.error(`[WebRTC] Failed to replace ${kind} track for peer ${peerId}:`, error);
          // 에러 발생 시 negotiation을 유도하여 연결을 복구하려 시도
          try {
            (peer as any)._needsNegotiation = true;
            (peer as any)._onNegotiationNeeded();
          } catch (negotiationError) {
            console.error(`[WebRTC] Negotiation failed for peer ${peerId}:`, negotiationError);
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

    console.log('[WebRTC] Replacing local stream:', {
      hasVideo: !!newVideoTrack,
      hasAudio: !!newAudioTrack,
      videoEnabled: newVideoTrack?.enabled,
      audioEnabled: newAudioTrack?.enabled,
      videoReadyState: newVideoTrack?.readyState,
      audioReadyState: newAudioTrack?.readyState
    });

    // 새 스트림에서 트랙들을 교체 (기존 replaceSenderTrack 사용)
    if (newVideoTrack && newVideoTrack.readyState === 'live') {
      const videoSuccess = await this.replaceSenderTrack('video', newVideoTrack);
      if (!videoSuccess) success = false;
    } else {
      // 비디오 트랙 제거
      const videoSuccess = await this.replaceSenderTrack('video', undefined);
      if (!videoSuccess) success = false;
    }

    if (newAudioTrack && newAudioTrack.readyState === 'live') {
      const audioSuccess = await this.replaceSenderTrack('audio', newAudioTrack);
      if (!audioSuccess) success = false;
    } else {
      // 오디오 트랙 제거
      const audioSuccess = await this.replaceSenderTrack('audio', undefined);
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
      console.log(`[WebRTC] Peer removed: ${peerId}`);
    }
  }

  public sendToAllPeers(message: any): { successful: string[], failed: string[] } {
    const successful: string[] = [];
    const failed: string[] = [];

    for (const [peerId, peer] of this.peers.entries()) {
      if (this.sendToPeer(peerId, message)) {
        successful.push(peerId);
      } else {
        failed.push(peerId);
      }
    }
    return { successful, failed };
  }

  public sendToPeer(peerId: string, message: any): boolean {
    const peer = this.peers.get(peerId);
    if (peer && peer.connected && !peer.destroyed) {
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
      return channel.bufferedAmount;
    }
    return null;
  }

  public getConnectedPeerIds(): string[] {
    return Array.from(this.peers.entries())
      .filter(([_, peer]) => peer.connected && !peer.destroyed)
      .map(([peerId, _]) => peerId);
  }

  public destroyAll(): void {
    for (const peer of this.peers.values()) {
      if (!peer.destroyed) {
        peer.destroy();
      }
    }
    this.peers.clear();
    console.log('[WebRTC] All peers destroyed');
  }
}
