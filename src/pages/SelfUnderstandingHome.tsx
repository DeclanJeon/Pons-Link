import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/features/self-understanding/components/ScreenHeader';
import { HeroInsightCard } from '@/features/self-understanding/components/HeroInsightCard';
import { StandardInsightCard } from '@/features/self-understanding/components/StandardInsightCard';
import { SaveInsightButton } from '@/features/self-understanding/components/SaveInsightButton';
import { SelfUnderstandingNav } from '@/features/self-understanding/components/SelfUnderstandingNav';
import { useSelfUnderstandingStore } from '@/features/self-understanding/stores/useSelfUnderstandingStore';

const SelfUnderstandingHome = () => {
  const { hydrateFromStorage, result, savedInsights, hydrated } = useSelfUnderstandingStore();

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  if (!hydrated) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!result) {
    return <Navigate to="/onboarding" replace />;
  }

  const strength = result.strengths[0];
  const relationship = result.relationships[0];
  const growth = result.growth[result.growth.length - 1];
  const recentSaved = savedInsights[0];

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <ScreenHeader
          label="Home"
          title="A summary for reading yourself now"
          description="Instead of a daily fortune, start with the core sentence that explains you."
          action={recentSaved ? <Button asChild size="sm" variant="outline"><Link to="/me/archive">View archive</Link></Button> : undefined}
        />

        <SelfUnderstandingNav />

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <HeroInsightCard
              label={result.overview.label}
              summary={result.overview.summary}
              interpretation={result.overview.interpretation}
              primaryAction={<Button asChild><Link to="/me/traits">View traits in detail</Link></Button>}
              secondaryAction={<SaveInsightButton id={result.overview.id} summary={result.overview.summary} category="home" />}
            />
          </div>
          <StandardInsightCard
            label={strength.label}
            summary={strength.summary}
            interpretation={strength.interpretation}
            example={strength.example}
            action={strength.action}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <StandardInsightCard
            label="Relationship notes"
            summary={relationship.summary}
            interpretation={relationship.interpretation}
            meaning={relationship.meaning}
            action={relationship.action}
          />
          <StandardInsightCard
            label="Balance to check now"
            summary={growth.summary}
            interpretation={growth.interpretation}
            meaning={growth.meaning}
            action={growth.action}
          />
        </div>

        {recentSaved ? (
          <StandardInsightCard
            label="Recently saved sentence"
            summary={recentSaved.summary}
            interpretation={`Saved at: ${new Date(recentSaved.savedAt).toLocaleString()}`}
            action="You can reread this sentence in the archive and return to the relevant screen."
          />
        ) : null}

      </div>
    </div>
  );
};

export default SelfUnderstandingHome;
