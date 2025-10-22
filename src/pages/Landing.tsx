import { CosmicBackground } from "@/components/landing/CosmicBackground";
import { Header } from "@/components/landing/Header";
import { RoomInfo } from "@/components/landing/RoomInfo";
import { SelectionMode } from "@/components/landing/SelectionMode";

const Landing = () => {
  return (
    <div className="min-h-screen relative overflow-hidden cosmic-bg">
      {/* 배경 레이어: 우주적 분위기를 조성하는 애니메이션 배경 */}
      <CosmicBackground />

      {/* 메인 콘텐츠 레이어: z-10으로 배경 위에 배치 */}
      <div className="relative z-10 min-h-screen flex items-center justify-center py-8 md:py-12">
        <div className="w-full max-w-6xl px-4 md:px-6">

          {/* 헤더 섹션: 브랜드 아이덴티티 및 주요 메시지 */}
          <div className="animate-fade-in-up mb-8 md:mb-12">
            <Header />
          </div>

          {/* 주요 상호작용 영역: 방 타입 선택 및 정보 입력 */}
          <div className="space-y-6 md:space-y-8">

            {/* 방 타입 선택: Public/Private 선택 인터페이스 */}
            <div className="animate-fade-in-up animation-delay-200">
              <SelectionMode />
            </div>

            {/* 방 정보 입력: 제목, 닉네임, 연결 버튼 */}
            <div className="animate-fade-in-up animation-delay-400">
              <RoomInfo />
            </div>
          </div>

          {/* 푸터 메시지: 브랜드 가치 및 철학 전달 */}
          <div className="text-center mt-8 md:mt-12 animate-fade-in-up animation-delay-600">
            <p className="text-muted-foreground/70 text-xs md:text-sm tracking-wide">
              Experience design that disappears into pure connection
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;
