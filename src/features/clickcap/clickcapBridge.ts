export const CLICKCAP_BRIDGE_PROTOCOL = 'pons-clickcap';

type ClickCapAction = 'ping' | 'start-capture' | 'prepare-capture';
type ClickCapMode = 'area' | 'full-screen';

type ClickCapBridgeRequest = {
  source: 'pons-link';
  target: 'clickcap-extension';
  protocol: typeof CLICKCAP_BRIDGE_PROTOCOL;
  version: 1;
  type: 'PONS_CLICKCAP_REQUEST';
  requestId: string;
  action: ClickCapAction;
  payload?: Record<string, unknown>;
};

type ClickCapBridgeResponse = {
  source: 'clickcap-extension';
  target: 'pons-link';
  protocol: typeof CLICKCAP_BRIDGE_PROTOCOL;
  version: 1;
  type: 'PONS_CLICKCAP_RESPONSE';
  requestId: string;
  action: ClickCapAction;
  ok: boolean;
  payload?: Record<string, unknown>;
  error?: string;
};

type ClickCapBridgeEvent = {
  source: 'clickcap-extension';
  target: 'pons-link';
  protocol: typeof CLICKCAP_BRIDGE_PROTOCOL;
  version: 1;
  type: 'PONS_CLICKCAP_EVENT';
  requestId?: string;
  event: 'attach-stream' | 'stop-stream';
  payload?: {
    streamId?: string;
    cropArea?: ClickCapCropArea;
    view?: ClickCapViewContext;
    roomHint?: string;
    sourceTabId?: number;
  };
};

export type StartClickCapCaptureResult =
  | { success: true; streamId?: string }
  | { success: false; error: string };

export type PrepareClickCapCaptureResult =
  | { success: true; requestId: string }
  | { success: false; error: string };

export type ClickCapStreamReadyHandler = (info: {
  requestId?: string;
  streamId: string;
  cropArea?: ClickCapCropArea;
  view?: ClickCapViewContext;
}) => void;

export type ClickCapStreamStopHandler = (info: {
  requestId?: string;
}) => void;

export type ClickCapCropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ClickCapViewContext = {
  viewportWidth: number;
  viewportHeight: number;
  dpr?: number;
  scrollX?: number;
  scrollY?: number;
  vvScale?: number;
  vvOffsetLeft?: number;
  vvOffsetTop?: number;
  vvWidth?: number;
  vvHeight?: number;
};

const createRequestId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const isClickCapResponse = (value: unknown): value is ClickCapBridgeResponse => {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<ClickCapBridgeResponse>;
  return data.source === 'clickcap-extension'
    && data.target === 'pons-link'
    && data.protocol === CLICKCAP_BRIDGE_PROTOCOL
    && data.version === 1
    && data.type === 'PONS_CLICKCAP_RESPONSE'
    && typeof data.requestId === 'string';
};

const isClickCapEvent = (value: unknown): value is ClickCapBridgeEvent => {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<ClickCapBridgeEvent>;
  return data.source === 'clickcap-extension'
    && data.target === 'pons-link'
    && data.protocol === CLICKCAP_BRIDGE_PROTOCOL
    && data.version === 1
    && data.type === 'PONS_CLICKCAP_EVENT'
    && (data.event === 'attach-stream' || data.event === 'stop-stream');
};

const requestClickCapWithId = ({
  action,
  payload,
  timeoutMs,
}: {
  action: ClickCapAction;
  payload?: Record<string, unknown>;
  timeoutMs: number;
}): { requestId: string; response: Promise<ClickCapBridgeResponse | null> } => {
  if (typeof window === 'undefined') {
    return { requestId: '', response: Promise.resolve(null) };
  }

  const requestId = createRequestId();

  const response = new Promise<ClickCapBridgeResponse | null>((resolve) => {
    let settled = false;
    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      window.clearTimeout(timeout);
    };
    const finish = (result: ClickCapBridgeResponse | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    const handleMessage = (event: MessageEvent) => {
      if (!isClickCapResponse(event.data)) return;
      if (event.data.requestId !== requestId || event.data.action !== action) return;
      finish(event.data);
    };

    const timeout = window.setTimeout(() => finish(null), timeoutMs);
    window.addEventListener('message', handleMessage);

    const request: ClickCapBridgeRequest = {
      source: 'pons-link',
      target: 'clickcap-extension',
      protocol: CLICKCAP_BRIDGE_PROTOCOL,
      version: 1,
      type: 'PONS_CLICKCAP_REQUEST',
      requestId,
      action,
      payload,
    };

    window.postMessage(request, window.location.origin);
  });

  return { requestId, response };
};

const requestClickCap = (params: {
  action: ClickCapAction;
  payload?: Record<string, unknown>;
  timeoutMs: number;
}): Promise<ClickCapBridgeResponse | null> => {
  return requestClickCapWithId(params).response;
};

export const isClickCapInstalled = async ({ timeoutMs = 700 }: { timeoutMs?: number } = {}): Promise<boolean> => {
  const response = await requestClickCap({ action: 'ping', timeoutMs });
  return Boolean(response?.ok && response.payload?.installed === true);
};

export const startClickCapCapture = async ({
  mode = 'area',
  preferences,
  timeoutMs = 3000,
}: {
  mode?: ClickCapMode;
  preferences?: Record<string, unknown>;
  timeoutMs?: number;
} = {}): Promise<StartClickCapCaptureResult> => {
  const response = await requestClickCap({
    action: 'start-capture',
    payload: { mode, preferences },
    timeoutMs,
  });

  if (!response) {
    return { success: false, error: 'ClickCap extension did not respond' };
  }

  if (!response.ok) {
    return { success: false, error: response.error ?? 'ClickCap capture could not start' };
  }

  const streamId = typeof response.payload?.streamId === 'string' ? response.payload.streamId : undefined;
  return { success: true, ...(streamId ? { streamId } : {}) };
};

export const prepareClickCapCapture = async ({
  roomHint,
  timeoutMs = 3000,
}: {
  roomHint?: string;
  timeoutMs?: number;
} = {}): Promise<PrepareClickCapCaptureResult> => {
  const { requestId, response } = requestClickCapWithId({
    action: 'prepare-capture',
    payload: roomHint ? { roomHint } : {},
    timeoutMs,
  });

  const resolved = await response;
  if (!resolved) {
    return { success: false, error: 'ClickCap extension did not respond' };
  }
  if (!resolved.ok) {
    return { success: false, error: resolved.error ?? 'ClickCap capture could not prepare' };
  }

  return { success: true, requestId };
};

export const subscribeToClickCapCaptureStream = ({
  requestId,
  onStreamReady,
  onStreamStopped,
}: {
  requestId?: string;
  onStreamReady: ClickCapStreamReadyHandler;
  onStreamStopped?: ClickCapStreamStopHandler;
}): (() => void) => {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }

  const handleMessage = (event: MessageEvent) => {
    if (!isClickCapEvent(event.data)) return;
    if (requestId && event.data.requestId !== requestId) return;

    if (event.data.event === 'stop-stream') {
      onStreamStopped?.({ requestId: event.data.requestId });
      return;
    }

    const streamId = event.data.payload?.streamId;
    if (typeof streamId !== 'string') return;
    onStreamReady({
      requestId: event.data.requestId,
      streamId,
      cropArea: event.data.payload?.cropArea,
      view: event.data.payload?.view,
    });
  };

  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
};
