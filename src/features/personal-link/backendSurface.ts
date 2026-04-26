export const DEFAULT_BACKEND_API_URL = 'http://localhost:6650';

export const resolveBackendApiUrl = (apiUrl?: string | null) => {
  const value = apiUrl?.trim();
  return value ? value.replace(/\/$/, '') : null;
};

const resolveConfiguredApiUrl = (...candidates: Array<string | null | undefined>) => {
  for (const candidate of candidates) {
    const resolved = resolveBackendApiUrl(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return null;
};

export const getConfiguredPersonalLinkApiUrl = () =>
  resolveConfiguredApiUrl(
    import.meta.env.VITE_PERSONAL_LINK_API_URL as string | undefined,
    import.meta.env.VITE_API_URL as string | undefined,
    DEFAULT_BACKEND_API_URL,
  );

export const getConfiguredEmailApiUrl = () =>
  resolveConfiguredApiUrl(
    import.meta.env.VITE_API_URL as string | undefined,
    DEFAULT_BACKEND_API_URL,
  );

const isSupportedProtectedAuthStatus = (status: number) => status === 200 || status === 401 || status === 403;

export const supportsSessionAuthAtApiUrl = async (apiUrl?: string | null): Promise<boolean> => {
  const baseUrl = resolveBackendApiUrl(apiUrl);
  if (!baseUrl) {
    return false;
  }

  try {
    const healthResponse = await fetch(`${baseUrl}/api/health`, {
      method: 'GET',
      cache: 'no-store',
    });

    if (healthResponse.ok) {
      return true;
    }

    if (healthResponse.status !== 404) {
      return false;
    }

    const authResponse = await fetch(`${baseUrl}/api/auth/me`, {
      method: 'GET',
      cache: 'no-store',
    });

    return isSupportedProtectedAuthStatus(authResponse.status);
  } catch {
    return false;
  }
};
