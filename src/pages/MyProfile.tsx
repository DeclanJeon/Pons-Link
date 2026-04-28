import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScreenHeader } from '@/features/self-understanding/components/ScreenHeader';
import { HeroInsightCard } from '@/features/self-understanding/components/HeroInsightCard';
import { SaveInsightButton } from '@/features/self-understanding/components/SaveInsightButton';
import { SelfUnderstandingNav } from '@/features/self-understanding/components/SelfUnderstandingNav';
import { useSelfUnderstandingStore } from '@/features/self-understanding/stores/useSelfUnderstandingStore';

const MyProfile = () => {
  const { hydrateFromStorage, result, hydrated } = useSelfUnderstandingStore();

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  if (!hydrated) return <div className="min-h-screen bg-background" />;
  if (!result) return <Navigate to="/onboarding" replace />;

  const coreTrait = result.traits[0];
  const strength = result.strengths[0];
  const overload = result.traits[2];
  const growth = result.growth[0];
  const keywords = result.overview.tags ?? ['Deep focus', 'Careful connection', 'Standard-led'];

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <ScreenHeader
          label="Profile"
          title="My summary profile"
          description="A profile-style view that rereads your result in the shortest, clearest form."
          action={<Button asChild variant="outline" size="sm"><Link to="/me/archive">View archive</Link></Button>}
        />

        <SelfUnderstandingNav />

        <HeroInsightCard
          label="One-line identity summary"
          summary={result.overview.summary}
          interpretation={result.overview.interpretation}
          primaryAction={<SaveInsightButton id={result.overview.id} summary={result.overview.summary} category="home" />}
          secondaryAction={<Button asChild variant="outline"><Link to="/me/traits">View traits in detail</Link></Button>}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Keywords that explain me</p>
              <CardTitle className="text-lg">Words that summarize me now</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <span key={keyword} className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
                  {keyword}
                </span>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Standard to remember</p>
              <CardTitle className="text-lg">One sentence to hold onto now</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>{growth.summary}</p>
              <p className="rounded-md bg-muted/50 px-3 py-2 text-foreground">{growth.action}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Three strengths</p>
              <CardTitle className="text-lg">The flow where strengths come alive</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>1. {strength.summary}</p>
              <p>2. {coreTrait.meaning ?? 'You may move best when depth and sincerity stay at the center.'}</p>
              <p>3. {growth.meaning ?? 'The clearer your decision standard is, the longer your energy can last.'}</p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Pattern to watch</p>
              <CardTitle className="text-lg">What to check first when you feel unstable</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>1. {overload.summary}</p>
              <p>2. {overload.meaning ?? 'It may help to check whether your standard has become blurry before assuming you lack ability.'}</p>
              <p>3. {result.relationships[2]?.summary ?? 'In relationships, differences in pace can create misunderstandings.'}</p>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
};

export default MyProfile;
