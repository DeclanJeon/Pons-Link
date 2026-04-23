import { beforeEach, describe, expect, it, vi } from 'vitest';

const { socketHandlers, emitMock, disconnectMock, socketMock, ioMock } = vi.hoisted(() => {
  const handlers = new Map<string, (...args: any[]) => void>();
  const emit = vi.fn();
  const disconnect = vi.fn();
  const socket = {
    connected: true,
    emit,
    disconnect,
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      handlers.set(event, handler);
      return socket;
    }),
  };

  return {
    socketHandlers: handlers,
    emitMock: emit,
    disconnectMock: disconnect,
    socketMock: socket,
    ioMock: vi.fn(() => socket),
  };
});

vi.mock('socket.io-client', () => ({
  io: ioMock,
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('./usePeerConnectionStore', () => ({
  usePeerConnectionStore: {
    getState: () => ({
      webRTCManager: null,
    }),
  },
}));

vi.mock('./useRelayStore', () => ({
  useRelayStore: {
    getState: () => ({
      handleIncomingRequest: vi.fn(),
      handleRoomList: vi.fn(),
      handleRelayResponse: vi.fn(),
      handleRelaySignal: vi.fn(),
      handleRelayTermination: vi.fn(),
      handleFeedback: vi.fn(),
      handleRetransmitRequest: vi.fn(),
      handleRetransmitResponse: vi.fn(),
      handleBrokerRequestDirect: vi.fn(),
    }),
  },
}));

import { useSignalingStore } from './useSignalingStore';

const buildEvents = () => ({
  onConnect: vi.fn(),
  onDisconnect: vi.fn(),
  onRoomUsers: vi.fn(),
  onUserJoined: vi.fn(),
  onUserLeft: vi.fn(),
  onRoomFull: vi.fn(),
  onSignal: vi.fn(),
  onMediaState: vi.fn(),
  onChatMessage: vi.fn(),
  onData: vi.fn(),
});

describe('useSignalingStore join-room payload', () => {
  beforeEach(() => {
    socketHandlers.clear();
    emitMock.mockReset();
    disconnectMock.mockReset();
    ioMock.mockClear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/room/test-room?type=video-one-to-one');
    useSignalingStore.setState({
      socket: null,
      status: 'disconnected',
      iceServers: null,
      iceServersReady: false,
      lastSeenSeq: 0,
    });
  });

  it('maps a room token query param onto join-room.sessionToken', () => {
    const events = buildEvents();
    window.history.replaceState({}, '', '/room/test-room?type=video-one-to-one&token=claim-token-123');

    useSignalingStore.getState().connect(
      'room-1',
      'user-1',
      'Host One',
      events,
      'video-one-to-one',
    );

    const onConnect = socketHandlers.get('connect');
    expect(onConnect).toBeTypeOf('function');

    onConnect?.();

    expect(emitMock).toHaveBeenCalledWith('join-room', {
      roomId: 'room-1',
      userId: 'user-1',
      nickname: 'Host One',
      roomType: 'video-one-to-one',
      sessionToken: 'claim-token-123',
    });
  });

  it('omits sessionToken in join-room when it is not available', () => {
    const events = buildEvents();

    useSignalingStore.getState().connect(
      'room-2',
      'user-2',
      'Guest Two',
      events,
      'audio-one-to-one',
    );

    const onConnect = socketHandlers.get('connect');
    expect(onConnect).toBeTypeOf('function');

    onConnect?.();

    expect(emitMock).toHaveBeenCalledWith('join-room', {
      roomId: 'room-2',
      userId: 'user-2',
      nickname: 'Guest Two',
      roomType: 'audio-one-to-one',
    });
  });
});
