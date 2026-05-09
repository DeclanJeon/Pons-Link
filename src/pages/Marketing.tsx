import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  FileCheck,
  FileUp,
  Globe,
  Languages,
  MessageSquareText,
  Mic,
  MonitorUp,
  Network,
  PlaySquare,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UsersRound,
  Video,
  XCircle,
} from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const sectionClass = 'relative mx-auto w-full max-w-[1200px] px-5 py-16 sm:px-8 lg:py-24';
const cardClass = 'rounded-2xl border border-[#D9E3F5] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.055)]';
const primaryButtonClass = 'inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1E63FF] px-6 text-sm font-bold text-white shadow-[0_16px_38px_rgba(30,99,255,0.28)] transition hover:-translate-y-0.5 hover:bg-[#174FD1] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1E63FF]/25';
const secondaryButtonClass = 'inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#D9E3F5] bg-white px-6 text-sm font-bold text-slate-900 shadow-[0_12px_28px_rgba(15,23,42,0.055)] transition hover:-translate-y-0.5 hover:border-[#BCD4FF] hover:bg-[#F8FBFF] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1E63FF]/20';

const painPoints = [
  {
    title: '맥락 부족',
    description: '누가, 왜, 무엇을 원하는지 모른 채 링크부터 보내게 됩니다.',
    icon: UserCheck,
  },
  {
    title: '언어 장벽',
    description: '말은 통하지만 중요한 뉘앙스와 결정사항이 흐려집니다.',
    icon: Languages,
  },
  {
    title: '자료의 파편화',
    description: '파일은 메일, 링크는 채팅, 화면공유는 회의앱으로 흩어집니다.',
    icon: FileUp,
  },
  {
    title: '기록 손실',
    description: '회의가 끝난 뒤 누가 뭘 하기로 했는지 다시 정리해야 합니다.',
    icon: FileCheck,
  },
];

const workflowSteps = [
  {
    step: '1',
    label: 'Before Meeting',
    title: '요청을 받고 맥락을 확인하세요',
    description: '고객이 먼저 이름, 연락처, 시간대, 요청 내용을 남깁니다.',
    icon: MessageSquareText,
  },
  {
    step: '2',
    label: 'During Meeting',
    title: '통역, 공유, 협업을 한 공간에서',
    description: '영상, 음성, 화면공유, 라이브 캡션, 번역, 채팅, 파일 공유를 함께 사용하세요.',
    icon: Video,
  },
  {
    step: '3',
    label: 'After Meeting',
    title: '회의록과 액션을 정리하세요',
    description: '대화 기록과 회의록을 남기고, 다음에 해야 할 일을 바로 확인하세요.',
    icon: CalendarCheck2,
  },
];

const featureCards = [
  {
    outcome: '말을 놓치지 않게',
    title: 'Live Caption & Translation',
    description: '다국어 대화의 흐름을 놓치지 않습니다.',
    icon: Languages,
  },
  {
    outcome: '자료를 끊기지 않게',
    title: 'PonsCast',
    description: '회의 안에서 파일과 영상을 함께 봅니다.',
    icon: PlaySquare,
  },
  {
    outcome: '같이 보고 결정하게',
    title: 'CoWatch',
    description: '같은 콘텐츠를 같은 타이밍에 봅니다.',
    icon: UsersRound,
  },
  {
    outcome: '대화가 정리되게',
    title: 'Chat & File Transfer',
    description: '대화와 파일이 한 타임라인에 남습니다.',
    icon: MessageSquareText,
  },
  {
    outcome: '끝난 뒤에도 남게',
    title: 'Meeting Minutes',
    description: '자동으로 회의록을 만들고 내려받을 수 있습니다.',
    icon: FileCheck,
  },
  {
    outcome: '누구나 쉽게',
    title: 'No Install Web-based',
    description: '설치 없이 브라우저에서 바로 시작합니다.',
    icon: Globe,
  },
];

const useCases = [
  {
    title: '글로벌 프리랜서',
    description: '해외 클라이언트 요청부터 미팅, 회의록까지 한 링크로 관리하세요.',
    imageClass: '',
    alt: '해외 클라이언트와 영상 미팅을 진행하는 글로벌 프리랜서',
  },
  {
    title: '컨설턴트 / 코치 / 튜터',
    description: '상담 전 맥락을 받고, 상담 중 통역과 기록을 남기세요.',
    imageClass: '-translate-x-1/2',
    alt: '원격 상담 세션을 준비하는 컨설턴트',
  },
  {
    title: '일본어·한국어 협업자',
    description: '한국어와 일본어가 섞이는 협업 흐름을 놓치지 않게 관리하세요.',
    imageClass: '-translate-y-1/2',
    alt: '한국과 일본 협업자가 문서를 검토하는 장면',
  },
  {
    title: '원격 제품팀',
    description: '시차가 다른 팀과 요청, 공유 자료, 결정사항을 한 흐름으로 묶으세요.',
    imageClass: '-translate-x-1/2 -translate-y-1/2',
    alt: '여러 나라의 원격 제품팀이 화상회의를 진행하는 장면',
  },
];

const comparisonRows = [
  {
    old: '링크는 Zoom, 자료는 카톡, 기록은 Notion',
    pons: '요청, 회의, 자료, 기록을 한 흐름으로',
  },
  {
    old: '고객이 무슨 일로 연락했는지 회의 때 처음 앎',
    pons: '요청 폼으로 미리 맥락 확보',
  },
  {
    old: '언어가 섞이면 결정사항이 흐려짐',
    pons: '캡션/번역/회의록으로 흐름 보존',
  },
  {
    old: '회의 끝나고 다시 정리해야 함',
    pons: '대화와 회의록을 바로 남김',
  },
];

const trustItems = [
  { title: '브라우저 기반', description: '설치 없이 링크로 바로 입장합니다.', icon: Globe },
  { title: 'WebRTC', description: '실시간 미팅에 맞춘 연결 구조를 사용합니다.', icon: Network },
  { title: '동의 기반 기록', description: '참여자 동의 후 회의록을 남깁니다.', icon: ShieldCheck },
  { title: '다국어 지원', description: '한국어, 영어, 일본어 흐름을 함께 다룹니다.', icon: Languages },
  { title: '보안 연결', description: '미팅과 공유 자료의 접근 흐름을 분리합니다.', icon: CheckCircle2 },
];

const SectionNumber = ({ value }: { value: string }) => (
  <div className="mb-5 inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-[#BCD4FF] bg-white px-3 text-sm font-extrabold text-[#1E63FF] shadow-[0_10px_24px_rgba(30,99,255,0.10)]">
    {value}
  </div>
);

const SectionHeader = ({
  eyebrow,
  title,
  description,
  align = 'center',
  id,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'center' | 'left';
  id?: string;
}) => (
  <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
    {eyebrow && (
      <p className="text-sm font-extrabold uppercase text-[#1E63FF]">
        {eyebrow}
      </p>
    )}
    <h2 id={id} className="mt-3 break-keep text-3xl font-extrabold text-slate-950 sm:text-4xl">
      {title}
    </h2>
    {description && (
      <p className="mt-4 break-keep text-base leading-7 text-slate-600">
        {description}
      </p>
    )}
  </div>
);

const IconBlock = ({ icon: Icon }: { icon: LucideIcon }) => (
  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#EEF5FF] to-white text-[#1E63FF] shadow-[inset_0_0_0_1px_rgba(188,212,255,0.65)]">
    <Icon className="h-6 w-6" strokeWidth={1.9} />
  </div>
);

const RoomPreviewMockup = () => (
  <div className="relative mx-auto w-full max-w-[660px]">
    <div className="absolute -left-3 top-8 z-20 hidden w-[186px] rounded-2xl border border-[#D9E3F5] bg-white p-4 text-slate-900 shadow-[0_22px_54px_rgba(15,23,42,0.14)] xl:block">
      <p className="text-xs font-bold text-[#1E63FF]">Before Meeting</p>
      <h3 className="mt-2 text-sm font-extrabold">Request from Guest</h3>
      <div className="mt-3 space-y-2 text-[11px] leading-4 text-slate-500">
        <p className="font-bold text-slate-800">Yuki Tanaka</p>
        <p>GMT+9 Tokyo</p>
        <p>Consultation</p>
        <p className="rounded-xl bg-slate-50 p-2 text-slate-600">I'd like to discuss collaboration opportunities.</p>
      </div>
      <div className="mt-3 rounded-xl bg-[#1E63FF] px-3 py-2 text-center text-[11px] font-bold text-white">
        Approve
      </div>
    </div>

    <div className="rounded-[24px] border border-white/10 bg-[#050507] p-3 text-white shadow-[0_34px_90px_rgba(15,23,42,0.26)]">
      <div className="rounded-[20px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(30,99,255,0.24),transparent_34%),radial-gradient(circle_at_80%_0%,rgba(45,212,191,0.10),transparent_28%),linear-gradient(180deg,#111116,#050507)] p-3">
        <div className="mb-3 flex items-center justify-between text-xs text-white/60">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
            <span className="font-bold text-white/80">PonsLink Room</span>
          </div>
          <span>● Live translation</span>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_190px]">
          <div className="grid grid-cols-2 gap-2">
            {['Yuki Tanaka', 'Minsoo Kim', 'Michael Lee'].map((name, index) => (
              <div key={name} className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-slate-800 to-slate-950">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_20%,rgba(255,255,255,0.16),transparent_28%)]" />
                <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-sm font-extrabold text-white/80">
                  {name.split(' ').map((part) => part[0]).join('')}
                </div>
                <span className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-1 text-[10px] text-white">
                  {name}
                </span>
                {index === 0 && (
                  <span className="absolute right-2 top-2 rounded-full bg-emerald-300/90 px-2 py-1 text-[9px] font-bold text-slate-950">
                    Speaking
                  </span>
                )}
              </div>
            ))}
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[11px] font-bold text-slate-400">Live Caption & Translation</p>
              <div className="mt-3 space-y-2 text-xs leading-5">
                <p>그럼 일정을 먼저 확인해보겠습니다.</p>
                <p className="text-cyan-200">では、まず日程を確認します。</p>
                <p className="text-indigo-200">Let's confirm the schedule first.</p>
              </div>
            </div>
          </div>

          <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] p-3 md:block">
            <p className="text-[11px] font-bold text-slate-400">Meeting Timeline</p>
            <div className="mt-3 space-y-3">
              {['Request approved', 'Proposal.pdf shared', 'Pilot schedule confirmed'].map((item) => (
                <div key={item} className="flex items-start gap-2 text-xs text-white/78">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-[#1E63FF]/15 p-3 text-xs leading-5 text-blue-100">
              자료와 대화가 같은 회의 흐름에 남습니다.
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/35 p-2">
          {[Mic, Video, MonitorUp, Languages, MessageSquareText].map((Icon, index) => (
            <button
              key={index}
              type="button"
              aria-label={`미팅 컨트롤 ${index + 1}`}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.08] text-white/80"
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
          <button
            type="button"
            aria-label="회의 종료"
            className="flex h-9 items-center justify-center rounded-xl bg-red-500 px-3 text-xs font-bold text-white"
          >
            Leave
          </button>
        </div>
      </div>
    </div>

    <div className="mt-4 rounded-2xl border border-[#D9E3F5] bg-white p-4 text-slate-900 shadow-[0_22px_54px_rgba(15,23,42,0.12)] sm:absolute sm:-right-2 sm:-bottom-8 sm:z-20 sm:mt-0 sm:w-[216px] xl:-right-4">
      <p className="text-xs font-bold text-[#1E63FF]">After Meeting</p>
      <h3 className="mt-2 text-sm font-extrabold">Meeting Minutes</h3>
      <div className="mt-3 space-y-2 text-[11px] leading-4 text-slate-600">
        <p className="font-bold text-slate-800">Key Decisions</p>
        <p>☑ Market research scope</p>
        <p>☑ Pilot schedule</p>
        <p>☐ Success metrics</p>
      </div>
    </div>
  </div>
);

const WorkflowMiniUi = ({ step }: { step: string }) => {
  if (step === '1') {
    return (
      <div className="mt-6 rounded-2xl bg-[#F8FAFC] p-4">
        <p className="text-xs font-bold text-[#1E63FF]">New Request</p>
        <p className="mt-2 text-sm font-bold text-slate-900">일본어 상담 가능한가요?</p>
        <div className="mt-4 flex gap-2">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Approve</span>
          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-600">Later</span>
        </div>
      </div>
    );
  }

  if (step === '2') {
    return (
      <div className="mt-6 rounded-2xl bg-[#050507] p-4 text-white">
        <p className="text-xs font-bold text-cyan-200">Live Caption</p>
        <p className="mt-3 text-sm">일정을 먼저 확인해보겠습니다.</p>
        <p className="mt-2 text-sm text-cyan-200">まず日程を確認します。</p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl bg-[#F8FAFC] p-4">
      <p className="text-xs font-bold text-[#1E63FF]">Meeting Minutes</p>
      <div className="mt-3 space-y-2 text-sm text-slate-700">
        <p>☑ Pilot schedule</p>
        <p>☑ Market scope</p>
        <p>☐ Budget review</p>
      </div>
    </div>
  );
};

const UseCaseImage = ({ className, alt }: { className: string; alt: string }) => (
  <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
    <img
      src="/img/marketing/use-cases-collage.png"
      alt={alt}
      className={`absolute left-0 top-0 h-[200%] w-[200%] max-w-none object-cover ${className}`}
      loading="eager"
    />
  </div>
);

const DashboardPreview = () => (
  <div className="rounded-[24px] border border-white/10 bg-[#050507] p-4 text-white shadow-[0_30px_80px_rgba(15,23,42,0.20)]">
    <div className="flex items-center justify-between border-b border-white/10 pb-3">
      <div>
        <p className="text-xs font-bold uppercase text-cyan-200">PonsLink Lounge</p>
        <h3 className="mt-1 text-lg font-extrabold">Global meeting desk</h3>
      </div>
      <span className="rounded-full bg-emerald-300/15 px-3 py-1 text-xs font-bold text-emerald-200">Ready</span>
    </div>
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      {['New requests', 'Today meetings', 'Minutes'].map((label, index) => (
        <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-extrabold">{[8, 3, 14][index]}</p>
        </div>
      ))}
    </div>
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold">Yuki Tanaka</p>
          <p className="mt-1 text-xs text-slate-400">Collaboration consultation · GMT+9</p>
        </div>
        <span className="rounded-full bg-[#1E63FF] px-3 py-1 text-xs font-bold">Room link sent</span>
      </div>
    </div>
  </div>
);

const Marketing = () => {
  return (
    <div className="min-h-screen bg-[#F8FBFF] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <nav className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-5 sm:px-8" aria-label="Main navigation">
          <Link to="/" className="flex items-center gap-3" aria-label="PonsLink 홈">
            <img src="/icon.svg" alt="" className="h-8 w-8" loading="eager" />
            <span className="text-lg font-extrabold text-slate-950">PonsLink</span>
          </Link>
          <div className="hidden items-center gap-8 text-sm font-bold text-slate-600 lg:flex">
            <a href="#features" className="transition hover:text-[#1E63FF]">기능</a>
            <a href="#use-cases" className="transition hover:text-[#1E63FF]">사용 사례</a>
            <a href="#comparison" className="transition hover:text-[#1E63FF]">요금제</a>
            <a href="#trust" className="transition hover:text-[#1E63FF]">리소스</a>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link to="/login" className="hidden h-10 items-center rounded-xl px-3 text-sm font-bold text-slate-700 transition hover:text-[#1E63FF] sm:inline-flex">
              로그인
            </Link>
            <Link to="/login" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#1E63FF] px-4 text-sm font-bold text-white shadow-[0_12px_30px_rgba(30,99,255,0.22)] transition hover:bg-[#174FD1]">
              내 PonsLink 만들기
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section
          aria-labelledby="hero-title"
          className="relative overflow-hidden bg-[radial-gradient(circle_at_76%_10%,rgba(30,99,255,0.18),transparent_34%),radial-gradient(circle_at_16%_82%,rgba(45,212,191,0.12),transparent_30%),linear-gradient(180deg,#F8FBFF_0%,#FFFFFF_100%)]"
        >
          <div className="mx-auto grid min-h-[690px] w-full max-w-[1224px] items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:py-20">
            <div>
              <p className="inline-flex rounded-full border border-[#BCD4FF] bg-white/80 px-4 py-2 text-sm font-extrabold text-[#1E63FF] shadow-[0_10px_24px_rgba(30,99,255,0.08)]">
                외국 고객 미팅을 위한 개인 링크
              </p>
              <h1 id="hero-title" className="mt-6 max-w-[600px] break-keep text-[40px] font-black leading-[1.1] text-slate-950 sm:text-[56px] sm:leading-[1.06]">
                <span className="block">외국 고객과의 미팅,</span>
                <span className="block text-[#1E63FF]">링크 하나로</span>
                <span className="block">준비하고 통역하고</span>
                <span className="block">기록하세요</span>
              </h1>
              <p className="mt-6 max-w-[540px] text-[16px] leading-8 text-slate-600 sm:text-[18px]">
                PonsLink는 요청 접수, 일정 조율, 실시간 화상회의, 라이브 캡션, 번역, 파일 공유, 회의록까지 연결하는 글로벌 미팅 워크스페이스입니다.
              </p>
              <div className="mt-8 grid gap-3 sm:flex">
                <Link to="/login" className={primaryButtonClass}>
                  내 PonsLink 만들기
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/lobby/ponslink-demo?type=video-group" className={secondaryButtonClass}>
                  데모 룸 보기
                  <Video className="h-4 w-4" />
                </Link>
              </div>
              <div className="mt-7 flex flex-wrap gap-2">
                {['요청 받기', '실시간 통역', '파일 공유', '회의록'].map((chip) => (
                  <span key={chip} className="rounded-full border border-[#D9E3F5] bg-white/80 px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm">
                    {chip}
                  </span>
                ))}
              </div>
            </div>
            <RoomPreviewMockup />
          </div>
        </section>

        <section aria-labelledby="problem-title" className={`${sectionClass} bg-[#F8FBFF]`}>
          <SectionNumber value="02" />
          <SectionHeader
            id="problem-title"
            title="해외 미팅은 시작하기 전부터 복잡합니다"
            description="여러 도구를 오가며 맥락이 끊기고, 언어 장벽과 기록 누락이 생깁니다."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {painPoints.map(({ title, description, icon }) => (
              <article key={title} className={`${cardClass} p-7 text-center transition hover:-translate-y-1 hover:shadow-[0_22px_54px_rgba(30,99,255,0.10)]`}>
                <div className="mx-auto flex justify-center">
                  <IconBlock icon={icon} />
                </div>
                <h3 className="mt-5 text-lg font-extrabold text-slate-950">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="workflow" aria-labelledby="workflow-title" className="bg-white">
          <div className={sectionClass}>
            <SectionNumber value="03" />
            <SectionHeader
              id="workflow-title"
              title="PonsLink는 회의 전후 맥락까지 담는 개인 미팅 데스크입니다"
              description="요청부터 회의, 기록까지 하나의 흐름으로 연결됩니다."
            />
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {workflowSteps.map(({ step, label, title, description, icon: Icon }, index) => (
                <article key={label} className={`${cardClass} relative min-h-[318px] p-6`}>
                  {index < workflowSteps.length - 1 && (
                    <ChevronRight className="absolute -right-4 top-1/2 hidden h-8 w-8 -translate-y-1/2 rounded-full bg-white p-1 text-[#1E63FF] shadow-sm lg:block" />
                  )}
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1E63FF] text-sm font-extrabold text-white">
                      {step}
                    </span>
                    <div>
                      <p className="text-sm font-extrabold text-[#1E63FF]">{label}</p>
                      <h3 className="text-lg font-extrabold text-slate-950">{title}</h3>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{description}</p>
                  <WorkflowMiniUi step={step} />
                  <Icon className="absolute right-6 top-6 h-5 w-5 text-[#BCD4FF]" />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="features" aria-labelledby="feature-title" className={`${sectionClass} bg-[#F8FBFF]`}>
          <SectionNumber value="04" />
          <SectionHeader
            id="feature-title"
            eyebrow="Feature Outcomes"
            title="상황별 해결책, 필요한 기능만 집중적으로"
            description="기능을 나열하지 않고 해외 미팅에서 생기는 결과를 기준으로 묶었습니다."
            align="left"
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {featureCards.map(({ outcome, title, description, icon: Icon }) => (
              <article key={title} className={`${cardClass} flex min-h-[206px] gap-5 p-6 transition hover:-translate-y-1 hover:shadow-[0_22px_54px_rgba(30,99,255,0.11)]`}>
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#EEF5FF] to-white text-[#1E63FF] shadow-[inset_0_0_0_1px_rgba(188,212,255,0.65)]">
                  <Icon className="h-6 w-6" strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#1E63FF]">{outcome}</p>
                  <h3 className="mt-2 text-lg font-extrabold leading-snug text-slate-950">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="use-cases" aria-labelledby="usecase-title" className="bg-[linear-gradient(180deg,#F3F7FF_0%,#EEF5FF_100%)]">
          <div className={sectionClass}>
            <SectionNumber value="05" />
            <SectionHeader
              id="usecase-title"
              title="이런 분들께 PonsLink가 필요합니다"
              description="해외 고객과 반복적으로 만나고, 대화 맥락과 기록이 업무 결과로 이어지는 분들을 위해 설계했습니다."
            />
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {useCases.map(({ title, description, imageClass, alt }) => (
                <article key={title} className="overflow-hidden rounded-2xl border border-[#D9E3F5] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.055)] transition hover:-translate-y-1 hover:shadow-[0_22px_54px_rgba(30,99,255,0.10)]">
                  <UseCaseImage className={imageClass} alt={alt} />
                  <div className="p-5">
                    <h3 className="text-base font-extrabold text-slate-950">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="comparison" aria-labelledby="comparison-title" className={`${sectionClass} bg-[#F8FBFF]`}>
          <SectionNumber value="06" />
          <SectionHeader
            id="comparison-title"
            eyebrow="Before vs PonsLink"
            title="기존 방식과 PonsLink의 차이"
            description="화상회의 링크 하나가 아니라, 해외 미팅 전후의 흐름을 하나로 연결합니다."
            align="left"
          />
          <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
            <div className={`${cardClass} p-6`}>
              <h3 className="text-center text-lg font-extrabold text-slate-900">기존 방식</h3>
              <div className="mt-5 space-y-3">
                {comparisonRows.map(({ old }) => (
                  <div key={old} className="flex gap-3 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                    <span>{old}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1E63FF] text-sm font-extrabold text-white shadow-[0_14px_34px_rgba(30,99,255,0.25)]">
              VS
            </div>
            <div className="rounded-2xl border border-[#BCD4FF] bg-white p-6 shadow-[0_18px_45px_rgba(30,99,255,0.12)]">
              <h3 className="rounded-xl bg-[#1E63FF] py-3 text-center text-lg font-extrabold text-white">PonsLink</h3>
              <div className="mt-5 space-y-3">
                {comparisonRows.map(({ pons }) => (
                  <div key={pons} className="flex gap-3 rounded-xl bg-[#EEF5FF] p-4 text-sm font-medium leading-6 text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{pons}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-8">
            <DashboardPreview />
          </div>
        </section>

        <section id="trust" aria-labelledby="trust-title" className="bg-white">
          <div className={sectionClass}>
            <SectionNumber value="07" />
            <SectionHeader
              id="trust-title"
              title="첫 해외 미팅 링크를 만들기 전에 필요한 신뢰"
              description="PonsLink는 브라우저 기반의 가벼움과 회의 기록의 책임 있는 흐름을 함께 봅니다."
            />
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
              {trustItems.map(({ title, description, icon }) => (
                <article key={title} className="flex items-start gap-3 rounded-2xl border border-[#D9E3F5] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.045)]">
                  <IconBlock icon={icon} />
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-950">{title}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="final-cta-title" className="px-5 pb-16 sm:px-8 lg:pb-24">
          <div className="mx-auto max-w-[1200px] overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_18%_40%,rgba(30,99,255,0.34),transparent_36%),radial-gradient(circle_at_82%_32%,rgba(45,212,191,0.20),transparent_32%),linear-gradient(135deg,#07111F_0%,#0B1B3A_52%,#07111F_100%)] p-6 text-white shadow-[0_28px_80px_rgba(30,99,255,0.26)] sm:p-10 lg:p-12">
            <div className="grid gap-10 lg:grid-cols-[1fr_0.86fr] lg:items-center">
              <div>
                <p className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-cyan-100">
                  Global meeting workspace
                </p>
                <h2 id="final-cta-title" className="mt-5 text-3xl font-extrabold leading-tight sm:text-4xl">
                  첫 해외 미팅 링크를<br />PonsLink로 만들어보세요
                </h2>
                <p className="mt-4 max-w-lg text-base leading-7 text-white/70">
                  당신만의 개인 미팅 데스크가 준비됩니다.
                </p>
                <div className="mt-8 grid gap-3 sm:flex">
                  <Link to="/login" className={primaryButtonClass}>
                    내 PonsLink 만들기
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link to="/lobby/ponslink-demo?type=video-group" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-6 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20">
                    데모 룸 체험하기
                    <Sparkles className="h-4 w-4" />
                  </Link>
                </div>
              </div>
              <div className="relative min-h-[280px]">
                <div className="absolute right-0 top-4 w-[88%] rounded-[22px] border border-white/10 bg-[#050507] p-3 shadow-[0_30px_80px_rgba(0,0,0,0.30)]">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="aspect-video rounded-xl bg-slate-800" />
                    <div className="aspect-video rounded-xl bg-slate-800" />
                    <div className="col-span-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs text-cyan-100">
                      Live Caption · Meeting Minutes · File Timeline
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-4 left-0 w-[46%] rounded-[24px] border border-white/10 bg-[#111116] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.28)]">
                  <div className="mx-auto h-20 w-full rounded-2xl bg-white/[0.06]" />
                  <div className="mt-3 space-y-2">
                    <div className="h-2 rounded-full bg-white/30" />
                    <div className="h-2 w-2/3 rounded-full bg-cyan-300/70" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img src="/icon.svg" alt="" className="h-7 w-7" loading="lazy" />
            <span className="font-extrabold text-slate-950">PonsLink</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <a href="#features" className="hover:text-[#1E63FF]">Product</a>
            <a href="#use-cases" className="hover:text-[#1E63FF]">Use Cases</a>
            <a href="#trust" className="hover:text-[#1E63FF]">Resources</a>
            <span>Legal</span>
            <span>Language</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Marketing;
