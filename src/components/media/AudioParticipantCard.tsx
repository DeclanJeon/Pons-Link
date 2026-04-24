import { useEffect, useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Participant } from '@/hooks/useParticipants';
import type { AvatarPreset } from '@/lib/avatar/dicebear';
import { Mic, MicOff, Radio, ScreenShare, Sparkles, Volume2 } from 'lucide-react';
import { SubtitleOverlay } from './SubtitleOverlay';
import { useTranscriptionStore } from '@/stores/useTranscriptionStore';

interface AudioParticipantCardProps {
  participant: Participant;
  localAvatar?: AvatarPreset | null;
}

export const AudioParticipantCard = ({ participant, localAvatar }: AudioParticipantCardProps) => {
  const fallbackText = participant.nickname.slice(0, 2).toUpperCase();
  const avatarUrl = participant.isLocal ? (participant.avatarUrl || localAvatar?.url) : participant.avatarUrl;
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeakingNow, setIsSpeakingNow] = useState(false);
  const { translationTargetLanguage } = useTranscriptionStore();
  const shouldShowTranscript = !participant.isStreamingFile && participant.transcript;

  useEffect(() => {
    if (!participant.stream || !participant.audioEnabled) {
      setAudioLevel(0);
      setIsSpeakingNow(false);
      return;
    }

    const [audioTrack] = participant.stream.getAudioTracks();
    if (!audioTrack) {
      setAudioLevel(0);
      setIsSpeakingNow(false);
      return;
    }

    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    const context = new AudioContextCtor();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.82;

    const source = context.createMediaStreamSource(new MediaStream([audioTrack]));
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let frameId = 0;
    let silenceTimeout: ReturnType<typeof setTimeout> | null = null;

    const updateLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const normalizedLevel = Math.min(1, average / 72);
      setAudioLevel(normalizedLevel);

      if (normalizedLevel > 0.16) {
        setIsSpeakingNow(true);
        if (silenceTimeout) {
          clearTimeout(silenceTimeout);
          silenceTimeout = null;
        }
      } else if (!silenceTimeout) {
        silenceTimeout = setTimeout(() => {
          setIsSpeakingNow(false);
          silenceTimeout = null;
        }, 280);
      }

      frameId = window.requestAnimationFrame(updateLevel);
    };

    updateLevel();

    return () => {
      window.cancelAnimationFrame(frameId);
      if (silenceTimeout) {
        clearTimeout(silenceTimeout);
      }
      source.disconnect();
      analyser.disconnect();
      if (context.state !== 'closed') {
        void context.close();
      }
    };
  }, [participant.stream, participant.audioEnabled]);

  const activeSpeaking = participant.audioEnabled && participant.connectionState === 'connected' && isSpeakingNow;
  const levelBars = useMemo(
    () => [0.35, 0.6, 0.85, 0.55].map((multiplier, index) => ({
      id: index,
      height: `${Math.max(18, 18 + audioLevel * 38 * multiplier)}px`,
    })),
    [audioLevel]
  );

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-[28px] border p-5 shadow-sm transition-all duration-300',
        activeSpeaking
          ? 'border-primary/40 bg-gradient-to-br from-primary/12 via-card to-card ring-1 ring-primary/20 shadow-lg shadow-primary/10'
          : 'border-border/60 bg-card/80 backdrop-blur-sm hover:border-primary/20 hover:shadow-md'
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(var(--primary),0.12),transparent_35%)] opacity-70" />
      <div className="relative flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative">
              <div className={cn(
                'absolute inset-0 rounded-full bg-primary/20 blur-xl transition-opacity duration-300',
                activeSpeaking ? 'opacity-100' : 'opacity-0'
              )} />
              <Avatar className={cn(
                'relative h-16 w-16 border shadow-md shadow-black/5 transition-all duration-300',
                activeSpeaking ? 'border-primary/50 ring-4 ring-primary/15 scale-[1.04]' : 'border-border/70'
              )}>
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={participant.nickname} /> : null}
                <AvatarFallback className="text-lg font-semibold">{fallbackText}</AvatarFallback>
              </Avatar>
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">
                {participant.nickname} {participant.isLocal ? '(You)' : ''}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium',
                  activeSpeaking ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                )}>
                  <Radio className="h-3.5 w-3.5" />
                  {activeSpeaking ? 'Speaking now' : participant.connectionState}
                </span>
                {participant.isLocal && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2.5 py-1 text-[11px] font-medium text-foreground/70">
                    <Sparkles className="h-3.5 w-3.5" />
                    Local profile
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {participant.isSharingScreen && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                <ScreenShare className="h-3.5 w-3.5" />
                Screen
              </span>
            )}
            <span className={cn(
              'inline-flex items-center justify-center rounded-full p-2',
              participant.audioEnabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'
            )}>
              {participant.audioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-background/70 px-3 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">Voice activity</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {activeSpeaking
                ? 'Speaking now. Voice energy is reacting in real-time.'
                : participant.audioEnabled
                  ? 'Quiet now. The card will come alive when you start speaking.'
                  : 'Microphone is off. Voice activity is not being detected.'}
            </p>
          </div>
          <div className="flex items-end gap-1.5 rounded-full bg-primary/5 px-3 py-2">
            <Volume2 className={cn('h-3.5 w-3.5 mb-1 transition-colors', activeSpeaking ? 'text-primary' : 'text-muted-foreground')} />
            {levelBars.map((bar) => (
              <span
                key={bar.id}
                className={cn(
                  'w-1.5 rounded-full transition-all duration-150',
                  activeSpeaking ? 'bg-primary shadow-[0_0_12px_rgba(99,102,241,0.35)]' : 'bg-primary/30'
                )}
                style={{ height: participant.audioEnabled ? bar.height : '10px' }}
              />
            ))}
          </div>
        </div>
        {shouldShowTranscript && (
          <div className="mt-1">
            <SubtitleOverlay transcript={participant.transcript} targetLang={translationTargetLanguage} />
          </div>
        )}
      </div>
    </div>
  );
};
