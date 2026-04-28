import type { BirthTimeMode } from '../types/selfUnderstanding';
import { cn } from '@/lib/utils';

interface TimeModeSelectorProps {
  value: BirthTimeMode;
  onChange: (value: BirthTimeMode) => void;
}

const options: Array<{ value: BirthTimeMode; label: string; description: string }> = [
  { value: 'exact', label: 'I know it exactly', description: 'You can enter the hour and minute.' },
  { value: 'approximate', label: 'I know roughly', description: 'You can choose a time range instead.' },
  { value: 'unknown', label: 'I am not sure', description: 'Start with a default reading first.' },
];

export function TimeModeSelector({ value, onChange }: TimeModeSelectorProps) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-xl border p-4 text-left transition hover:border-primary/50 hover:bg-primary/5',
            value === option.value ? 'border-primary bg-primary/10 shadow-sm' : 'border-border/70 bg-card',
          )}
        >
          <span className="block font-medium text-foreground">{option.label}</span>
          <span className="mt-2 block text-sm text-muted-foreground">{option.description}</span>
        </button>
      ))}
    </div>
  );
}
