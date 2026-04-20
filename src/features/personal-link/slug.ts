const RESERVED_SLUGS = new Set(['admin', 'api', 'login', 'lounge', 'room', 'home', 'settings']);
const SLUG_REGEX = /^[a-z0-9-]{3,24}$/;

export const normalizeSlug = (value: string): string => value.trim().toLowerCase();

export const validateSlug = (value: string): string | null => {
  const slug = normalizeSlug(value);
  if (!slug) return '링크를 입력하세요.';
  if (!SLUG_REGEX.test(slug)) return '링크는 3-24자의 소문자, 숫자, 하이픈만 사용할 수 있습니다.';
  if (RESERVED_SLUGS.has(slug)) return '사용할 수 없는 링크입니다.';
  return null;
};

export const isReservedSlug = (value: string): boolean => RESERVED_SLUGS.has(normalizeSlug(value));
