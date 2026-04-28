import { Progress } from '@/components/ui/progress';

interface OnboardingStepperProps {
  step: number;
  total: number;
  title: string;
  description: string;
}

export function OnboardingStepper({ step, total, title, description }: OnboardingStepperProps) {
  const percent = (step / total) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{step} / {total}</span>
        <span>Self-understanding onboarding</span>
      </div>
      <Progress value={percent} />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
        <p className="text-sm text-muted-foreground md:text-base">{description}</p>
      </div>
    </div>
  );
}
