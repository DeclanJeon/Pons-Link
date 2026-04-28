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
      <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-background to-background p-4 shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(var(--primary),0.12),transparent_38%)] opacity-60" />
        <div className="relative flex items-center gap-4">
          <Avatar className="h-16 w-16 border border-primary/20 shadow-md shadow-primary/10">
            <AvatarImage src={selectedAvatar.url} alt={`Selected avatar ${selectedAvatar.seed}`} />
            <AvatarFallback>{selectedAvatar.seed.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/70">Active voice profile</p>
            <p className="mt-1 text-base font-semibold text-foreground">{selectedAvatar.seed}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              This profile represents you in audio rooms. Choose one freely; you can change it later.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-7">
        {presets.map((preset) => {
          const isSelected = preset.id === selectedAvatar.id;

          return (
            <Button
              key={preset.id}
              type="button"
              variant="ghost"
              onClick={() => onSelect(preset)}
              className={cn(
                'group h-auto rounded-2xl border bg-background/70 p-1.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/50 hover:shadow-md hover:shadow-primary/10',
                isSelected
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/25 shadow-md shadow-primary/10'
                  : 'border-border/50'
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
                  isSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
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
