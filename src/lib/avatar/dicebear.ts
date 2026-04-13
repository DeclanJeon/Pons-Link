export interface AvatarPreset {
  id: string;
  seed: string;
  style: string;
  url: string;
}

const AVATAR_STORAGE_KEY = 'preferredAvatarPreset';
const DEFAULT_STYLE = 'bottts-neutral';
const DEFAULT_SEEDS = [
  'nova', 'luna', 'atlas', 'iris', 'orion', 'echo', 'milo', 'sora', 'jin', 'mina',
  'kai', 'rhea', 'theo', 'nari', 'zeph', 'ara', 'sol', 'yuna', 'rio', 'hani',
  'taro', 'noel', 'sage', 'lyra', 'neo', 'danbi', 'haru', 'mira', 'yuri', 'ian',
  'erin', 'juno', 'tae', 'sena', 'rowan', 'elliot', 'nox', 'eun', 'boa', 'sian',
  'daro', 'lumi', 'mino', 'vivi', 'raon', 'ari', 'dami', 'sean', 'gael', 'onyx',
];

export const buildDiceBearUrl = (seed: string, style: string = DEFAULT_STYLE): string => {
  const encodedSeed = encodeURIComponent(seed);
  const encodedStyle = encodeURIComponent(style);
  return `https://api.dicebear.com/9.x/${encodedStyle}/svg?seed=${encodedSeed}&backgroundType=gradientLinear`;
};

export const getDefaultAvatarPresets = (): AvatarPreset[] => {
  return DEFAULT_SEEDS.map((seed, index) => ({
    id: `avatar-${index + 1}`,
    seed,
    style: DEFAULT_STYLE,
    url: buildDiceBearUrl(seed, DEFAULT_STYLE),
  }));
};

export const getStoredAvatarPreset = (): AvatarPreset | null => {
  try {
    const stored = localStorage.getItem(AVATAR_STORAGE_KEY);
    return stored ? JSON.parse(stored) as AvatarPreset : null;
  } catch {
    return null;
  }
};

export const saveAvatarPreset = (preset: AvatarPreset): void => {
  localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(preset));
};

export const getInitialAvatarPreset = (): AvatarPreset => {
  return getStoredAvatarPreset() || getDefaultAvatarPresets()[0];
};
