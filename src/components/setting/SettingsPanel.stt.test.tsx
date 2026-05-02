import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPanel } from './SettingsPanel';

const toggleTranscriptionMock = vi.fn();
const setTranscriptionLanguageMock = vi.fn();
const setTranslationTargetLanguageMock = vi.fn();
const setProviderMock = vi.fn();
const setMeetingMinutesEnabledMock = vi.fn();
let transcriptionEnabled = false;
let provider = 'azure';
let language = 'ko-KR';
let meetingMinutesEnabled = false;

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
    { code: 'ar-SA', name: 'العربية', flag: '🇸🇦' },
  ],
  DEEPGRAM_TRANSCRIPTION_LANGUAGE_CODES: new Set(['auto', 'ko-KR', 'en-US']),
  AZURE_TRANSCRIPTION_LANGUAGE_CODES: new Set(['auto', 'ko-KR', 'en-US', 'ar-SA']),
  TRANSLATION_LANGUAGES: [
    { code: 'none', name: 'Disabled (translation disabled)' },
    { code: 'en', name: 'English' },
  ],
  useTranscriptionStore: () => ({
    isTranscriptionEnabled: transcriptionEnabled,
    transcriptionProvider: provider,
    transcriptionLanguage: language,
    translationTargetLanguage: 'none',
    meetingMinutesEnabled,
    meetingMinutesOwnerNickname: meetingMinutesEnabled ? 'Local User' : null,
    toggleTranscription: toggleTranscriptionMock,
    setTranscriptionProvider: setProviderMock,
    setTranscriptionLanguage: setTranscriptionLanguageMock,
    setTranslationTargetLanguage: setTranslationTargetLanguageMock,
    setMeetingMinutesEnabled: setMeetingMinutesEnabledMock,
  }),
}));

vi.mock('@/types/roomCapabilities', () => ({
  isAudioRoom: () => false,
}));

describe('SettingsPanel STT controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transcriptionEnabled = false;
    provider = 'azure';
    language = 'ko-KR';
    meetingMinutesEnabled = false;
  });

  it('shows live caption provider and real-time subtitle controls', () => {
    render(<SettingsPanel isOpen onClose={vi.fn()} />);

    expect(screen.getByText('Captions & Translation')).toBeInTheDocument();
    expect(screen.getByLabelText('STT Provider')).toBeInTheDocument();
    expect(screen.getByLabelText('Real-time Subtitles')).toBeInTheDocument();
    expect(screen.getByLabelText('Record meeting minutes for this room')).toBeInTheDocument();
    expect(screen.getByText('Voice Language')).toBeInTheDocument();
    expect(screen.getByText('Translation Language')).toBeInTheDocument();
    expect(screen.getByText(/Azure is selected first by default/i)).toBeInTheDocument();
    expect(screen.getByText(/The default follows the browser language/i)).toBeInTheDocument();
    expect(screen.getByText(/Deepgram uses Nova-3 language codes/i)).toBeInTheDocument();
  });

  it('filters voice languages by the selected STT provider support matrix', () => {
    const { unmount } = render(<SettingsPanel isOpen onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('한국어'));
    expect(screen.getAllByText('한국어').length).toBeGreaterThan(0);
    expect(screen.getByText('العربية')).toBeInTheDocument();

    unmount();
    provider = 'deepgram';
    render(<SettingsPanel isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('한국어'));

    expect(screen.queryByText('العربية')).not.toBeInTheDocument();
  });

  it('toggles real-time subtitles from settings', () => {
    render(<SettingsPanel isOpen onClose={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Real-time Subtitles'));

    expect(toggleTranscriptionMock).toHaveBeenCalledTimes(1);
  });

  it('toggles room meeting minutes from settings', () => {
    render(<SettingsPanel isOpen onClose={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Record meeting minutes for this room'));

    expect(setMeetingMinutesEnabledMock).toHaveBeenCalledWith(true);
  });
});
