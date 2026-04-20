import { useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScreenHeader } from '@/features/self-understanding/components/ScreenHeader';
import { SelfUnderstandingNav } from '@/features/self-understanding/components/SelfUnderstandingNav';
import { useSelfUnderstandingStore } from '@/features/self-understanding/stores/useSelfUnderstandingStore';

const MySettings = () => {
  const navigate = useNavigate();
  const { hydrateFromStorage, result, coreInput, savedInsights, hydrated, resetAll, generateResult } = useSelfUnderstandingStore();

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  if (!hydrated) return <div className="min-h-screen bg-background" />;
  if (!result) return <Navigate to="/onboarding" replace />;

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <ScreenHeader
          label="Settings"
          title="설정"
          description="표현과 데이터 흐름을 최소 범위에서 정리하는 화면입니다."
          action={<Button asChild variant="outline" size="sm"><Link to="/home">홈으로 돌아가기</Link></Button>}
        />

        <SelfUnderstandingNav />

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">현재 입력 상태</p>
              <CardTitle className="text-lg">지금 결과를 만든 기준</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>출생일: {coreInput.birthDate || '미입력'}</p>
              <p>출생 시간 모드: {coreInput.birthTimeMode}</p>
              <p>시간대/지역: {coreInput.timezoneOrBirthplace}</p>
              <p>현재 포커스: {coreInput.currentFocus}</p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">저장 상태</p>
              <CardTitle className="text-lg">보관 중인 문장</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>저장한 문장 수: {savedInsights.length}개</p>
              <p>최근 생성 시각: {new Date(result.generatedAt).toLocaleString()}</p>
              <p>결과와 저장 문장은 모두 local-first로 이 브라우저에 보관됩니다.</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">결과 다시 만들기</p>
              <CardTitle className="text-lg">현재 입력으로 다시 정리</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>입력은 유지한 채 결과를 다시 생성합니다. 문구 변화나 카드 구조 점검용으로 사용할 수 있어요.</p>
              <Button
                variant="outline"
                onClick={() => {
                  generateResult();
                  navigate('/home');
                }}
              >
                결과 다시 만들기
              </Button>
            </CardContent>
          </Card>

          <Card className="border-destructive/30 bg-card/70 backdrop-blur-sm">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-destructive">데이터 초기화</p>
              <CardTitle className="text-lg">온보딩부터 다시 시작</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>입력, 결과, 저장한 문장을 모두 지우고 자기이해 온보딩부터 다시 시작합니다.</p>
              <Button
                variant="destructive"
                onClick={() => {
                  resetAll();
                  navigate('/onboarding');
                }}
              >
                전체 초기화
              </Button>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
};

export default MySettings;
