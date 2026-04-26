import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPanel } from './SettingsPanel';

const toggleTranscriptionMock = vi.fn();
const setTranscriptionLanguageMock = vi.fn();
const setTranslationTargetLanguageMock = vi.fn();
const setProviderMock = vi.fn();
let transcriptionEnabled = false;
let provider = 'deepgram';

vi.mock('@/hooks/useDeviceType', () => ({
  useDeviceType: () => ({ isMobile: false, isTablet: false, isDesktop: true }),
}));

vi.mock('@/stores/useMediaDeviceStore', () => ({
  useMediaDeviceStore: () => ({
    audioInputs: [{ deviceId: 'mic-1', label: 'Built-in Mic' }],
    videoInputs: [{ deviceId: 'cam-1', label: 'Built-in Camera' }],
    selectedAudioDeviceId: 'mic-1',
    selectedVideoDeviceId: 'cam-1',
    isChangingDevice: false,
    changeAudioDevice: vi.fn(),
    changeVideoDevice: vi.fn(),
    includeCameraInScreenShare: false,
    setIncludeCameraInScreenShare: vi.fn(),
  }),
}));

vi.mock('@/stores/useSessionStore', () => ({
  useSessionStore: (selector?: (state: { roomType: string }) => unknown) => {
    const state = { roomType: 'video-group' };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/stores/useUIManagementStore', () => ({
  useUIManagementStore: () => ({
    controlBarSize: 'md',
    setControlBarSize: vi.fn(),
    mobileDockPosition: 'bottom',
    mobileDockSize: 'md',
    mobileDockAutoHideEnabled: true,
    setMobileDockPosition: vi.fn(),
    setMobileDockSize: vi.fn(),
    setMobileDockAutoHide: vi.fn(),
  }),
}));

vi.mock('@/stores/useTranscriptionStore', () => ({
  SUPPORTED_LANGUAGES: [
    { code: 'auto', name: 'Auto Detect (자동 감지)', flag: '🌐' },
    { code: 'ko-KR', name: '한국어', flag: '🇰🇷' },
    { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  ],
  TRANSLATION_LANGUAGES: [
    { code: 'none', name: 'Disabled (translation disabled)' },
    { code: 'en', name: 'English' },
  ],
  useTranscriptionStore: () => ({
    isTranscriptionEnabled: transcriptionEnabled,
    transcriptionProvider: provider,
    transcriptionLanguage: 'auto',
    translationTargetLanguage: 'none',
    toggleTranscription: toggleTranscriptionMock,
    setTranscriptionProvider: setProviderMock,
    setTranscriptionLanguage: setTranscriptionLanguageMock,
    setTranslationTargetLanguage: setTranslationTargetLanguageMock,
  }),
}));

vi.mock('@/types/roomCapabilities', () => ({
  isAudioRoom: () => false,
}));

describe('SettingsPanel STT controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transcriptionEnabled = false;
    provider = 'deepgram';
  });

  it('shows live caption provider and real-time subtitle controls', () => {
    render(<SettingsPanel isOpen onClose={vi.fn()} />);

    expect(screen.getByText('Live Captions')).toBeInTheDocument();
    expect(screen.getByLabelText('STT Provider')).toBeInTheDocument();
    expect(screen.getByLabelText('Real-time Subtitles')).toBeInTheDocument();
    expect(screen.getByText('Auto Detect (자동 감지)')).toBeInTheDocument();
    expect(screen.getByText('Deepgram Nova-3')).toBeInTheDocument();
    expect(screen.getByText(/Deepgram and Azure keys stay on the server/i)).toBeInTheDocument();
  });

  it('toggles real-time subtitles from settings', () => {
    render(<SettingsPanel isOpen onClose={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Real-time Subtitles'));

    expect(toggleTranscriptionMock).toHaveBeenCalledTimes(1);
  });
});
