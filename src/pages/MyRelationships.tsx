import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/features/self-understanding/components/ScreenHeader';
import { HeroInsightCard } from '@/features/self-understanding/components/HeroInsightCard';
import { StandardInsightCard } from '@/features/self-understanding/components/StandardInsightCard';
import { SaveInsightButton } from '@/features/self-understanding/components/SaveInsightButton';
import { SelfUnderstandingNav } from '@/features/self-understanding/components/SelfUnderstandingNav';
import { useSelfUnderstandingStore } from '@/features/self-understanding/stores/useSelfUnderstandingStore';

const MyRelationships = () => {
  const { hydrateFromStorage, result, hydrated } = useSelfUnderstandingStore();

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  if (!hydrated) return <div className="min-h-screen bg-background" />;

  if (!result) return <Navigate to="/onboarding" replace />;

  const [rhythm, comfort, friction, communication, repair] = result.relationships;

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <ScreenHeader label="Relationships" title="관계" description="잘 맞고 안 맞고를 넘어서, 어떤 차이가 있는지 읽어봅니다." />

        <SelfUnderstandingNav />

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <HeroInsightCard
              label={rhythm.label}
              summary={rhythm.summary}
              interpretation={rhythm.interpretation}
              primaryAction={<SaveInsightButton id={rhythm.id} summary={rhythm.summary} category="relationships" />}
              secondaryAction={<Button asChild variant="outline"><Link to="/me/growth">성장 화면으로 이동</Link></Button>}
            />
          </div>
          <StandardInsightCard label={communication.label} summary={communication.summary} interpretation={communication.interpretation} example={communication.example} action={communication.action} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <StandardInsightCard label={comfort.label} summary={comfort.summary} interpretation={comfort.interpretation} example={comfort.example} meaning={comfort.meaning} action={comfort.action} />
          <StandardInsightCard label={friction.label} summary={friction.summary} interpretation={friction.interpretation} example={friction.example} meaning={friction.meaning} action={friction.action} />
        </div>

        <StandardInsightCard label={repair.label} summary={repair.summary} interpretation={repair.interpretation} example={repair.example} meaning={repair.meaning} action={repair.action} />

      </div>
    </div>
  );
};

export default MyRelationships;
