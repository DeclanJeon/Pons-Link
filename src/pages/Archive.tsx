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
  home: { label: '홈에서 저장함', href: '/home', cta: '홈에서 다시 보기' },
  traits: { label: '내 기질에서 저장함', href: '/me/traits', cta: '내 기질로 이동' },
  relationships: { label: '관계에서 저장함', href: '/me/relationships', cta: '관계 화면으로 이동' },
  growth: { label: '성장에서 저장함', href: '/me/growth', cta: '성장 화면으로 이동' },
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
          title="보관함"
          description="저장한 문장을 다시 읽고, 지금의 나에게 필요한 기준을 다시 불러옵니다."
          action={<Button asChild variant="outline" size="sm"><Link to="/home">홈으로 돌아가기</Link></Button>}
        />

        <SelfUnderstandingNav />

        {savedInsights.length === 0 ? (
          <StandardInsightCard
            label="아직 저장한 문장이 없어요"
            summary="마음에 남는 문장을 저장하면 여기서 다시 꺼내볼 수 있어요."
            interpretation="지금은 홈, 관계, 성장 화면에서 마음에 남는 한 문장을 먼저 저장해보는 게 좋아요."
            action="핵심 요약이나 오늘의 선택 기준부터 저장해보세요."
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
                      interpretation={`저장 시각: ${new Date(item.savedAt).toLocaleString()}`}
                      action="저장한 문장을 다시 읽고, 지금 필요한 화면으로 바로 돌아갈 수 있어요."
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
