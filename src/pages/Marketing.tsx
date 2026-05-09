import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  FileCheck,
  FileText,
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

const sectionClass = 'mx-auto w-full max-w-[1200px] px-5 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16';
const cardClass = 'rounded-[20px] border border-[#E5EAF5] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]';
const primaryButtonClass = 'inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1E63FF] px-6 text-base font-bold text-white shadow-[0_14px_34px_rgba(30,99,255,0.28)] transition hover:-translate-y-px hover:bg-[#174FD1] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1E63FF]/25';
const secondaryButtonClass = 'inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-base font-bold text-slate-900 transition hover:-translate-y-px hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1E63FF]/20';

const comicAssets = {
  hero: '/img/marketing/comic-hero-story.png',
  problems: [
    '/img/marketing/comic-problem-context.png',
    '/img/marketing/comic-problem-language.png',
    '/img/marketing/comic-problem-files.png',
    '/img/marketing/comic-problem-record.png',
  ],
  workflow: [
    '/img/marketing/comic-workflow-before.png',
    '/img/marketing/comic-workflow-during.png',
    '/img/marketing/comic-workflow-after.png',
  ],
  features: [
    '/img/marketing/comic-feature-caption.png',
    '/img/marketing/comic-feature-ponscast.png',
    '/img/marketing/comic-feature-cowatch.png',
    '/img/marketing/comic-feature-transfer.png',
    '/img/marketing/comic-feature-minutes.png',
    '/img/marketing/comic-feature-no-install.png',
  ],
  useCases: '/img/marketing/comic-use-cases-collage.png',
};

const problemCards = [
  {
    title: '맥락 부족',
    speech: '누구지, 어떤 문제로 연락한 걸까요?',
    description: '회의 링크를 보내기 전, 상대의 목적과 요청을 먼저 확인해야 합니다.',
    icon: UserCheck,
    mood: 'confused',
  },
  {
    title: '언어 장벽',
    speech: '핵심이 잘 정리되지 않아요.',
    description: '말은 오가지만 결정사항과 뉘앙스가 회의 중간에 흐려집니다.',
    icon: Languages,
    mood: 'translate',
  },
  {
    title: '자료의 파편화',
    speech: '파일은 여기, 메모는 저기...',
    description: '자료, 링크, 채팅, 메모가 여러 도구로 흩어져 흐름이 끊깁니다.',
    icon: FileUp,
    mood: 'scattered',
  },
  {
    title: '기록 손실',
    speech: '중요한 합의가 뭐였죠?',
    description: '회의 뒤 다시 기억을 더듬으며 누가 무엇을 하기로 했는지 정리합니다.',
    icon: FileCheck,
    mood: 'lost',
  },
];

const workflowSteps = [
  {
    step: '01',
    label: 'Before Meeting',
    title: '회의 전 준비 / 요청 정리',
    description: '초대 링크를 만들고, 필요한 자료와 요청 내용을 미리 공유하세요.',
    icon: MessageSquareText,
  },
  {
    step: '02',
    label: 'During Meeting',
    title: '실시간 통역 · 번역 · 파일 공유',
    description: '말을 놓치지 않고, 어디서든 이해하고, 자료도 바로 공유할 수 있어요.',
    icon: Video,
  },
  {
    step: '03',
    label: 'After Meeting',
    title: '회의록 · 핵심 요약 · 액션 아이템',
    description: '회의가 끝난 뒤 자동으로 정리되고, 후속 업무도 놓치지 않아요.',
    icon: CalendarCheck2,
  },
];

const featureCards = [
  {
    situation: '말이 잘 안 통할 때',
    title: 'Live Caption & Translation',
    description: '실시간으로 듣고 번역해 전달해줍니다.',
    icon: Languages,
  },
  {
    situation: '자료 전달과 정리가 필요할 때',
    title: 'PonsCast',
    description: '고객과 자료를 함께 보고 회의 흐름 안에 남깁니다.',
    icon: PlaySquare,
  },
  {
    situation: '같이 보며 정리할 때',
    title: 'CoWatch',
    description: '같은 화면과 콘텐츠를 같은 타이밍에 확인합니다.',
    icon: UsersRound,
  },
  {
    situation: '대화나 문서를 정리할 때',
    title: 'Chat & File Transfer',
    description: '대화와 파일이 한 타임라인에 남습니다.',
    icon: MessageSquareText,
  },
  {
    situation: '끝은 반드시 기록으로',
    title: 'Meeting Minutes',
    description: '핵심 요약과 액션 아이템을 회의 후 바로 확인합니다.',
    icon: FileCheck,
  },
  {
    situation: '설치가 번거로울 때',
    title: 'No Install Web-based',
    description: '브라우저에서 링크만 열고 바로 시작합니다.',
    icon: Globe,
  },
];

const userSegments = [
  {
    title: '글로벌 영업/세일즈',
    description: '해외 고객과의 첫 상담부터 후속 관리까지 한 링크로 관리하세요.',
    imageClass: '',
    alt: '해외 고객과 영상 미팅을 진행하는 글로벌 세일즈 담당자 일러스트',
  },
  {
    title: '컨설턴트 / 코치 / 튜터',
    description: '상담 전 맥락을 받고, 상담 중 통역과 기록을 남기세요.',
    imageClass: '-translate-x-1/2',
    alt: '원격 상담을 준비하는 컨설턴트 일러스트',
  },
  {
    title: '스타트업 · 외국인 창업자',
    description: '국경을 넘는 파트너 미팅의 요청, 자료, 결정을 정리하세요.',
    imageClass: '-translate-y-1/2',
    alt: '스타트업 창업자가 외국인 파트너와 협업하는 일러스트',
  },
  {
    title: '원격 제품팀',
    description: '시차가 다른 팀과 자료, 회의, 액션 아이템을 한 흐름으로 묶으세요.',
    imageClass: '-translate-x-1/2 -translate-y-1/2',
    alt: '원격 제품팀이 화상회의로 협업하는 일러스트',
  },
];

const trustItems = [
  { title: '보안과 개인정보', description: '민감한 미팅 정보를 신중하게 다룹니다.', icon: ShieldCheck },
  { title: 'WebRTC', description: '안정적인 실시간 통신 기반으로 연결합니다.', icon: Network },
  { title: '회의 기반 기록', description: '요청과 회의 흐름 안에서 기록을 남깁니다.', icon: FileText },
  { title: '다국어 지원', description: '다양한 언어의 회의 흐름을 보조합니다.', icon: Languages },
  { title: '보안 연결', description: '브라우저 기반 암호화 연결을 사용합니다.', icon: CheckCircle2 },
];

const bottomTrustSegments = ['Global sales', 'Consultants', 'Tutors', 'Startup founders', 'Remote teams'];

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
      <p className="text-sm font-extrabold text-[#1E63FF]">
        {eyebrow}
      </p>
    )}
    <h2 id={id} className="mt-3 break-keep text-[28px] font-extrabold leading-[1.2] text-slate-950 sm:text-4xl">
      {title}
    </h2>
    {description && (
      <p className="mt-4 break-keep text-base leading-7 text-slate-600">
        {description}
      </p>
    )}
  </div>
);

const IconBadge = ({ icon: Icon }: { icon: LucideIcon }) => (
  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#EEF5FF] text-[#1E63FF] shadow-[inset_0_0_0_1px_rgba(200,217,255,0.85)]">
    <Icon className="h-5 w-5" strokeWidth={1.9} />
  </div>
);

const ComicPanelImage = ({
  src,
  alt,
  aspectClass = 'aspect-[4/3]',
}: {
  src: string;
  alt: string;
  aspectClass?: string;
}) => (
  <div className={`relative overflow-hidden rounded-[18px] border border-[#D9E3F5] bg-white ${aspectClass}`}>
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover"
      loading="eager"
    />
  </div>
);

const MiniProductRoom = ({ compact = false }: { compact?: boolean }) => {
  if (compact) {
    return (
      <div className="rounded-[18px] border border-white/10 bg-[#0B1020] p-3 text-white shadow-[0_18px_42px_rgba(15,23,42,0.16)]">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div>
            <p className="text-[11px] font-bold text-cyan-200">PonsLink Room</p>
            <p className="mt-0.5 text-xs font-extrabold">Live support call</p>
          </div>
          <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold text-emerald-200">Live</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {['YT', 'AL'].map((name) => (
            <div key={name} className="relative aspect-video rounded-xl border border-white/10 bg-gradient-to-br from-slate-800 to-slate-950">
              <span className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold">
                {name}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
          <p className="text-[11px] font-bold text-slate-300">Live Translation</p>
          <p className="mt-1 truncate text-xs text-cyan-200">Let's confirm the schedule first.</p>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-2 py-1.5">
          {[Mic, Video, Languages].map((Icon, index) => (
            <div key={index} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.08]">
              <Icon className="h-3.5 w-3.5" />
            </div>
          ))}
          <span className="rounded-lg bg-white/[0.08] px-2 py-1 text-[10px] font-bold text-white/75">Notes ready</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[310px] rounded-[20px] border border-white/10 bg-[#0B1020] p-3 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
    <div className="flex items-center justify-between border-b border-white/10 pb-3">
      <div>
        <p className="text-xs font-bold text-cyan-200">PonsLink Room</p>
        <p className="mt-1 text-sm font-extrabold">Tokyo consulting call</p>
      </div>
      <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-200">Live</span>
    </div>
    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_176px]">
      <div className="grid grid-cols-2 gap-2">
        {['YT', 'MK', 'AL'].map((name) => (
          <div key={name} className="relative aspect-video rounded-xl border border-white/10 bg-gradient-to-br from-slate-800 to-slate-950">
            <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
              {name}
            </span>
          </div>
        ))}
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <p className="text-[11px] font-bold text-slate-300">Live Translation</p>
          <p className="mt-2 text-xs leading-5">일정을 먼저 확인해보겠습니다.</p>
          <p className="mt-1 text-xs leading-5 text-cyan-200">Let's confirm the schedule first.</p>
        </div>
      </div>
      <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] p-3 md:block">
        <p className="text-[11px] font-bold text-slate-300">Meeting Notes</p>
        <div className="mt-3 space-y-2 text-xs text-white/75">
          <p>✓ Request approved</p>
          <p>✓ Proposal shared</p>
          <p>✓ Action items ready</p>
        </div>
      </div>
    </div>
    <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-2">
      {[Mic, Video, MonitorUp, Languages, MessageSquareText].map((Icon, index) => (
        <div key={index} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.08]">
          <Icon className="h-4 w-4" />
        </div>
      ))}
      <div className="rounded-xl bg-red-500 px-3 py-2 text-xs font-bold">Leave</div>
    </div>
  </div>
  );
};

const HeroStoryVisual = () => (
  <div className="relative mx-auto w-full max-w-[820px]">
    <img
      src={comicAssets.hero}
      alt="초대, 실시간 통역 회의, 회의록 정리로 이어지는 PonsLink 코믹 히어로 일러스트"
      className="w-full rounded-[24px] border border-[#C8D9FF] bg-white shadow-[0_24px_70px_rgba(30,99,255,0.18)]"
      loading="eager"
    />
  </div>
);

const ProblemComicScene = ({ index, title }: { index: number; title: string }) => (
  <ComicPanelImage
    src={comicAssets.problems[index]}
    alt={`${title} 문제를 보여주는 PonsLink 코믹 패널`}
    aspectClass="aspect-[1.05/1]"
  />
);

const WorkflowScene = ({ index, title }: { index: number; title: string }) => (
  <div className="mt-5">
    <ComicPanelImage
      src={comicAssets.workflow[index]}
      alt={`${title} 단계를 보여주는 PonsLink 코믹 패널`}
      aspectClass="aspect-[0.88/1]"
    />
  </div>
);

const FeatureVisual = ({ index, title }: { index: number; title: string }) => (
  <div className="mt-5">
    <ComicPanelImage
      src={comicAssets.features[index]}
      alt={`${title} 기능을 설명하는 PonsLink 코믹 패널`}
      aspectClass="aspect-[0.86/1]"
    />
  </div>
);

const UserImage = ({ className, alt }: { className: string; alt: string }) => (
  <div className="relative aspect-[4/3] overflow-hidden bg-[#EEF5FF]">
    <img
      src={comicAssets.useCases}
      alt={alt}
      className={`absolute left-0 top-0 h-[200%] w-[200%] max-w-none object-cover ${className}`}
      loading="eager"
    />
  </div>
);

const DashboardPreview = () => (
  <div className="rounded-[24px] border border-white/10 bg-[#0B1020] p-4 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
    <div className="grid gap-4 md:grid-cols-[150px_1fr]">
      <aside className="rounded-2xl bg-white/[0.04] p-3">
        <p className="text-xs font-bold text-cyan-200">PonsLink</p>
        <div className="mt-5 space-y-2">
          {['Requests', 'Meetings', 'Minutes'].map((item) => (
            <div key={item} className="rounded-xl bg-white/[0.06] px-3 py-2 text-xs text-white/75">{item}</div>
          ))}
        </div>
      </aside>
      <div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-cyan-200">Activity</p>
            <h3 className="mt-1 text-lg font-extrabold">Global meeting desk</h3>
          </div>
          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-200">Ready</span>
        </div>
        <div className="mt-4 space-y-3">
          {['New request from Yuki', 'Translation enabled', 'Meeting minutes ready'].map((item) => (
            <div key={item} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <span className="text-sm text-white/80">{item}</span>
              <span className="h-2 w-2 rounded-full bg-[#2DD4BF]" />
            </div>
          ))}
        </div>
        <div className="mt-4 inline-flex rounded-xl bg-[#1E63FF] px-4 py-2 text-sm font-bold">Join meeting</div>
      </div>
    </div>
  </div>
);

const ComparisonFlow = ({ positive = false }: { positive?: boolean }) => (
  <div className="mt-5 grid gap-3">
    {(positive ? ['요청', '통역', '공유', '요약', '기록'] : ['메일', 'Zoom', '메신저', '문서', '기억']).map((item, index) => (
      <div key={item} className={`flex items-center gap-3 rounded-2xl p-3 ${positive ? 'bg-[#EEF5FF]' : 'bg-slate-50'}`}>
        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold ${positive ? 'bg-[#1E63FF] text-white' : 'bg-white text-rose-500'}`}>
          {positive ? index + 1 : <XCircle className="h-4 w-4" />}
        </div>
        <span className="text-sm font-bold text-slate-700">{item}</span>
      </div>
    ))}
  </div>
);

const Marketing = () => {
  return (
    <div className="min-h-screen bg-[#F8FBFF] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <nav className="mx-auto flex h-20 max-w-[1200px] items-center justify-between px-5 sm:px-6 lg:px-8" aria-label="Main navigation">
          <Link to="/" className="flex items-center gap-3" aria-label="PonsLink 홈">
            <img src="/icon.svg" alt="" className="h-8 w-8" loading="eager" />
            <span className="text-lg font-extrabold text-slate-950">PonsLink</span>
          </Link>
          <div className="hidden items-center gap-8 text-sm font-bold text-slate-600 lg:flex">
            <a href="#features" className="transition hover:text-[#1E63FF]">기능</a>
            <a href="#use-cases" className="transition hover:text-[#1E63FF]">사용 사례</a>
            <a href="#comparison" className="transition hover:text-[#1E63FF]">비교</a>
            <a href="#trust" className="transition hover:text-[#1E63FF]">신뢰</a>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link to="/login" className="hidden h-10 items-center rounded-xl px-3 text-sm font-bold text-slate-700 transition hover:text-[#1E63FF] sm:inline-flex">
              로그인
            </Link>
            <Link to="/login" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#1E63FF] px-4 text-sm font-bold text-white shadow-[0_12px_30px_rgba(30,99,255,0.22)] transition hover:bg-[#174FD1]">
              내 PonsLink 열기
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section
          aria-labelledby="hero-title"
          className="overflow-hidden bg-[radial-gradient(circle_at_72%_16%,rgba(30,99,255,0.14),transparent_34%),linear-gradient(180deg,#F8FBFF_0%,#FFFFFF_100%)]"
        >
          <div className="mx-auto grid min-h-[650px] max-w-[1280px] items-center gap-12 px-5 py-12 sm:px-6 lg:grid-cols-[5fr_7fr] lg:px-8 lg:py-16">
            <div>
              <p className="inline-flex rounded-full bg-[#EEF5FF] px-4 py-2 text-sm font-extrabold text-[#1E63FF]">
                해외 미팅을 위한 개인 미팅 링크
              </p>
              <h1 id="hero-title" className="mt-6 max-w-[560px] break-keep text-[38px] font-extrabold leading-[1.1] text-slate-950 sm:text-[56px] sm:leading-[1.08]">
                <span className="block">외국 고객과의 미팅,</span>
                <span className="block text-[#1E63FF]">링크 하나로</span>
                <span className="block">준비하고 통역하고</span>
                <span className="block">기록하세요</span>
              </h1>
              <p className="mt-6 max-w-[540px] break-keep text-[16px] leading-8 text-slate-600 sm:text-[18px]">
                PonsLink는 요청 접수, 일정 조율, 실시간 화상회의, 라이브 번역, 요약, 파일 공유, 회의록까지 업무에 필요한 기능을 한 흐름으로 제공합니다.
              </p>
              <div className="mt-8 grid gap-3 sm:flex">
                <Link to="/login" className={primaryButtonClass}>
                  내 PonsLink 열기
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/lobby/ponslink-demo?type=video-group" className={secondaryButtonClass}>
                  데모로 보기
                  <Video className="h-4 w-4" />
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {['암호화 연결로 안전하게', '별도 설치 없이 사용', '다국어 지원'].map((chip) => (
                  <span key={chip} className="rounded-full border border-[#D9E3F5] bg-white px-3 py-1.5 text-xs font-bold text-slate-600">
                    {chip}
                  </span>
                ))}
              </div>
            </div>
            <HeroStoryVisual />
          </div>
        </section>

        <section aria-labelledby="problem-title" className={sectionClass}>
          <SectionHeader
            id="problem-title"
            title="해외 미팅은 시작하기 전부터 복잡합니다"
            description="누가 무엇을 원하는지, 어떤 언어로 이야기할지, 자료와 기록은 어디에 둘지 회의 전부터 정리할 일이 많습니다."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {problemCards.map(({ title, description }, index) => (
              <article key={title} className={`${cardClass} min-h-[268px] p-5 transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(30,99,255,0.12)]`}>
                <ProblemComicScene index={index} title={title} />
                <h3 className="mt-5 text-lg font-extrabold text-slate-950">{title}</h3>
                <p className="mt-2 break-keep text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="workflow" aria-labelledby="workflow-title" className="bg-white">
          <div className={sectionClass}>
            <SectionHeader
              id="workflow-title"
              title="PonsLink는 회의 전후 맥락까지 담는 해외 미팅 데스크입니다"
              description="요청을 받고, 회의에서 통역과 공유를 쓰고, 끝난 뒤 요약과 액션 아이템을 남깁니다."
            />
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {workflowSteps.map(({ step, label, title, description, icon: Icon }, index) => (
                <article key={step} className={`${cardClass} p-6`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-extrabold text-[#1E63FF]">{label}</p>
                      <h3 className="mt-2 break-keep text-xl font-extrabold text-slate-950">{title}</h3>
                    </div>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF5FF] text-sm font-extrabold text-[#1E63FF]">{step}</span>
                  </div>
                  <p className="mt-3 break-keep text-sm leading-6 text-slate-600">{description}</p>
                  <WorkflowScene index={index} title={title} />
                  <Icon className="mt-4 h-5 w-5 text-[#1E63FF]" />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="features" aria-labelledby="feature-title" className={sectionClass}>
          <SectionHeader
            id="feature-title"
            title="상황별 해결책, 필요한 기능을 집중적으로"
            description="기능 이름보다 먼저, 어떤 순간에 어떤 문제가 해결되는지 보여줍니다."
            align="left"
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {featureCards.map(({ situation, title, description }, index) => (
              <article key={title} className={`${cardClass} p-5 transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(30,99,255,0.12)]`}>
                <p className="break-keep text-sm font-extrabold text-[#1E63FF]">{situation}</p>
                <FeatureVisual index={index} title={title} />
                <h3 className="mt-5 break-keep text-lg font-extrabold leading-snug text-slate-950">{title}</h3>
                <p className="mt-3 break-keep text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="use-cases" aria-labelledby="usecase-title" className="bg-[#EEF5FF]">
          <div className={sectionClass}>
            <SectionHeader
              id="usecase-title"
              title="이런 분들께 PonsLink가 필요합니다"
              description="해외 고객과 자주 만나고, 회의 전후의 맥락이 업무 성과로 이어지는 분들을 위한 도구입니다."
            />
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {userSegments.map(({ title, description, imageClass, alt }) => (
                <article key={title} className="overflow-hidden rounded-[20px] border border-[#E5EAF5] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(30,99,255,0.12)]">
                  <UserImage className={imageClass} alt={alt} />
                  <div className="p-5">
                    <h3 className="break-keep text-base font-extrabold text-slate-950">{title}</h3>
                    <p className="mt-2 break-keep text-sm leading-6 text-slate-600">{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="comparison" aria-labelledby="comparison-title" className={sectionClass}>
          <SectionHeader
            id="comparison-title"
            title="기존 방식과 PonsLink의 차이"
            description="여러 도구를 이어 붙이는 대신, 요청부터 기록까지 한 곳에서 이어집니다."
            align="left"
          />
          <div className="mt-10 grid gap-5 lg:grid-cols-[0.9fr_0.9fr_1.2fr]">
            <article className={`${cardClass} p-6`}>
              <h3 className="text-xl font-extrabold text-slate-950">기존 방식</h3>
              <p className="mt-3 break-keep text-sm leading-6 text-slate-600">
                준비부터 회의까지 너무 복잡해요. 여러 도구가 연결되지 않아 기록도 남지 않아요.
              </p>
              <ComparisonFlow />
            </article>
            <article className="rounded-[20px] border border-[#C8D9FF] bg-white p-6 shadow-[0_18px_40px_rgba(30,99,255,0.12)]">
              <h3 className="text-xl font-extrabold text-[#1E63FF]">PonsLink</h3>
              <p className="mt-3 break-keep text-sm leading-6 text-slate-600">
                모든 업무가 한 곳에서, 하나의 흐름으로. 더 간단하고, 더 집중할 수 있어요.
              </p>
              <ComparisonFlow positive />
            </article>
            <DashboardPreview />
          </div>
        </section>

        <section id="trust" aria-labelledby="trust-title" className="bg-white">
          <div className={sectionClass}>
            <SectionHeader
              id="trust-title"
              title="안심하고 사용할 수 있는 설계"
              description="업무 미팅은 편해야 하지만 가벼워 보여서는 안 됩니다. PonsLink는 브라우저 기반의 간편함과 신뢰 흐름을 함께 봅니다."
            />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {trustItems.map(({ title, description, icon }) => (
                <article key={title} className="rounded-[20px] border border-[#E5EAF5] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                  <IconBadge icon={icon} />
                  <h3 className="mt-4 break-keep text-sm font-extrabold text-slate-950">{title}</h3>
                  <p className="mt-2 break-keep text-xs leading-5 text-slate-600">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="final-cta-title" className="px-5 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="mx-auto max-w-[1200px] overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_20%_50%,rgba(30,99,255,0.28),transparent_35%),linear-gradient(135deg,#07111F_0%,#10224A_50%,#07111F_100%)] p-6 text-white shadow-[0_30px_80px_rgba(4,24,70,0.35)] sm:p-10 lg:p-12">
            <div className="grid gap-10 lg:grid-cols-[1fr_0.92fr] lg:items-center">
              <div>
                <p className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-cyan-100">
                  Global meeting desk
                </p>
                <h2 id="final-cta-title" className="mt-5 break-keep text-3xl font-extrabold leading-tight sm:text-4xl">
                  첫 해외 미팅 링크를<br />PonsLink로 만들어보세요
                </h2>
                <p className="mt-4 max-w-lg break-keep text-base leading-7 text-white/72">
                  낯선 언어 걱정 없이, 일해보세요.
                </p>
                <div className="mt-8 grid gap-3 sm:flex">
                  <Link to="/login" className={primaryButtonClass}>
                    내 PonsLink 열기
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link to="/lobby/ponslink-demo?type=video-group" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-6 text-base font-bold text-white backdrop-blur transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20">
                    데모로 체험하기
                    <Sparkles className="h-4 w-4" />
                  </Link>
                </div>
              </div>
              <MiniProductRoom />
            </div>
          </div>
        </section>

        <section aria-label="Trusted user segments" className="border-y border-slate-200 bg-white px-5 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm font-extrabold text-slate-950">Trusted by global professionals</p>
            <div className="flex flex-wrap gap-2">
              {bottomTrustSegments.map((segment) => (
                <span key={segment} className="rounded-full border border-[#D9E3F5] bg-[#F8FBFF] px-3 py-1.5 text-xs font-bold text-slate-600">
                  {segment}
                </span>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white px-5 py-8 sm:px-6 lg:px-8">
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
