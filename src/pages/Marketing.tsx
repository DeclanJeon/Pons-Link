import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const sampleCards = [
  {
    label: '나의 핵심 요약',
    summary: '혼자 정리한 뒤, 관계 속에서 힘을 발휘하는 편이에요.',
  },
  {
    label: '관계에서 기억할 점',
    summary: '속도보다 신뢰의 리듬이 더 중요하게 느껴질 수 있어요.',
  },
  {
    label: '오늘의 선택 기준',
    summary: '빨리 맞는 답보다 오래 납득할 수 있는 기준을 먼저 세워보세요.',
  },
];

const Marketing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-10 px-4 py-12 md:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-6">
            <p className="text-sm font-medium uppercase tracking-[0.28em] text-primary">PonsLink</p>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
                사주가 아니라, 나를 이해하는 가이드
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                왜 같은 상황에서 비슷한 패턴을 반복하는지 모르겠다면, 내 기질과 강점, 관계 리듬,
                선택의 기준을 먼저 읽어보세요. PonsLink는 예측보다 해석, 점수보다 이해에 집중합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={() => navigate('/onboarding')}>내 결과 시작하기</Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/legacy-home')}>기존 실시간 공간 보기</Button>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span className="rounded-full bg-muted px-3 py-1">내 기질</span>
              <span className="rounded-full bg-muted px-3 py-1">관계 리듬</span>
              <span className="rounded-full bg-muted px-3 py-1">성장 기준</span>
            </div>
          </div>

          <div className="grid gap-4">
            {sampleCards.map((card) => (
              <Card key={card.label} className="border-border/60 bg-card/90 backdrop-blur-sm">
                <CardContent className="space-y-2 p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">{card.label}</p>
                  <p className="text-lg font-medium leading-7">{card.summary}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Marketing;
