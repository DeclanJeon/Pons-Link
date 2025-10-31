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
import { useDeviceType } from '@/hooks/useDeviceType';
import { cn } from '@/lib/utils';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsPanel = ({ isOpen, onClose }: SettingsPanelProps) => {
  const { isMobile, isTablet, isDesktop } = useDeviceType();
  
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
    <div className={cn(
      "fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center",
      isMobile ? "p-4" : "p-6"
    )}>
      <Card className={cn(
        "w-full overflow-y-auto",
        isMobile
          ? "max-h-[90vh] max-w-full"
          : isTablet
            ? "max-h-[85vh] max-w-3xl"
            : "max-h-[80vh] max-w-2xl"
      )}>
        <CardHeader className={cn(
          "flex flex-row items-center justify-between space-y-0",
          isMobile ? "pb-3 px-4" : "pb-4"
        )}>
          <CardTitle className={cn("font-semibold flex items-center gap-2",
            isMobile ? "text-lg" : "text-xl")}>
            Settings
          </CardTitle>
          <Button
            variant="ghost"
            size={isMobile ? "sm" : "sm"}
            onClick={onClose}
            className={cn(isMobile && "h-8 w-8")}
          >
            <X className={cn(isMobile ? "w-3 h-3" : "w-4 h-4")} />
          </Button>
        </CardHeader>
        
        <CardContent className={cn("space-y-6",
          isMobile ? "px-4 py-3 space-y-4" : "px-6 py-4")}>
          {/* 오디오 설정 */}
          <div className={cn("space-y-4", isMobile && "space-y-3")}>
            <h3 className={cn("font-medium flex items-center gap-2",
              isMobile ? "text-base" : "text-lg")}>
              <Mic className={cn(isMobile ? "w-3 h-3" : "w-4 h-4")} />
              Audio Settings
            </h3>
            <div>
              <Label htmlFor="microphone-select" className={cn(isMobile && "text-sm")}>
                Microphone
              </Label>
              <div className="relative">
                <Select
                  value={selectedAudioDeviceId}
                  onValueChange={changeAudioDevice}
                  disabled={isChangingDevice}
                >
                  <SelectTrigger
                    id="microphone-select"
                    disabled={isChangingDevice}
                    className={cn(isMobile && "h-9 text-sm")}
                  >
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
                    <Loader2 className={cn("animate-spin text-primary",
                      isMobile ? "w-3 h-3" : "w-4 h-4")} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 비디오 설정 */}
          <div className={cn("space-y-4", isMobile && "space-y-3")}>
            <h3 className={cn("font-medium flex items-center gap-2",
              isMobile ? "text-base" : "text-lg")}>
              <Video className={cn(isMobile ? "w-3 h-3" : "w-4 h-4")} />
              Video Settings
            </h3>
            <div>
              <Label htmlFor="camera-select" className={cn(isMobile && "text-sm")}>
                Camera
              </Label>
              <div className="relative">
                <Select
                  value={selectedVideoDeviceId}
                  onValueChange={changeVideoDevice}
                  disabled={isChangingDevice}
                >
                  <SelectTrigger
                    id="camera-select"
                    disabled={isChangingDevice}
                    className={cn(isMobile && "h-9 text-sm")}
                  >
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
                    <Loader2 className={cn("animate-spin text-primary",
                      isMobile ? "w-3 h-3" : "w-4 h-4")} />
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
            <div className={cn("space-y-4 pt-6 border-t", isTablet && "space-y-3")}>
              <h3 className={cn("font-medium flex items-center gap-2",
                isTablet ? "text-base" : "text-lg")}>
                  <Tv className={cn(isTablet ? "w-3 h-3" : "w-4 h-4")} />
                  UI Settings
              </h3>
              <div>
                  <Label htmlFor="control-bar-size" className={cn(isTablet && "text-sm")}>
                    Control Bar Size
                  </Label>
                  <RadioGroup
                      id="control-bar-size"
                      value={controlBarSize}
                      onValueChange={(value) => setControlBarSize(value as ControlBarSize)}
                      className={cn("flex items-center gap-4 mt-2",
                        isTablet && "gap-3")}
                  >
                      <div className="flex items-center space-x-2">
                          <RadioGroupItem value="sm" id="size-sm" />
                          <Label htmlFor="size-sm" className={cn(isTablet && "text-sm")}>Small</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                          <RadioGroupItem value="md" id="size-md" />
                          <Label htmlFor="size-md" className={cn(isTablet && "text-sm")}>Medium</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                          <RadioGroupItem value="lg" id="size-lg" />
                          <Label htmlFor="size-lg" className={cn(isTablet && "text-sm")}>Large</Label>
                      </div>
                  </RadioGroup>
              </div>
            </div>
          )}

          {/* 모바일 Dock 설정 */}
          {isMobile && (
            <div className={cn("space-y-4 pt-6 border-t", isMobile && "space-y-3")}>
              <h3 className={cn("font-medium flex items-center gap-2",
                isMobile ? "text-base" : "text-lg")}>
                <Smartphone className={cn(isMobile ? "w-3 h-3" : "w-4 h-4")} />
                Mobile Dock Settings
              </h3>
              
              <div className={cn(
                "flex items-center justify-between rounded-lg border shadow-sm",
                isMobile ? "p-2" : "p-3"
              )}>
                <div className="space-y-0.5">
                  <Label htmlFor="dock-auto-hide" className={cn(isMobile && "text-sm")}>
                    Auto Hide
                  </Label>
                  <p className={cn("text-muted-foreground",
                    isMobile ? "text-[10px]" : "text-xs")}>
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
                <Label htmlFor="dock-position" className={cn(isMobile && "text-sm")}>
                  Dock Position
                </Label>
                <RadioGroup
                  id="dock-position"
                  value={mobileDockPosition}
                  onValueChange={(value) => setMobileDockPosition(value as MobileDockPosition)}
                  className={cn("grid gap-2 mt-2",
                    isMobile ? "grid-cols-3 gap-1" : "grid-cols-3 gap-2")}
                >
                  <Label htmlFor="pos-left" className={cn(
                    "flex items-center gap-2 border rounded-md cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-primary-foreground",
                    isMobile ? "p-2 text-xs" : "p-3"
                  )}>
                    <RadioGroupItem value="left" id="pos-left" />
                    Left
                  </Label>
                  <Label htmlFor="pos-bottom" className={cn(
                    "flex items-center gap-2 border rounded-md cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-primary-foreground",
                    isMobile ? "p-2 text-xs" : "p-3"
                  )}>
                    <RadioGroupItem value="bottom" id="pos-bottom" />
                    Bottom
                  </Label>
                  <Label htmlFor="pos-right" className={cn(
                    "flex items-center gap-2 border rounded-md cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-primary-foreground",
                    isMobile ? "p-2 text-xs" : "p-3"
                  )}>
                    <RadioGroupItem value="right" id="pos-right" />
                    Right
                  </Label>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="dock-size" className={cn(isMobile && "text-sm")}>
                  Dock Size
                </Label>
                <RadioGroup
                  id="dock-size"
                  value={mobileDockSize}
                  onValueChange={(value) => setMobileDockSize(value as ControlBarSize)}
                  className={cn("grid gap-2 mt-2",
                    isMobile ? "grid-cols-3 gap-1" : "grid-cols-3 gap-2")}
                >
                  <Label htmlFor="dock-sm" className={cn(
                    "flex items-center justify-center border rounded-md cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-primary-foreground",
                    isMobile ? "p-2 text-xs" : "p-3"
                  )}>
                    <RadioGroupItem value="sm" id="dock-sm" />
                    <span className="ml-2">Small</span>
                  </Label>
                  <Label htmlFor="dock-md" className={cn(
                    "flex items-center justify-center border rounded-md cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-primary-foreground",
                    isMobile ? "p-2 text-xs" : "p-3"
                  )}>
                    <RadioGroupItem value="md" id="dock-md" />
                    <span className="ml-2">Medium</span>
                  </Label>
                  <Label htmlFor="dock-lg" className={cn(
                    "flex items-center justify-center border rounded-md cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-primary-foreground",
                    isMobile ? "p-2 text-xs" : "p-3"
                  )}>
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