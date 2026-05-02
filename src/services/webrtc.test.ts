import { beforeEach, describe, expect, it, vi } from 'vitest';

type HandlerMap = Record<string, Array<(...args: unknown[]) => void>>;

class FakeDataChannel {
  binaryType: BinaryType = 'blob';
  readyState: RTCDataChannelState = 'open';
  onmessage: ((this: RTCDataChannel, ev: MessageEvent) => unknown) | null = null;
  onclose: ((this: RTCDataChannel, ev: Event) => unknown) | null = null;
  onerror: ((this: RTCDataChannel, ev: Event) => unknown) | null = null;
  sent: unknown[] = [];

  constructor(readonly label: string) {}

  send(payload: unknown) {
    this.sent.push(payload);
  }
}

const fakePeers: FakePeer[] = [];

class FakePeer {
  destroyed = false;
  connected = true;
  handlers: HandlerMap = {};
  _channel = new FakeDataChannel('simple-peer-default');
  _pc = {
    signalingState: 'stable',
    sctp: { maxMessageSize: 262144 },
    createDataChannel: (label: string) => {
      const channel = new FakeDataChannel(label);
      this.createdChannels.set(label, channel);
      return channel;
    },
    addEventListener: vi.fn(),
    getSenders: () => [],
    getStats: () => Promise.resolve(new Map()),
  };
  createdChannels = new Map<string, FakeDataChannel>();

  constructor() {
    fakePeers.push(this);
  }

  on(eventName: string, handler: (...args: unknown[]) => void) {
    this.handlers[eventName] ??= [];
    this.handlers[eventName].push(handler);
  }

  emit(eventName: string, ...args: unknown[]) {
    for (const handler of this.handlers[eventName] ?? []) {
      handler(...args);
    }
  }

  signal() {}

  send(payload: unknown) {
    this._channel.send(payload);
  }

  destroy() {
    this.destroyed = true;
  }
}

vi.mock('simple-peer/simplepeer.min.js', () => ({
  default: FakePeer,
}));

describe('WebRTCManager realtime channel routing', () => {
  beforeEach(() => {
    fakePeers.length = 0;
  });

  it('routes whiteboard traffic to the whiteboard data channel', async () => {
    const { WebRTCManager } = await import('./webrtc');
    const manager = new WebRTCManager(null, {
      onSignal: vi.fn(),
      onConnect: vi.fn(),
      onStream: vi.fn(),
      onData: vi.fn(),
      onClose: vi.fn(),
      onError: vi.fn(),
    });

    manager.createPeer('peer-1', true);
    fakePeers[0].emit('connect');

    manager.sendToAllPeers(JSON.stringify({
      type: 'whiteboard-operation',
      payload: { id: 'op-1' },
    }));

    const whiteboardChannel = fakePeers[0].createdChannels.get('pons:whiteboard');
    expect(whiteboardChannel?.sent).toHaveLength(1);
    expect(fakePeers[0]._channel.sent).toHaveLength(0);
  });

  it('routes PonsCast binary frames to the media data channel', async () => {
    const { WebRTCManager } = await import('./webrtc');
    const manager = new WebRTCManager(null, {
      onSignal: vi.fn(),
      onConnect: vi.fn(),
      onStream: vi.fn(),
      onData: vi.fn(),
      onClose: vi.fn(),
      onError: vi.fn(),
    });
    const frame = new Uint8Array([9, 1, 2, 3]);

    manager.createPeer('peer-1', true);
    fakePeers[0].emit('connect');
    manager.sendToAllPeers(frame);

    const mediaChannel = fakePeers[0].createdChannels.get('pons:media');
    expect(mediaChannel?.sent[0]).toBe(frame);
    expect(fakePeers[0]._channel.sent).toHaveLength(0);
  });

  it('falls back to the legacy simple-peer data channel for unknown traffic', async () => {
    const { WebRTCManager } = await import('./webrtc');
    const manager = new WebRTCManager(null, {
      onSignal: vi.fn(),
      onConnect: vi.fn(),
      onStream: vi.fn(),
      onData: vi.fn(),
      onClose: vi.fn(),
      onError: vi.fn(),
    });

    manager.createPeer('peer-1', true);
    fakePeers[0].emit('connect');
    manager.sendToAllPeers('not-json');

    expect(fakePeers[0]._channel.sent).toEqual(['not-json']);
  });
});
