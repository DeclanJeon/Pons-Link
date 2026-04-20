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
          title="지금의 나를 읽는 요약"
          description="오늘의 운세 대신, 당신을 설명하는 핵심 문장부터 보여드릴게요."
          action={recentSaved ? <Button asChild size="sm" variant="outline"><Link to="/me/archive">보관함 보기</Link></Button> : undefined}
        />

        <SelfUnderstandingNav />

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <HeroInsightCard
              label={result.overview.label}
              summary={result.overview.summary}
              interpretation={result.overview.interpretation}
              primaryAction={<Button asChild><Link to="/me/traits">내 기질 자세히 보기</Link></Button>}
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
            label="관계에서 기억할 점"
            summary={relationship.summary}
            interpretation={relationship.interpretation}
            meaning={relationship.meaning}
            action={relationship.action}
          />
          <StandardInsightCard
            label="지금 점검할 균형"
            summary={growth.summary}
            interpretation={growth.interpretation}
            meaning={growth.meaning}
            action={growth.action}
          />
        </div>

        {recentSaved ? (
          <StandardInsightCard
            label="최근 저장한 문장"
            summary={recentSaved.summary}
            interpretation={`저장 시각: ${new Date(recentSaved.savedAt).toLocaleString()}`}
            action="보관함에서 이 문장을 다시 읽고, 필요한 화면으로 바로 돌아갈 수 있어요."
          />
        ) : null}

      </div>
    </div>
  );
};

export default SelfUnderstandingHome;
