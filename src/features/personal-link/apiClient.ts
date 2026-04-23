import { useAuthSessionStore } from './authSessionStore';

export interface ApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`Personal link API responded with ${status}`);
    this.name = 'ApiClientError';
    this.status = status;
    this.body = body;
  }
}

const normalizeBaseUrl = (baseUrl: string) => baseUrl.trim().replace(/\/$/, '');

const toHeaderRecord = (headers?: HeadersInit): Record<string, string> => {
  if (!headers) return {};
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return { ...headers };
};

const withSessionAuthorization = (init?: RequestInit): RequestInit | undefined => {
  const sessionToken = useAuthSessionStore.getState().session?.sessionToken?.trim();
  if (!sessionToken) {
    return init;
  }

  return {
    ...init,
    headers: {
      ...toHeaderRecord(init?.headers),
      Authorization: `Bearer ${sessionToken}`,
    },
  };
};

const parseResponseBody = async <T>(response: Response): Promise<T> => {
  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  const rawBody = await response.text();
  if (!rawBody.trim()) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return JSON.parse(rawBody) as T;
  }

  return rawBody as T;
};

export const createApiClient = (baseUrl: string): ApiClient => {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`${normalizedBaseUrl}${path}`, withSessionAuthorization(init));
    const body = await parseResponseBody<unknown>(response);
    if (!response.ok) {
      throw new ApiClientError(response.status, body);
    }
    return body as T;
  };

  return {
    get<T>(path) {
      return request<T>(path);
    },
    post<T>(path, body) {
      return request<T>(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    },
  };
};
