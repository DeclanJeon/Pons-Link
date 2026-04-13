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
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Avatar className="h-14 w-14 border border-border/60 shadow-sm">
          <AvatarImage src={selectedAvatar.url} alt={`Selected avatar ${selectedAvatar.seed}`} />
          <AvatarFallback>{selectedAvatar.seed.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium text-foreground">Selected profile</p>
          <p className="text-xs text-muted-foreground">{selectedAvatar.seed}</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
        {presets.map((preset) => {
          const isSelected = preset.id === selectedAvatar.id;

          return (
            <Button
              key={preset.id}
              type="button"
              variant="ghost"
              onClick={() => onSelect(preset)}
              className={cn(
                'h-auto rounded-xl border p-1.5 hover:bg-accent/60',
                isSelected ? 'border-primary bg-primary/10 ring-2 ring-primary/30' : 'border-border/50'
              )}
              aria-pressed={isSelected}
              aria-label={`Select avatar ${preset.seed}`}
            >
              <Avatar className="h-10 w-10 sm:h-11 sm:w-11">
                <AvatarImage src={preset.url} alt={preset.seed} />
                <AvatarFallback>{preset.seed.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </Button>
          );
        })}
      </div>
    </div>
  );
};
