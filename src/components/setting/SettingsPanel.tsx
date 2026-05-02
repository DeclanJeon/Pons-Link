/**
 * @fileoverview 설정 패널 (Room noir UI)
 * @module components/SettingsPanel
 */

import type { ReactNode } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { X, Mic, Video, Loader2, Captions, Tv, ScreenShare, Smartphone } from "lucide-react";
import { useMediaDeviceStore } from "@/stores/useMediaDeviceStore";
import { useSessionStore } from '@/stores/useSessionStore';
import { isAudioRoom } from '@/types/roomCapabilities';
import {
  useTranscriptionStore,
  SUPPORTED_LANGUAGES,
  TRANSLATION_LANGUAGES,
  DEEPGRAM_TRANSCRIPTION_LANGUAGE_CODES,
  AZURE_TRANSCRIPTION_LANGUAGE_CODES,
  type TranscriptionProvider,
} from '@/stores/useTranscriptionStore';
import { useUIManagementStore, ControlBarSize, MobileDockPosition } from '@/stores/useUIManagementStore';
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useDeviceType } from '@/hooks/useDeviceType';
import { cn } from '@/lib/utils';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SettingsSectionProps {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}

const SettingsSection = ({ eyebrow, title, description, icon, children, className }: SettingsSectionProps) => (
  <section className={cn("settings-section space-y-4", className)} aria-labelledby={`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-settings-title`}>
    <div className="flex items-start gap-3">
      <div className="room-control-soft-card mt-0.5 flex h-9 w-9 items-center justify-center rounded-full text-indigo-200">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="room-panel-eyebrow">{eyebrow}</p>
        <h3 id={`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-settings-title`} className="settings-section-title text-base">
          {title}
        </h3>
        <p className="settings-helper-text mt-1">{description}</p>
      </div>
    </div>
    {children}
  </section>
);

interface ToggleCardProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel?: string;
}

const ToggleCard = ({ id, label, description, checked, onCheckedChange, ariaLabel }: ToggleCardProps) => (
  <div className="room-control-soft-card flex items-center justify-between gap-4 rounded-2xl p-3">
    <div className="space-y-1">
      <Label htmlFor={id} className="settings-field-label text-white/82">
        {label}
      </Label>
      <p className="settings-helper-text">{description}</p>
    </div>
    <Switch id={id} aria-label={ariaLabel ?? label} checked={checked} onCheckedChange={onCheckedChange} />
  </div>
);

interface ChoiceOption<T extends string> {
  value: T;
  id: string;
  label: string;
}

function ChoiceGroup<T extends string>({
  value,
  onValueChange,
  options,
  gridClassName,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: ChoiceOption<T>[];
  gridClassName?: string;
}) {
  return (
    <RadioGroup value={value} onValueChange={(next) => onValueChange(next as T)} className={cn("grid gap-2", gridClassName)}>
      {options.map((option) => (
        <Label key={option.id} htmlFor={option.id} className="settings-choice-card flex cursor-pointer items-center justify-center gap-2 px-3 py-2 text-sm">
          <RadioGroupItem value={option.value} id={option.id} />
          <span>{option.label}</span>
        </Label>
      ))}
    </RadioGroup>
  );
}

export const SettingsPanel = ({ isOpen, onClose }: SettingsPanelProps) => {
  const { isMobile, isTablet } = useDeviceType();
  const roomType = useSessionStore(state => state.roomType);
  const hideCameraSettings = !!roomType && isAudioRoom(roomType);

  const {
    audioInputs,
    videoInputs,
    selectedAudioDeviceId,
    selectedVideoDeviceId,
    isChangingDevice,
    changeAudioDevice,
    changeVideoDevice,
    includeCameraInScreenShare,
    setIncludeCameraInScreenShare
  } = useMediaDeviceStore();

  const {
    isTranscriptionEnabled,
    transcriptionProvider,
    transcriptionLanguage,
    translationTargetLanguage,
    toggleTranscription,
    setTranscriptionProvider,
    setTranscriptionLanguage,
    setTranslationTargetLanguage,
  } = useTranscriptionStore();
  const voiceLanguages = SUPPORTED_LANGUAGES.filter((lang) => {
    if (transcriptionProvider === 'deepgram') {
      return DEEPGRAM_TRANSCRIPTION_LANGUAGE_CODES.has(lang.code);
    }

    return AZURE_TRANSCRIPTION_LANGUAGE_CODES.has(lang.code);
  });

  const {
    controlBarSize,
    setControlBarSize,
    mobileDockPosition,
    mobileDockSize,
    mobileDockAutoHideEnabled,
    setMobileDockPosition,
    setMobileDockSize,
    setMobileDockAutoHide
  } = useUIManagementStore();

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-6 backdrop-blur-xl",
        isMobile && "p-3"
      )}
    >
      <Card
        role="dialog"
        aria-modal="true"
        aria-label="Room Settings"
        className={cn(
          "room-noir-panel room-soft-edge flex w-full flex-col overflow-hidden border-0 text-foreground",
          isMobile
            ? "h-[calc(100vh-1.5rem)] max-w-full"
            : isTablet
              ? "h-[calc(100vh-3rem)] max-w-3xl"
              : "h-[calc(100vh-3rem)] max-w-3xl"
        )}
      >
        <CardHeader className={cn(
          "room-panel-header room-panel-divider flex flex-row items-center justify-between space-y-0",
          isMobile ? "px-4 py-3" : "px-6 py-4"
        )}>
          <div>
            <p className="room-panel-eyebrow">ROOM SETTINGS</p>
            <CardTitle className={cn("room-panel-title flex items-center gap-2 font-semibold", isMobile ? "text-lg" : "text-xl")}>
              Settings
            </CardTitle>
            <p className="settings-helper-text mt-1">Tune devices, sharing, captions, and controls without leaving the room.</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close settings panel"
            className={cn("room-icon-button h-10 w-10 p-0", isMobile && "h-8 w-8")}
          >
            <X className={cn(isMobile ? "h-3 w-3" : "h-4 w-4")} />
          </Button>
        </CardHeader>

        <CardContent className={cn("min-h-0 flex-1 overflow-y-auto", isMobile ? "px-4 pb-8 pt-4" : "px-6 pb-8 pt-5")}>
          <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
            <SettingsSection
              eyebrow="INPUTS"
              title="Devices"
              description="Pick the microphone and camera people will hear and see."
              icon={<Mic className="h-4 w-4" />}
              className={!hideCameraSettings && !isMobile ? "col-span-2" : undefined}
            >
              <div className={cn("grid gap-4", hideCameraSettings || isMobile ? "grid-cols-1" : "grid-cols-2")}>
                <div className="space-y-2">
                  <Label htmlFor="microphone-select" className="settings-field-label">Microphone</Label>
                  <div className="relative">
                    <Select value={selectedAudioDeviceId} onValueChange={changeAudioDevice} disabled={isChangingDevice}>
                      <SelectTrigger id="microphone-select" aria-label="Microphone" disabled={isChangingDevice} className="settings-soft-select">
                        <SelectValue placeholder="Microphone Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {audioInputs.map((device) => (
                          <SelectItem key={device.deviceId} value={device.deviceId}>{device.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isChangingDevice && (
                      <div className="absolute right-10 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-indigo-200" />
                      </div>
                    )}
                  </div>
                </div>

                {!hideCameraSettings && (
                  <div className="space-y-2">
                    <Label htmlFor="camera-select" className="settings-field-label">Camera</Label>
                    <div className="relative">
                      <Select value={selectedVideoDeviceId} onValueChange={changeVideoDevice} disabled={isChangingDevice}>
                        <SelectTrigger id="camera-select" aria-label="Camera" disabled={isChangingDevice} className="settings-soft-select">
                          <SelectValue placeholder="Camera Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {videoInputs.map((device) => (
                            <SelectItem key={device.deviceId} value={device.deviceId}>{device.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isChangingDevice && (
                        <div className="absolute right-10 top-1/2 -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-indigo-200" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </SettingsSection>

            {!hideCameraSettings && (
              <SettingsSection
                eyebrow="SCREEN"
                title="Sharing"
                description="Decide whether your camera appears when you share your screen."
                icon={<ScreenShare className="h-4 w-4" />}
              >
                <ToggleCard
                  id="include-camera-switch"
                  label="Include Camera"
                  description="When sharing the screen, your camera view appears as a small companion window."
                  checked={includeCameraInScreenShare}
                  onCheckedChange={setIncludeCameraInScreenShare}
                />
              </SettingsSection>
            )}

            <SettingsSection
              eyebrow="LIVE TEXT"
              title="Captions & Translation"
              description="Create readable live captions and optional translated text for the room."
              icon={<Captions className="h-4 w-4" />}
              className={hideCameraSettings && !isMobile ? "col-span-2" : undefined}
            >
              <ToggleCard
                id="transcription-switch"
                label="Real-time Subtitles"
                description="Show live captions on your screen. Meeting minutes are controlled from Chat because they are a room record."
                ariaLabel="Real-time Subtitles"
                checked={isTranscriptionEnabled}
                onCheckedChange={toggleTranscription}
              />
              <div className="grid gap-3">
                <div className="space-y-2">
                  <Label htmlFor="stt-provider" className="settings-field-label">STT Provider</Label>
                  <Select value={transcriptionProvider} onValueChange={(value) => setTranscriptionProvider(value as TranscriptionProvider)}>
                    <SelectTrigger id="stt-provider" aria-label="STT Provider" className="settings-soft-select">
                      <SelectValue placeholder="Select STT provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="azure">Azure Speech</SelectItem>
                      <SelectItem value="deepgram">Deepgram Nova-3</SelectItem>
                      <SelectItem value="browser">Browser Web Speech fallback</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="settings-helper-text">Azure is selected first by default. Speech credentials are short-lived and handled securely.</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="speaking-language" className="settings-field-label">Voice Language</Label>
                    <Select value={transcriptionLanguage} onValueChange={setTranscriptionLanguage}>
                      <SelectTrigger id="speaking-language" className="settings-soft-select">
                        <SelectValue placeholder="Select Language..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {voiceLanguages.map(lang => (
                          <SelectItem key={lang.code} value={lang.code}>
                            <span className="mr-2">{lang.flag}</span>
                            {lang.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="settings-helper-text">The default follows the browser language. Provider mapping follows each STT vendor: Deepgram uses Nova-3 language codes (Korean: ko), while Azure/Browser use Azure/Web Speech locales (Korean: ko-KR).</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="translation-language" className="settings-field-label">Translation Language</Label>
                    <Select value={translationTargetLanguage} onValueChange={setTranslationTargetLanguage}>
                      <SelectTrigger id="translation-language" className="settings-soft-select">
                        <SelectValue placeholder="Select Language" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {TRANSLATION_LANGUAGES.map(lang => (
                          <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </SettingsSection>

            {!isMobile ? (
              <SettingsSection
                eyebrow="CONTROLS"
                title="Interface"
                description="Scale the room control bar to match your screen and distance."
                icon={<Tv className="h-4 w-4" />}
                className={!hideCameraSettings ? "col-span-2" : undefined}
              >
                <div className="space-y-2">
                  <Label className="settings-field-label">Control Bar Size</Label>
                  <ChoiceGroup<ControlBarSize>
                    value={controlBarSize}
                    onValueChange={setControlBarSize}
                    gridClassName="grid-cols-3"
                    options={[
                      { value: 'sm', id: 'size-sm', label: 'Small' },
                      { value: 'md', id: 'size-md', label: 'Medium' },
                      { value: 'lg', id: 'size-lg', label: 'Large' },
                    ]}
                  />
                </div>
              </SettingsSection>
            ) : (
              <SettingsSection
                eyebrow="MOBILE"
                title="Interface"
                description="Choose where the dock sits and how quickly it gets out of the way."
                icon={<Smartphone className="h-4 w-4" />}
              >
                <ToggleCard
                  id="dock-auto-hide"
                  label="Auto Hide"
                  description="The dock hides automatically when there is no activity for 3 seconds."
                  checked={mobileDockAutoHideEnabled}
                  onCheckedChange={setMobileDockAutoHide}
                />
                <div className="space-y-2">
                  <Label className="settings-field-label">Dock Position</Label>
                  <ChoiceGroup<MobileDockPosition>
                    value={mobileDockPosition}
                    onValueChange={setMobileDockPosition}
                    gridClassName="grid-cols-3"
                    options={[
                      { value: 'left', id: 'pos-left', label: 'Left' },
                      { value: 'bottom', id: 'pos-bottom', label: 'Bottom' },
                      { value: 'right', id: 'pos-right', label: 'Right' },
                    ]}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="settings-field-label">Dock Size</Label>
                  <ChoiceGroup<ControlBarSize>
                    value={mobileDockSize}
                    onValueChange={setMobileDockSize}
                    gridClassName="grid-cols-3"
                    options={[
                      { value: 'sm', id: 'dock-sm', label: 'Small' },
                      { value: 'md', id: 'dock-md', label: 'Medium' },
                      { value: 'lg', id: 'dock-lg', label: 'Large' },
                    ]}
                  />
                </div>
              </SettingsSection>
            )}
          </div>
        </CardContent>

        <div className="room-panel-header room-panel-divider-top flex shrink-0 justify-end px-6 py-4">
          <Button onClick={onClose} className="room-nav-button-active rounded-xl px-5">
            Done
          </Button>
        </div>
      </Card>
    </div>
  );
};
