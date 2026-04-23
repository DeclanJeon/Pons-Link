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
  );

export const getConfiguredEmailApiUrl = () =>
  resolveConfiguredApiUrl(
    import.meta.env.VITE_EMAIL_API_URL as string | undefined,
    import.meta.env.VITE_API_URL as string | undefined,
  );

export const supportsSessionAuthAtApiUrl = async (apiUrl?: string | null): Promise<boolean> => {
  const baseUrl = resolveBackendApiUrl(apiUrl);
  if (!baseUrl) {
    return false;
  }

  try {
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      method: 'GET',
      cache: 'no-store',
    });

    return response.status === 200 || response.status === 401 || response.status === 403;
  } catch {
    return false;
  }
};
