import { cn } from '@/lib/utils';
import type { CurrentFocus } from '../types/selfUnderstanding';
import { focusOptions } from '../constants/onboarding';

interface FocusSelectorProps {
  value: CurrentFocus;
  onChange: (value: CurrentFocus) => void;
}

export function FocusSelector({ value, onChange }: FocusSelectorProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {focusOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-xl border p-4 text-left transition-colors',
            value === option.value ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/40'
          )}
        >
          <p className="font-medium text-foreground">{option.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
        </button>
      ))}
    </div>
  );
}
