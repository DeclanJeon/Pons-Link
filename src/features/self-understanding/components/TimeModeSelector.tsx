import { cn } from '@/lib/utils';
import type { BirthTimeMode, TimeRange } from '../types/selfUnderstanding';
import { timeRangeOptions } from '../constants/onboarding';

interface TimeModeSelectorProps {
  mode: BirthTimeMode;
  timeValue?: string;
  timeRange?: TimeRange;
  onModeChange: (mode: BirthTimeMode) => void;
  onTimeValueChange: (value: string) => void;
  onTimeRangeChange: (value: TimeRange) => void;
}

const modeOptions: Array<{ value: BirthTimeMode; label: string; description: string }> = [
  { value: 'exact', label: '정확히 알아요', description: '시/분까지 입력할 수 있어요.' },
  { value: 'approximate', label: '대략 알아요', description: '시간대를 선택할 수 있어요.' },
  { value: 'unknown', label: '모르겠어요', description: '기본 해석으로 먼저 볼 수 있어요.' },
];

export function TimeModeSelector({ mode, timeValue, timeRange, onModeChange, onTimeValueChange, onTimeRangeChange }: TimeModeSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {modeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onModeChange(option.value)}
            className={cn(
              'rounded-xl border p-4 text-left transition-colors',
              mode === option.value ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/40'
            )}
          >
            <p className="font-medium text-foreground">{option.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
          </button>
        ))}
      </div>

      {mode === 'exact' ? (
        <input
          type="time"
          value={timeValue ?? ''}
          onChange={(event) => onTimeValueChange(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      ) : null}

      {mode === 'approximate' ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {timeRangeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onTimeRangeChange(option.value)}
              className={cn(
                'rounded-md border px-3 py-2 text-sm',
                timeRange === option.value ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {mode === 'unknown' ? (
        <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          시간을 몰라도 먼저 시작할 수 있어요. 나중에 알게 되면 결과를 더 정교하게 업데이트할 수 있어요.
        </p>
      ) : null}
    </div>
  );
}
