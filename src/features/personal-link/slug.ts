const RESERVED_SLUGS = new Set(['admin', 'api', 'login', 'lounge', 'room', 'home', 'settings']);
const SLUG_REGEX = /^[a-z0-9-]{3,24}$/;

export const normalizeSlug = (value: string): string => value.trim().toLowerCase();

export const validateSlug = (value: string): string | null => {
  const slug = normalizeSlug(value);
  if (!slug) return 'Enter a link.';
  if (!SLUG_REGEX.test(slug)) return 'Links must be 3-24 characters and use only lowercase letters, numbers, and hyphens.';
  if (RESERVED_SLUGS.has(slug)) return 'This link cannot be used.';
  return null;
};

export const isReservedSlug = (value: string): boolean => RESERVED_SLUGS.has(normalizeSlug(value));
