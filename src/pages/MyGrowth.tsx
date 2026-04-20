import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/features/self-understanding/components/ScreenHeader';
import { HeroInsightCard } from '@/features/self-understanding/components/HeroInsightCard';
import { StandardInsightCard } from '@/features/self-understanding/components/StandardInsightCard';
import { SaveInsightButton } from '@/features/self-understanding/components/SaveInsightButton';
import { SelfUnderstandingNav } from '@/features/self-understanding/components/SelfUnderstandingNav';
import { useSelfUnderstandingStore } from '@/features/self-understanding/stores/useSelfUnderstandingStore';

const MyGrowth = () => {
  const { hydrateFromStorage, result, hydrated } = useSelfUnderstandingStore();

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  if (!hydrated) return <div className="min-h-screen bg-background" />;

  if (!result) return <Navigate to="/onboarding" replace />;

  const [decision, energy, reaction, balance, today] = result.growth;

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <ScreenHeader label="Growth" title="성장" description="흔들릴 때 다시 기준을 세우는 데 집중합니다." />

        <SelfUnderstandingNav />

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <HeroInsightCard
              label={decision.label}
              summary={decision.summary}
              interpretation={decision.interpretation}
              primaryAction={<SaveInsightButton id={decision.id} summary={decision.summary} category="growth" />}
              secondaryAction={<Button asChild variant="outline"><Link to="/home">홈으로 돌아가기</Link></Button>}
            />
          </div>
          <StandardInsightCard label={today.label} summary={today.summary} interpretation={today.interpretation} meaning={today.meaning} action={today.action} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <StandardInsightCard label={energy.label} summary={energy.summary} interpretation={energy.interpretation} example={energy.example} meaning={energy.meaning} action={energy.action} />
          <StandardInsightCard label={reaction.label} summary={reaction.summary} interpretation={reaction.interpretation} example={reaction.example} meaning={reaction.meaning} action={reaction.action} />
        </div>

        <StandardInsightCard label={balance.label} summary={balance.summary} interpretation={balance.interpretation} example={balance.example} meaning={balance.meaning} action={balance.action} />
      </div>
    </div>
  );
};

export default MyGrowth;
