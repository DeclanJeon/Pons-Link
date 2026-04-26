export const CLICKCAP_BRIDGE_PROTOCOL = 'pons-clickcap';

type ClickCapAction = 'ping' | 'start-capture';
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

export type StartClickCapCaptureResult =
  | { success: true; streamId?: string }
  | { success: false; error: string };

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

const requestClickCap = ({
  action,
  payload,
  timeoutMs,
}: {
  action: ClickCapAction;
  payload?: Record<string, unknown>;
  timeoutMs: number;
}): Promise<ClickCapBridgeResponse | null> => {
  if (typeof window === 'undefined') return Promise.resolve(null);

  const requestId = createRequestId();

  return new Promise((resolve) => {
    let settled = false;
    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      window.clearTimeout(timeout);
    };
    const finish = (response: ClickCapBridgeResponse | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(response);
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
