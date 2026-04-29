import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AvatarPreset } from '@/lib/avatar/dicebear';

interface AvatarPickerProps {
  presets: AvatarPreset[];
  selectedAvatar: AvatarPreset;
  onSelect: (preset: AvatarPreset) => void;
}

export const AvatarPicker = ({ presets, selectedAvatar, onSelect }: AvatarPickerProps) => {
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,hsl(229_18%_14%_/_0.98),hsl(226_18%_10%_/_0.98))] p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)_/_0.16),transparent_38%),radial-gradient(circle_at_bottom_left,hsl(var(--primary-glow)_/_0.12),transparent_32%)]" />
        <div className="relative flex items-center gap-4">
          <Avatar className="h-16 w-16 border border-primary/25 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_12px_32px_-16px_hsl(var(--primary)_/_0.7)]">
            <AvatarImage src={selectedAvatar.url} alt={`Selected avatar ${selectedAvatar.seed}`} />
            <AvatarFallback>{selectedAvatar.seed.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-subtle/75">Active voice profile</p>
            <p className="mt-1 text-base font-semibold text-foreground">{selectedAvatar.seed}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-300/[0.72]">
              This profile represents you in audio rooms. Choose one freely; you can change it later.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-7">
        {presets.map((preset) => {
          const isSelected = preset.id === selectedAvatar.id;

          return (
            <Button
              key={preset.id}
              type="button"
              variant="ghost"
              onClick={() => onSelect(preset)}
              className={cn(
                'group h-auto rounded-[20px] border bg-white/[0.03] p-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/[0.35] hover:bg-white/[0.06] hover:shadow-[0_16px_30px_-22px_hsl(var(--primary)_/_0.85)]',
                isSelected
                  ? 'border-primary/[0.35] bg-primary/10 ring-1 ring-primary/30 shadow-[0_16px_30px_-22px_hsl(var(--primary)_/_0.95)]'
                  : 'border-white/[0.08]'
              )}
              aria-pressed={isSelected}
              aria-label={`Select avatar ${preset.seed}`}
            >
              <div className="flex flex-col items-center gap-1.5">
                <Avatar className="h-10 w-10 sm:h-11 sm:w-11">
                  <AvatarImage src={preset.url} alt={preset.seed} />
                  <AvatarFallback>{preset.seed.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className={cn(
                  'max-w-full truncate text-[10px] font-medium',
                  isSelected ? 'text-primary-subtle' : 'text-slate-400 group-hover:text-slate-100'
                )}>
                  {preset.seed}
                </span>
              </div>
            </Button>
          );
        })}
      </div>
    </div>
  );
};
