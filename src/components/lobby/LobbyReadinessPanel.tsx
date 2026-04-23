import { DeviceSelector } from '@/components/setting/DeviceSelector';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video } from 'lucide-react';

interface DeviceOption {
  deviceId: string;
  label: string;
}

interface LobbyReadinessPanelProps {
  audioOnlyRoom: boolean;
  nickname: string;
  isAudioEnabled: boolean;
  onToggleAudio: () => void;
  audioDevices: DeviceOption[];
  videoDevices: DeviceOption[];
  selectedAudioDevice: string;
  selectedVideoDevice: string;
  onAudioDeviceChange: (deviceId: string) => void;
  onVideoDeviceChange: (deviceId: string) => void;
}

export function LobbyReadinessPanel({
  audioOnlyRoom,
  nickname,
  isAudioEnabled,
  onToggleAudio,
  audioDevices,
  videoDevices,
  selectedAudioDevice,
  selectedVideoDevice,
  onAudioDeviceChange,
  onVideoDeviceChange,
}: LobbyReadinessPanelProps) {
  return (
    <section aria-label="Readiness panel" className="space-y-4 rounded-[32px] border border-border/60 bg-card/80 p-5 shadow-sm sm:p-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">Readiness</p>
        <h2 className="text-xl font-semibold text-foreground">Everything you need before entry</h2>
        <p className="text-sm text-muted-foreground">Nickname, mic routing, and room presence stay exactly as you set them.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Identity</p>
          <p className="mt-2 text-base font-semibold text-foreground">{nickname}</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Mic state</p>
          <Button
            variant={isAudioEnabled ? 'default' : 'destructive'}
            size="lg"
            onClick={onToggleAudio}
            className="mt-3 w-full"
            aria-label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </Button>
        </div>
        {!audioOnlyRoom && (
          <div className="rounded-2xl border border-border/50 bg-background/60 p-4 sm:col-span-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Video className="h-4 w-4 text-primary" />
              Camera preview stays available in video rooms.
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
        <h3 className="mb-3 text-base font-semibold text-foreground">Audio check</h3>
        <DeviceSelector
          audioDevices={audioDevices}
          videoDevices={videoDevices}
          selectedAudioDevice={selectedAudioDevice}
          selectedVideoDevice={selectedVideoDevice}
          onAudioDeviceChange={onAudioDeviceChange}
          onVideoDeviceChange={onVideoDeviceChange}
          showVideoSelector={!audioOnlyRoom}
        />
      </div>
    </section>
  );
}
