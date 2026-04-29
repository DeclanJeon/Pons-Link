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
    <section
      aria-label="Readiness panel"
      className="space-y-4 rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,hsl(229_22%_10%_/_0.98),hsl(224_26%_7%_/_0.98))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5"
    >
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary-subtle/75">Readiness</p>
        <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">Everything you need before entry</h2>
        <p className="text-sm leading-6 text-slate-300/[0.74]">Nickname, mic routing, and room presence stay exactly as you set them.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[22px] border border-white/[0.08] bg-black/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Identity</p>
          <p className="mt-2 text-base font-semibold text-foreground">{nickname}</p>
        </div>
        <div className="rounded-[22px] border border-white/[0.08] bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Mic state</p>
            <span
              className={
                isAudioEnabled
                  ? 'inline-flex rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary-subtle'
                  : 'inline-flex rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-slate-300'
              }
            >
              {isAudioEnabled ? 'Live' : 'Muted'}
            </span>
          </div>
          <Button
            variant="secondary"
            size="lg"
            onClick={onToggleAudio}
            className={
              isAudioEnabled
                ? 'mt-3 w-full rounded-2xl border border-primary/[0.15] bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary-glow)))] text-primary-foreground shadow-[0_16px_36px_-18px_hsl(var(--primary)_/_0.85)] hover:opacity-95'
                : 'mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.05] text-foreground hover:bg-white/[0.09]'
            }
            aria-label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </Button>
        </div>
        {!audioOnlyRoom && (
          <div className="rounded-[22px] border border-white/[0.08] bg-black/20 p-4 sm:col-span-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Video className="h-4 w-4 text-primary-subtle" />
              Camera preview stays available in video rooms.
            </div>
          </div>
        )}
      </div>

      <div className="rounded-[22px] border border-white/[0.08] bg-black/20 p-4">
        <h3 className="mb-3 text-base font-semibold text-foreground">Audio check</h3>
        <DeviceSelector
          audioDevices={audioDevices}
          videoDevices={videoDevices}
          selectedAudioDevice={selectedAudioDevice}
          selectedVideoDevice={selectedVideoDevice}
          onAudioDeviceChange={onAudioDeviceChange}
          onVideoDeviceChange={onVideoDeviceChange}
          showVideoSelector={!audioOnlyRoom}
          surface="dark"
        />
      </div>
    </section>
  );
}
