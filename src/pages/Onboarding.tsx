import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { OnboardingStepper } from '@/features/self-understanding/components/OnboardingStepper';
import { TimeModeSelector } from '@/features/self-understanding/components/TimeModeSelector';
import { FocusSelector } from '@/features/self-understanding/components/FocusSelector';
import { onboardingPreviewCards } from '@/features/self-understanding/constants/onboarding';
import { useSelfUnderstandingStore } from '@/features/self-understanding/stores/useSelfUnderstandingStore';
import type { BirthTimeMode, CurrentFocus, TimeRange } from '@/features/self-understanding/types/selfUnderstanding';

const stepCopy = [
  {
    title: 'Start with a guide for understanding yourself',
    description: 'This service does not predict the future; it helps you read your traits, relationship rhythm, and growth standards.',
  },
  {
    title: 'Enter only what you know',
    description: 'We only ask for the minimum information needed to create your first result.',
  },
  {
    title: 'Choose what you want to understand first',
    description: 'This choice sets the first emphasis of your result.',
  },
  {
    title: 'Preview the result you will receive',
    description: 'Start with the core summary, then refine it later if you want more depth.',
  },
] as const;

const Onboarding = () => {
  const navigate = useNavigate();
  const { coreInput, hydrateFromStorage, updateCoreInput, generateResult } = useSelfUnderstandingStore();
  const [step, setStep] = useState(1);

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  const current = stepCopy[step - 1];
  const canContinue = useMemo(() => {
    if (step === 2) {
      return Boolean(coreInput.birthDate && coreInput.timezoneOrBirthplace.trim());
    }
    return true;
  }, [coreInput.birthDate, coreInput.timezoneOrBirthplace, step]);

  const next = () => setStep((value) => Math.min(4, value + 1));
  const back = () => setStep((value) => Math.max(1, value - 1));

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground md:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <OnboardingStepper step={step} total={4} title={current.title} description={current.description} />

        <Card className="border-border/60 bg-card/85 backdrop-blur-sm">
          <CardContent className="space-y-6 p-6 md:p-8">
            {step === 1 ? (
              <div className="space-y-5">
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">This is not a fortune-telling app; it is a guide for understanding yourself.</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">Traits</span>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">Relationship rhythm</span>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">Growth standard</span>
                  </div>
                </div>
                <Button onClick={next}>Start</Button>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Birth date</label>
                  <Input type="date" value={coreInput.birthDate} onChange={(e) => updateCoreInput({ birthDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Birth time</label>
                  <TimeModeSelector
                    mode={coreInput.birthTimeMode as BirthTimeMode}
                    timeValue={coreInput.birthTimeValue}
                    timeRange={coreInput.timeRange as TimeRange | undefined}
                    onModeChange={(mode) => updateCoreInput({ birthTimeMode: mode, birthTimeValue: undefined, timeRange: undefined })}
                    onTimeValueChange={(value) => updateCoreInput({ birthTimeValue: value })}
                    onTimeRangeChange={(value) => updateCoreInput({ timeRange: value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Birthplace or timezone reference</label>
                  <Input
                    value={coreInput.timezoneOrBirthplace}
                    onChange={(e) => updateCoreInput({ timezoneOrBirthplace: e.target.value })}
                    placeholder="Example: Asia/Seoul or Seoul"
                  />
                  <p className="text-sm text-muted-foreground">You can start with only what you know.</p>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <FocusSelector value={coreInput.currentFocus as CurrentFocus} onChange={(value) => updateCoreInput({ currentFocus: value })} />
            ) : null}

            {step === 4 ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {onboardingPreviewCards.map((card) => (
                    <Card key={card.label} className="border-border/60 bg-muted/20">
                      <CardContent className="space-y-2 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">{card.label}</p>
                        <p className="font-medium text-foreground">{card.summary}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">Review the core result first, then expand it later if needed.</p>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 pt-2">
              <Button variant="ghost" onClick={back} disabled={step === 1}>Back</Button>
              {step < 4 ? (
                <Button onClick={next} disabled={!canContinue}>Next</Button>
              ) : (
                <Button
                  onClick={() => {
                    generateResult();
                    navigate('/home');
                  }}
                >
                  지금 결과 보기
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Onboarding;
