const OWNER_DEVICE_TOKEN_KEY = 'pons-link:owner-device-token';

export const readOwnerDeviceToken = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const token = window.localStorage.getItem(OWNER_DEVICE_TOKEN_KEY)?.trim();
  return token || null;
};

export const writeOwnerDeviceToken = (token: string | null): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const trimmed = token?.trim();
  if (trimmed) {
    window.localStorage.setItem(OWNER_DEVICE_TOKEN_KEY, trimmed);
    return;
  }

  window.localStorage.removeItem(OWNER_DEVICE_TOKEN_KEY);
};
