import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/features/self-understanding/components/ScreenHeader';
import { HeroInsightCard } from '@/features/self-understanding/components/HeroInsightCard';
import { StandardInsightCard } from '@/features/self-understanding/components/StandardInsightCard';
import { SaveInsightButton } from '@/features/self-understanding/components/SaveInsightButton';
import { SelfUnderstandingNav } from '@/features/self-understanding/components/SelfUnderstandingNav';
import { useSelfUnderstandingStore } from '@/features/self-understanding/stores/useSelfUnderstandingStore';

const MyTraits = () => {
  const { hydrateFromStorage, result, hydrated } = useSelfUnderstandingStore();

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  if (!hydrated) return <div className="min-h-screen bg-background" />;

  if (!result) return <Navigate to="/onboarding" replace />;

  const [coreTrait, strength, overload, recovery] = result.traits;

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <ScreenHeader label="Self Understanding" title="Traits" description="Read how you use energy and recover in your own way." />

        <SelfUnderstandingNav />

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <HeroInsightCard
              label={coreTrait.label}
              summary={coreTrait.summary}
              interpretation={coreTrait.interpretation}
              primaryAction={<SaveInsightButton id={coreTrait.id} summary={coreTrait.summary} category="traits" />}
              secondaryAction={<Button asChild variant="outline"><Link to="/me/relationships">View relationships</Link></Button>}
            />
          </div>
          <StandardInsightCard label={recovery.label} summary={recovery.summary} interpretation={recovery.interpretation} example={recovery.example} action={recovery.action} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <StandardInsightCard label={strength.label} summary={strength.summary} interpretation={strength.interpretation} example={strength.example} meaning={strength.meaning} action={strength.action} />
          <StandardInsightCard label={overload.label} summary={overload.summary} interpretation={overload.interpretation} example={overload.example} meaning={overload.meaning} action={overload.action} />
        </div>

      </div>
    </div>
  );
};

export default MyTraits;
