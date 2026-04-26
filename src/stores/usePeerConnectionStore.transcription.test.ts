import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enableMapSet } from 'immer';
import { usePeerConnectionStore } from './usePeerConnectionStore';

enableMapSet();

const managerInstances: Array<{ events: { onData: (peerId: string, data: unknown) => void } }> = [];

const createPeerMock = vi.fn();

vi.mock('@/services/webrtc', () => ({
  WebRTCManager: vi.fn(function MockWebRTCManager(_stream: MediaStream, events: { onData: (peerId: string, data: unknown) => void }) {
    managerInstances.push({ events });
    return {
      sendToAllPeers: vi.fn(() => ({ successful: [], failed: [] })),
      sendToPeer: vi.fn(() => true),
      createPeer: createPeerMock,
      receiveSignal: vi.fn(),
      removePeer: vi.fn(),
      updateIceServers: vi.fn(),
      destroyAll: vi.fn(),
    };
  }),
}));

vi.mock('./useSignalingStore', () => ({
  useSignalingStore: { getState: () => ({ sendSignal: vi.fn() }) },
}));

vi.mock('./useChatStore', () => ({
  useChatStore: { getState: () => ({ addMessage: vi.fn(), addFileMessage: vi.fn(), handleFileCancel: vi.fn(), handleIncomingChunk: vi.fn(), initializedTransfers: new Set() }) },
}));

vi.mock('./useSessionStore', () => ({
  useSessionStore: { getState: () => ({ userId: 'local-user' }) },
}));

vi.mock('./useWhiteboardStore', () => ({
  useWhiteboardStore: { getState: () => ({ addOperation: vi.fn(), clearOperations: vi.fn(), removeOperation: vi.fn(), updateOperation: vi.fn(), setBackground: vi.fn(), setRemoteViewport: vi.fn() }) },
}));

vi.mock('./useSubtitleStore', () => ({
  useSubtitleStore: { getState: () => ({ receiveTrackMeta: vi.fn(), receiveTrackChunk: vi.fn(), receiveSubtitleState: vi.fn(), receiveSubtitleSync: vi.fn(), receiveRemoteEnable: vi.fn() }) },
}));

vi.mock('./useDeviceMetadataStore', () => ({
  useDeviceMetadataStore: { getState: () => ({ broadcastMetadata: vi.fn(), updateRemoteMetadata: vi.fn() }) },
}));

vi.mock('@/stores/useParticipantProfileStore', () => ({
  useParticipantProfileStore: { getState: () => ({ broadcastLocalProfile: vi.fn(), updateRemoteProfile: vi.fn(), removeRemoteProfile: vi.fn() }) },
}));

vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

describe('usePeerConnectionStore transcription datachannel routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    managerInstances.length = 0;
    usePeerConnectionStore.setState({
      webRTCManager: null,
      peers: new Map(),
      activeTransfers: new Map(),
      originalStream: null,
      initializedTransfers: new Set(),
    });
  });

  it('does not recreate an in-flight peer when duplicate signaling events arrive for the same user', () => {
    const onData = vi.fn();
    const stream = { getTracks: () => [] } as unknown as MediaStream;
    usePeerConnectionStore.getState().initialize(stream, { onData });

    usePeerConnectionStore.getState().createPeer('peer-1', 'Peer One', true);
    usePeerConnectionStore.getState().createPeer('peer-1', 'Peer One', false);

    expect(createPeerMock).toHaveBeenCalledTimes(1);
    expect(usePeerConnectionStore.getState().peers.get('peer-1')?.connectionState).toBe('connecting');
  });

  it('forwards binary JSON transcription messages as text so RoomOrchestrator can receive captions', async () => {
    const onData = vi.fn();
    const stream = { getTracks: () => [] } as unknown as MediaStream;
    usePeerConnectionStore.getState().initialize(stream, { onData });

    const transcriptionMessage = JSON.stringify({
      __rt: 'v1',
      msgId: 'msg-1',
      seq: 1,
      epoch: 'epoch-1',
      sentAt: Date.now(),
      payload: {
        type: 'transcription',
        payload: { text: '원격 자막', isFinal: false, lang: 'ko-KR', provider: 'azure' },
      },
    });

    managerInstances[0].events.onData('peer-1', new TextEncoder().encode(transcriptionMessage));
    await Promise.resolve();

    expect(onData).toHaveBeenCalledWith('peer-1', transcriptionMessage);
  });
});
