import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { ScreenHeader } from '@/features/self-understanding/components/ScreenHeader';
import { SelfUnderstandingNav } from '@/features/self-understanding/components/SelfUnderstandingNav';
import { StandardInsightCard } from '@/features/self-understanding/components/StandardInsightCard';
import { useSelfUnderstandingStore } from '@/features/self-understanding/stores/useSelfUnderstandingStore';
import type { InsightCategory } from '@/features/self-understanding/types/selfUnderstanding';

const categoryMeta: Record<InsightCategory, { label: string; href: string; cta: string }> = {
  home: { label: 'Saved from Home', href: '/home', cta: 'Return home' },
  traits: { label: 'Saved from Traits', href: '/me/traits', cta: 'Go to traits' },
  relationships: { label: 'Saved from Relationships', href: '/me/relationships', cta: 'Go to relationships' },
  growth: { label: 'Saved from Growth', href: '/me/growth', cta: 'Go to growth' },
};

const Archive = () => {
  const { hydrateFromStorage, result, savedInsights, hydrated } = useSelfUnderstandingStore();

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  if (!hydrated) return <div className="min-h-screen bg-background" />;
  if (!result) return <Navigate to="/onboarding" replace />;

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <ScreenHeader
          label="Archive"
          title="Archive"
          description="Reread saved sentences and bring back the standard you need now."
          action={<Button asChild variant="outline" size="sm"><Link to="/home">Back home</Link></Button>}
        />

        <SelfUnderstandingNav />

        {savedInsights.length === 0 ? (
          <StandardInsightCard
            label="No saved sentences yet"
            summary="Save sentences that stay with you and revisit them here."
            interpretation="For now, save one sentence from Home, Relationships, or Growth first."
            action="Start by saving your core summary or today’s decision standard."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {savedInsights.map((item) => {
              const meta = categoryMeta[item.category];
              return (
                <Card key={item.id} className="border-border/60 bg-card/70 backdrop-blur-sm">
                  <CardContent className="p-0">
                    <StandardInsightCard
                      label={meta.label}
                      summary={item.summary}
                      interpretation={`Saved at: ${new Date(item.savedAt).toLocaleString()}`}
                      action="Reread the saved sentence and return directly to the screen you need."
                      className="border-0 bg-transparent shadow-none"
                    />
                  </CardContent>
                  <CardFooter className="px-6 pb-6 pt-0">
                    <Button asChild variant="outline" size="sm">
                      <Link to={meta.href}>{meta.cta}</Link>
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
};

export default Archive;
