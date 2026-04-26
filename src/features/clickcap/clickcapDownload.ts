export type ClickCapExtensionMetadata = {
  id: string;
  name: string;
  version: string;
  downloadUrl: string;
  fileName: string;
  installInstructions: string[];
};

export type ClickCapExtensionMetadataResult =
  | { status: 'available'; extension: ClickCapExtensionMetadata }
  | { status: 'disabled' | 'unavailable'; error: string };

export const resolveClickCapApiUrl = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, '');
};

export const getConfiguredClickCapApiUrl = (): string | null => {
  return resolveClickCapApiUrl(import.meta.env.VITE_API_URL as string | undefined);
};

const normalizeDownloadUrl = (apiUrl: string, downloadUrl: string): string => {
  if (/^https?:\/\//i.test(downloadUrl)) return downloadUrl;
  return `${apiUrl}${downloadUrl.startsWith('/') ? '' : '/'}${downloadUrl}`;
};

export const fetchClickCapExtensionMetadata = async ({
  apiUrl = getConfiguredClickCapApiUrl(),
  timeoutMs = 5000,
}: {
  apiUrl?: string | null;
  timeoutMs?: number;
} = {}): Promise<ClickCapExtensionMetadataResult> => {
  if (!apiUrl) {
    return { status: 'disabled', error: 'ClickCap extension API URL is not configured' };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${apiUrl}/api/clickcap-extension`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      return { status: 'unavailable', error: `ClickCap extension API returned ${response.status}` };
    }

    const payload = await response.json() as {
      ok?: boolean;
      extension?: Partial<ClickCapExtensionMetadata>;
      error?: string;
    };

    const extension = payload.extension;
    if (!payload.ok || !extension?.id || !extension.name || !extension.version || !extension.downloadUrl || !extension.fileName) {
      return { status: 'unavailable', error: payload.error ?? 'ClickCap extension response is incomplete' };
    }

    return {
      status: 'available',
      extension: {
        id: extension.id,
        name: extension.name,
        version: extension.version,
        downloadUrl: normalizeDownloadUrl(apiUrl, extension.downloadUrl),
        fileName: extension.fileName,
        installInstructions: extension.installInstructions ?? [],
      },
    };
  } catch (error) {
    return {
      status: 'unavailable',
      error: error instanceof Error ? error.message : 'Failed to fetch ClickCap extension metadata',
    };
  } finally {
    window.clearTimeout(timeout);
  }
};

export const triggerClickCapExtensionDownload = ({
  downloadUrl,
  fileName,
}: {
  downloadUrl: string;
  fileName: string;
}): void => {
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};
