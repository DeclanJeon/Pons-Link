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
    title: '나를 이해하는 가이드로 시작할게요',
    description: '이 서비스는 미래 예측이 아니라, 내 기질과 관계 리듬, 성장 기준을 읽는 데 집중해요.',
  },
  {
    title: '알고 있는 만큼만 입력해도 괜찮아요',
    description: '첫 결과를 만드는 데 필요한 최소 정보만 먼저 받을게요.',
  },
  {
    title: '지금 가장 알고 싶은 방향을 골라주세요',
    description: '이 선택은 결과의 첫 강조점을 정하는 데 쓰여요.',
  },
  {
    title: '곧 받게 될 결과를 먼저 볼게요',
    description: '핵심 요약부터 보고, 원하면 나중에 더 깊게 다듬을 수 있어요.',
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
                  <p className="text-sm text-muted-foreground">사주를 보는 앱이 아니라, 나를 이해하는 가이드입니다.</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">내 기질</span>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">관계 리듬</span>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">성장 기준</span>
                  </div>
                </div>
                <Button onClick={next}>시작하기</Button>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium">출생일</label>
                  <Input type="date" value={coreInput.birthDate} onChange={(e) => updateCoreInput({ birthDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">출생 시간</label>
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
                  <label className="text-sm font-medium">출생 지역 또는 시간대 기준값</label>
                  <Input
                    value={coreInput.timezoneOrBirthplace}
                    onChange={(e) => updateCoreInput({ timezoneOrBirthplace: e.target.value })}
                    placeholder="예: Asia/Seoul 또는 Seoul"
                  />
                  <p className="text-sm text-muted-foreground">알고 있는 만큼만 입력해도 시작할 수 있어요.</p>
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
                <p className="text-sm text-muted-foreground">먼저 핵심 결과를 보고, 원하면 더 깊게 확장할 수 있어요.</p>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 pt-2">
              <Button variant="ghost" onClick={back} disabled={step === 1}>이전</Button>
              {step < 4 ? (
                <Button onClick={next} disabled={!canContinue}>다음</Button>
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
