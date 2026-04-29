import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DeviceInfo } from '@/lib/device/deviceUtils';
import { cn } from '@/lib/utils';

interface DeviceSelectorProps {
  audioDevices: DeviceInfo[];
  videoDevices: DeviceInfo[];
  selectedAudioDevice: string;
  selectedVideoDevice: string;
  onAudioDeviceChange: (deviceId: string) => void;
  onVideoDeviceChange: (deviceId: string) => void;
  showVideoSelector?: boolean;
  surface?: 'default' | 'dark';
}

export const DeviceSelector = ({
  audioDevices,
  videoDevices,
  selectedAudioDevice,
  selectedVideoDevice,
  onAudioDeviceChange,
  onVideoDeviceChange,
  showVideoSelector = true,
  surface = 'default',
}: DeviceSelectorProps) => {
  const darkSurface = surface === 'dark';
  const labelClassName = cn('text-sm font-medium text-foreground', darkSurface && 'text-slate-100');
  const triggerClassName = cn(
    'bg-input/50 border-border/50',
    darkSurface && 'h-10 rounded-xl border-white/10 bg-white/[0.05] text-slate-100 ring-offset-transparent focus:ring-primary/50 focus:ring-offset-0',
  );
  const contentClassName = cn(darkSurface && 'border-white/10 bg-[#09090d] text-slate-100');
  const itemClassName = cn(darkSurface && 'focus:bg-primary/[0.12] focus:text-primary-subtle');
  const skeletonClassName = cn('h-10 w-full', darkSurface && 'rounded-xl bg-white/[0.06]');

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className={labelClassName}>Microphone</Label>
        {audioDevices.length === 0 ? (
          <Skeleton className={skeletonClassName} />
        ) : (
          <Select value={selectedAudioDevice} onValueChange={onAudioDeviceChange}>
            <SelectTrigger className={triggerClassName}>
              <SelectValue placeholder="Select microphone..." />
            </SelectTrigger>
            <SelectContent className={contentClassName}>
              {audioDevices.filter(device => device.deviceId !== "").map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId} className={itemClassName}>
                  {device.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {showVideoSelector && (
        <div className="space-y-2">
          <Label className={labelClassName}>Camera</Label>
          {videoDevices.length === 0 ? (
            <Skeleton className={skeletonClassName} />
          ) : (
            <Select value={selectedVideoDevice} onValueChange={onVideoDeviceChange}>
              <SelectTrigger className={triggerClassName}>
                <SelectValue placeholder="Select camera..." />
              </SelectTrigger>
              <SelectContent className={contentClassName}>
                {videoDevices.filter(device => device.deviceId !== "").map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId} className={itemClassName}>
                    {device.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  );
};
