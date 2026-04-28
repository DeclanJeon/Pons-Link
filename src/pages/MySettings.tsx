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
          label="설정"
          title="설정"
          description="표현 방식과 저장된 데이터 흐름을 관리합니다."
          action={<Button asChild variant="outline" size="sm"><Link to="/home">홈으로 돌아가기</Link></Button>}
        />

        <SelfUnderstandingNav />

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">입력 상태</p>
              <CardTitle className="text-lg">현재 결과에 사용된 입력</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>출생일: {coreInput.birthDate || '입력하지 않음'}</p>
              <p>출생 시간 모드: {coreInput.birthTimeMode}</p>
              <p>시간대/장소: {coreInput.timezoneOrBirthplace}</p>
              <p>현재 초점: {coreInput.currentFocus}</p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">저장 상태</p>
              <CardTitle className="text-lg">보관한 문장</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>저장한 문장 수: {savedInsights.length}개</p>
              <p>마지막 생성 시각: {new Date(result.generatedAt).toLocaleString()}</p>
              <p>결과와 저장 문장은 이 브라우저에 먼저 저장됩니다.</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/60 bg-card/70 backdrop-blur-sm">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">결과 다시 생성</p>
              <CardTitle className="text-lg">현재 입력으로 다시 생성</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>입력은 유지한 채 결과만 다시 생성합니다. 문구나 카드 구조를 다시 확인할 때 사용합니다.</p>
              <Button
                variant="outline"
                onClick={() => {
                  generateResult();
                  navigate('/home');
                }}
              >
                결과 다시 생성
              </Button>
            </CardContent>
          </Card>

          <Card className="border-destructive/30 bg-card/70 backdrop-blur-sm">
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-destructive">데이터 초기화</p>
              <CardTitle className="text-lg">온보딩부터 다시 시작</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>입력, 결과, 저장한 문장을 모두 지우고 온보딩부터 다시 시작합니다.</p>
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
