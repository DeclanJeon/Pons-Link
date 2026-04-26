import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLICKCAP_BRIDGE_PROTOCOL,
  prepareClickCapCapture,
  isClickCapInstalled,
  startClickCapCapture,
  subscribeToClickCapCaptureStream,
} from './clickcapBridge';

describe('clickcapBridge', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves installed when the ClickCap content script replies to ping', async () => {
    let postedMessage: unknown;
    vi.spyOn(window, 'postMessage').mockImplementation((message) => {
      postedMessage = message;
    });

    const installed = isClickCapInstalled({ timeoutMs: 50 });
    const request = postedMessage as { requestId: string; action: string };

    window.dispatchEvent(new MessageEvent('message', {
      data: {
        source: 'clickcap-extension',
        target: 'pons-link',
        protocol: CLICKCAP_BRIDGE_PROTOCOL,
        version: 1,
        type: 'PONS_CLICKCAP_RESPONSE',
        requestId: request.requestId,
        action: 'ping',
        ok: true,
        payload: { installed: true, extensionVersion: '1.0.1' },
      },
    }));

    await expect(installed).resolves.toBe(true);
    expect(request.action).toBe('ping');
  });

  it('resolves not installed when ping times out', async () => {
    vi.spyOn(window, 'postMessage').mockImplementation(() => {});

    await expect(isClickCapInstalled({ timeoutMs: 1 })).resolves.toBe(false);
  });

  it('starts ClickCap capture when the extension replies successfully', async () => {
    let postedMessage: unknown;
    vi.spyOn(window, 'postMessage').mockImplementation((message) => {
      postedMessage = message;
    });

    const started = startClickCapCapture({ mode: 'area', timeoutMs: 50 });
    const request = postedMessage as { requestId: string; action: string; payload: { mode: string } };

    window.dispatchEvent(new MessageEvent('message', {
      data: {
        source: 'clickcap-extension',
        target: 'pons-link',
        protocol: CLICKCAP_BRIDGE_PROTOCOL,
        version: 1,
        type: 'PONS_CLICKCAP_RESPONSE',
        requestId: request.requestId,
        action: 'start-capture',
        ok: true,
        payload: { started: true, streamId: 'stream-123' },
      },
    }));

    await expect(started).resolves.toEqual({ success: true, streamId: 'stream-123' });
    expect(request.action).toBe('start-capture');
    expect(request.payload.mode).toBe('area');
  });

  it('registers capture host when prepare request succeeds', async () => {
    let postedMessage: unknown;
    vi.spyOn(window, 'postMessage').mockImplementation((message) => {
      postedMessage = message;
    });

    const prepared = prepareClickCapCapture();
    const request = postedMessage as { requestId: string; action: string; payload: { roomHint: string } };

    window.dispatchEvent(new MessageEvent('message', {
      data: {
        source: 'clickcap-extension',
        target: 'pons-link',
        protocol: CLICKCAP_BRIDGE_PROTOCOL,
        version: 1,
        type: 'PONS_CLICKCAP_RESPONSE',
        requestId: request.requestId,
        action: 'prepare-capture',
        ok: true,
      },
    }));

    await expect(prepared).resolves.toEqual({ success: true, requestId: request.requestId });
    expect(request.action).toBe('prepare-capture');
  });

  it('notifies stream capture readiness via window message event', async () => {
    const readyHandler = vi.fn();

    const unsubscribe = subscribeToClickCapCaptureStream({
      onStreamReady: readyHandler,
    });

    window.dispatchEvent(new MessageEvent('message', {
      data: {
        source: 'clickcap-extension',
        target: 'pons-link',
        protocol: CLICKCAP_BRIDGE_PROTOCOL,
        version: 1,
        type: 'PONS_CLICKCAP_EVENT',
        event: 'attach-stream',
        requestId: 'request-1',
        payload: {
          streamId: 'stream-123',
          cropArea: { x: 10, y: 20, width: 640, height: 360 },
          view: { viewportWidth: 1280, viewportHeight: 720 },
        },
      },
    }));

    expect(readyHandler).toHaveBeenCalledWith({
      requestId: 'request-1',
      streamId: 'stream-123',
      cropArea: { x: 10, y: 20, width: 640, height: 360 },
      view: { viewportWidth: 1280, viewportHeight: 720 },
    });
    unsubscribe();
  });

  it('notifies stream stop events via window message event', async () => {
    const stopHandler = vi.fn();

    const unsubscribe = subscribeToClickCapCaptureStream({
      onStreamReady: vi.fn(),
      onStreamStopped: stopHandler,
    });

    window.dispatchEvent(new MessageEvent('message', {
      data: {
        source: 'clickcap-extension',
        target: 'pons-link',
        protocol: CLICKCAP_BRIDGE_PROTOCOL,
        version: 1,
        type: 'PONS_CLICKCAP_EVENT',
        event: 'stop-stream',
        requestId: 'request-1',
      },
    }));

    expect(stopHandler).toHaveBeenCalledWith({ requestId: 'request-1' });
    unsubscribe();
  });

  it('ignores mismatched response ids and fails on timeout', async () => {
    vi.spyOn(window, 'postMessage').mockImplementation(() => {});

    const started = startClickCapCapture({ mode: 'area', timeoutMs: 1 });

    window.dispatchEvent(new MessageEvent('message', {
      data: {
        source: 'clickcap-extension',
        target: 'pons-link',
        protocol: CLICKCAP_BRIDGE_PROTOCOL,
        version: 1,
        type: 'PONS_CLICKCAP_RESPONSE',
        requestId: 'different-request',
        action: 'start-capture',
        ok: true,
      },
    }));

    await expect(started).resolves.toEqual({ success: false, error: 'ClickCap extension did not respond' });
  });
});
