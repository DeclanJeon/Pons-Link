/**
 * @fileoverview 설정 패널 (개선됨)
 * @module components/SettingsPanel
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { X, Mic, Video, Loader2, Captions, Tv, ScreenShare, Smartphone } from "lucide-react";
import { useMediaDeviceStore } from "@/stores/useMediaDeviceStore";
import { useTranscriptionStore, SUPPORTED_LANGUAGES, TRANSLATION_LANGUAGES } from '@/stores/useTranscriptionStore';
import { useUIManagementStore, ControlBarSize, MobileDockPosition } from '@/stores/useUIManagementStore';
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useIsMobile } from '@/hooks/use-mobile';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsPanel = ({ isOpen, onClose }: SettingsPanelProps) => {
  const isMobile = useIsMobile();
  
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
    transcriptionLanguage,
    translationTargetLanguage,
    toggleTranscription,
    setTranscriptionLanguage,
    setTranslationTargetLanguage,
  } = useTranscriptionStore();

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
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            Settings
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* 오디오 설정 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Mic className="w-4 h-4" />
              Audio Settings
            </h3>
            <div>
              <Label htmlFor="microphone-select">Microphone</Label>
              <div className="relative">
                <Select 
                  value={selectedAudioDeviceId} 
                  onValueChange={changeAudioDevice}
                  disabled={isChangingDevice}
                >
                  <SelectTrigger id="microphone-select" disabled={isChangingDevice}>
                    <SelectValue placeholder="Microphone Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {audioInputs.map((device) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isChangingDevice && (
                  <div className="absolute right-10 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 비디오 설정 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Video className="w-4 h-4" />
              Video Settings
            </h3>
            <div>
              <Label htmlFor="camera-select">Camera</Label>
              <div className="relative">
                <Select 
                  value={selectedVideoDeviceId} 
                  onValueChange={changeVideoDevice}
                  disabled={isChangingDevice}
                >
                  <SelectTrigger id="camera-select" disabled={isChangingDevice}>
                    <SelectValue placeholder="카메라 선택..." />
                  </SelectTrigger>
                  <SelectContent>
                    {videoInputs.map((device) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isChangingDevice && (
                  <div className="absolute right-10 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 화면 공유 설정 */}
          <div className="space-y-4 pt-6 border-t">
            <h3 className="text-lg font-medium flex items-center gap-2">
                <ScreenShare className="w-4 h-4" />
                Screen Share Settings
            </h3>
            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <Label htmlFor="include-camera-switch">Include Camera</Label>
                <p className="text-xs text-muted-foreground">
                  When sharing the screen, the camera view is also displayed in a small window.
                </p>
              </div>
              <Switch
                id="include-camera-switch"
                checked={includeCameraInScreenShare}
                onCheckedChange={setIncludeCameraInScreenShare}
              />
            </div>
          </div>

          {/* UI 설정 (데스크톱) */}
          {!isMobile && (
            <div className="space-y-4 pt-6 border-t">
              <h3 className="text-lg font-medium flex items-center gap-2">
                  <Tv className="w-4 h-4" />
                  UI Settings
              </h3>
              <div>
                  <Label htmlFor="control-bar-size">Control Bar Size</Label>
                  <RadioGroup
                      id="control-bar-size"
                      value={controlBarSize}
                      onValueChange={(value) => setControlBarSize(value as ControlBarSize)}
                      className="flex items-center gap-4 mt-2"
                  >
                      <div className="flex items-center space-x-2">
                          <RadioGroupItem value="sm" id="size-sm" />
                          <Label htmlFor="size-sm">Small</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                          <RadioGroupItem value="md" id="size-md" />
                          <Label htmlFor="size-md">Medium</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                          <RadioGroupItem value="lg" id="size-lg" />
                          <Label htmlFor="size-lg">Large</Label>
                      </div>
                  </RadioGroup>
              </div>
            </div>
          )}

          {/* 모바일 Dock 설정 */}
          {isMobile && (
            <div className="space-y-4 pt-6 border-t">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Mobile Dock Settings
              </h3>
              
              <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <Label htmlFor="dock-auto-hide">Auto Hide</Label>
                  <p className="text-xs text-muted-foreground">
                    The dock will be automatically hidden if there is no activity for 3 seconds.
                  </p>
                </div>
                <Switch
                  id="dock-auto-hide"
                  checked={mobileDockAutoHideEnabled}
                  onCheckedChange={setMobileDockAutoHide}
                />
              </div>

              {/* Dock 위치 설정 (좌/우 추가) */}
              <div>
                <Label htmlFor="dock-position">Dock Position</Label>
                <RadioGroup
                  id="dock-position"
                  value={mobileDockPosition}
                  onValueChange={(value) => setMobileDockPosition(value as MobileDockPosition)}
                  className="grid grid-cols-3 gap-2 mt-2"
                >
                  <Label htmlFor="pos-left" className="flex items-center gap-2 p-3 border rounded-md cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">
                    <RadioGroupItem value="left" id="pos-left" />
                    Left
                  </Label>
                  <Label htmlFor="pos-bottom" className="flex items-center gap-2 p-3 border rounded-md cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">
                    <RadioGroupItem value="bottom" id="pos-bottom" />
                    Bottom
                  </Label>
                  <Label htmlFor="pos-right" className="flex items-center gap-2 p-3 border rounded-md cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">
                    <RadioGroupItem value="right" id="pos-right" />
                    Right
                  </Label>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="dock-size">Dock Size</Label>
                <RadioGroup
                  id="dock-size"
                  value={mobileDockSize}
                  onValueChange={(value) => setMobileDockSize(value as ControlBarSize)}
                  className="grid grid-cols-3 gap-2 mt-2"
                >
                  <Label htmlFor="dock-sm" className="flex items-center justify-center p-3 border rounded-md cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">
                    <RadioGroupItem value="sm" id="dock-sm" />
                    <span className="ml-2">Small</span>
                  </Label>
                  <Label htmlFor="dock-md" className="flex items-center justify-center p-3 border rounded-md cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">
                    <RadioGroupItem value="md" id="dock-md" />
                    <span className="ml-2">Medium</span>
                  </Label>
                  <Label htmlFor="dock-lg" className="flex items-center justify-center p-3 border rounded-md cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">
                    <RadioGroupItem value="lg" id="dock-lg" />
                    <span className="ml-2">Large</span>
                  </Label>
                </RadioGroup>
              </div>
            </div>
          )}

          {/* 자막 설정 (변경 없음) */}
          <div className="space-y-4 pt-6 border-t">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Captions className="w-4 h-4" />
              Subtitles
            </h3>
            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <Label htmlFor="transcription-switch">Real-time Subtitles</Label>
                <p className="text-xs text-muted-foreground">
                  Convert voice to text in real-time.
                </p>
              </div>
              <Switch
                id="transcription-switch"
                checked={isTranscriptionEnabled}
                onCheckedChange={toggleTranscription}
              />
            </div>
            {isTranscriptionEnabled && (
              <div>
                <Label htmlFor="speaking-language">Voice Language</Label>
                <Select value={transcriptionLanguage} onValueChange={setTranscriptionLanguage}>
                  <SelectTrigger id="speaking-language">
                    <SelectValue placeholder="Select Language..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {SUPPORTED_LANGUAGES.map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>
                        <span className="mr-2">{lang.flag}</span>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="translation-language">Translation Language</Label>
              <Select value={translationTargetLanguage} onValueChange={setTranslationTargetLanguage}>
                <SelectTrigger id="translation-language">
                  <SelectValue placeholder="Select Language" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {TRANSLATION_LANGUAGES.map(lang => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button onClick={onClose}>
              닫기
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};