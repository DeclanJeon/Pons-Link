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
  const keywords = result.overview.tags ?? ['깊이형', '신중한 연결', '기준 중심'];

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <ScreenHeader
          label="Profile"
          title="내 요약 프로필"
          description="내 결과를 가장 짧고 선명하게 다시 읽는 프로필형 화면입니다."
          action={<Button asChild variant="outline" size="sm"><Link to="/me/archive">보관함 보기</Link></Button>}
        />

        <SelfUnderstandingNav />

        <HeroInsightCard
          label="한 줄 정체성 요약"
          summary={result.overview.summary}
          interpretation={result.overview.interpretation}
          primaryAction={<SaveInsightButton id={result.overview.id} summary={result.overview.summary} category="home" />}
          secondaryAction={<Button asChild variant="outline"><Link to="/me/traits">내 기질 자세히 보기</Link></Button>}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">나를 설명하는 키워드</p>
              <CardTitle className="text-lg">지금의 나를 요약하는 단어</CardTitle>
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
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">기억할 기준</p>
              <CardTitle className="text-lg">지금 붙들고 갈 한 문장</CardTitle>
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
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">강점 3개</p>
              <CardTitle className="text-lg">강점이 잘 살아나는 흐름</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>1. {strength.summary}</p>
              <p>2. {coreTrait.meaning ?? '깊이와 진정성이 중심이 되는 방식으로 움직일 수 있어요.'}</p>
              <p>3. {growth.meaning ?? '선택의 기준을 분명히 할수록 더 오래 힘을 낼 수 있어요.'}</p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">주의할 패턴</p>
              <CardTitle className="text-lg">흔들릴 때 먼저 점검할 것</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>1. {overload.summary}</p>
              <p>2. {overload.meaning ?? '능력 부족보다 기준이 흐려졌는지 먼저 점검해보는 편이 좋아요.'}</p>
              <p>3. {result.relationships[2]?.summary ?? '관계에서는 속도 차이가 오해를 만들 수 있어요.'}</p>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
};

export default MyProfile;
