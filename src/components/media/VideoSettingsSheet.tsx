// src/components/media/VideoSettingsSheet.tsx (모바일 전용)

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Settings } from "lucide-react";
import { TouchOptimizedButton } from "@/components/ui/TouchOptimizedButton";
import { useDeviceMetadataStore, VideoDisplayMode } from "@/stores/useDeviceMetadataStore";
import { VIDEO_DISPLAY_OPTIONS } from '@/lib/media/videoDisplayOptions';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export const VideoSettingsSheet = () => {
  const { localMetadata, setPreferredObjectFit } = useDeviceMetadataStore();
  
  return (
    <Sheet>
      <SheetTrigger asChild>
        <TouchOptimizedButton variant="ghost" size="sm">
          <Settings className="w-5 h-5" />
        </TouchOptimizedButton>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[60vh]">
        <SheetHeader>
          <SheetTitle>Video Display Settings</SheetTitle>
          <SheetDescription>
            Adjust how your video appears to others
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-4">
          <div className="space-y-3">
            <Label className="text-base font-medium">Display Mode</Label>
            <RadioGroup
              value={localMetadata.preferredObjectFit}
              onValueChange={(value) => setPreferredObjectFit(value as VideoDisplayMode)}
              className="space-y-3"
            >
              {VIDEO_DISPLAY_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-start space-x-3 p-3 rounded-lg border">
                  <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor={option.value} className="font-medium cursor-pointer">
                      {option.label}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {option.description}
                    </p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>
          
          {/* 미리보기 영역 */}
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">Preview</p>
            <div className="aspect-video bg-background rounded border overflow-hidden">
              <div className="relative h-full w-full overflow-hidden bg-slate-950">
                {localMetadata.preferredObjectFit === 'balanced' && (
                  <div className="absolute inset-0 scale-110 bg-gradient-to-br from-blue-500 to-purple-600 opacity-45 blur-xl" />
                )}
                <div
                  className={
                    localMetadata.preferredObjectFit === 'fill'
                      ? "relative flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white"
                      : "relative mx-auto flex h-full aspect-[3/4] max-w-full items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white"
                  }
                >
                  <span className="text-2xl font-bold">You</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
