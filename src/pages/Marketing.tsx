import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  Clapperboard,
  FileUp,
  Link2,
  MessageSquareText,
  Mic,
  MonitorUp,
  Palette,
  RadioTower,
  ShieldCheck,
  Sparkles,
  Video,
} from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const Marketing = () => {
  const { t } = useTranslation();

  const flowSteps = [
    {
      title: t('marketing.flow.steps.collect.title'),
      desc: t('marketing.flow.steps.collect.desc'),
      icon: Link2,
    },
    {
      title: t('marketing.flow.steps.approve.title'),
      desc: t('marketing.flow.steps.approve.desc'),
      icon: MessageSquareText,
    },
    {
      title: t('marketing.flow.steps.meet.title'),
      desc: t('marketing.flow.steps.meet.desc'),
      icon: CalendarCheck2,
    },
  ];

  const capabilities = [
    { label: t('marketing.features.capabilities.video'), icon: Video },
    { label: t('marketing.features.capabilities.audio'), icon: Mic },
    { label: t('marketing.features.capabilities.screenShare'), icon: MonitorUp },
    { label: t('marketing.features.capabilities.mediaStream'), icon: RadioTower },
    { label: t('marketing.features.capabilities.coWatch'), icon: Clapperboard },
    { label: t('marketing.features.capabilities.chat'), icon: MessageSquareText },
    { label: t('marketing.features.capabilities.fileHandoff'), icon: FileUp },
    { label: t('marketing.features.capabilities.whiteboard'), icon: Palette },
  ];

  const roomCapabilities = [
    {
      title: t('marketing.features.rooms.voice.title'),
      tag: t('marketing.features.rooms.voice.tag'),
      desc: t('marketing.features.rooms.voice.desc'),
      image: '/img/features/voice-mode.png',
      icon: Mic,
    },
    {
      title: t('marketing.features.rooms.video.title'),
      tag: t('marketing.features.rooms.video.tag'),
      desc: t('marketing.features.rooms.video.desc'),
      image: '/img/features/video-rooms.png',
      icon: Video,
    },
    {
      title: t('marketing.features.rooms.whiteboard.title'),
      tag: t('marketing.features.rooms.whiteboard.tag'),
      desc: t('marketing.features.rooms.whiteboard.desc'),
      image: '/img/features/whiteboard.png',
      icon: Palette,
    },
    {
      title: t('marketing.features.rooms.chat.title'),
      tag: t('marketing.features.rooms.chat.tag'),
      desc: t('marketing.features.rooms.chat.desc'),
      image: '/img/features/live-chat.png',
      icon: MessageSquareText,
    },
    {
      title: t('marketing.features.rooms.ponscast.title'),
      tag: t('marketing.features.rooms.ponscast.tag'),
      desc: t('marketing.features.rooms.ponscast.desc'),
      image: '/img/features/ponscast.png',
      icon: RadioTower,
    },
    {
      title: t('marketing.features.rooms.cowatch.title'),
      tag: t('marketing.features.rooms.cowatch.tag'),
      desc: t('marketing.features.rooms.cowatch.desc'),
      image: '/img/features/youtube-cowatch.png',
      icon: Clapperboard,
    },
    {
      title: t('marketing.features.rooms.fileTransfer.title'),
      tag: t('marketing.features.rooms.fileTransfer.tag'),
      desc: t('marketing.features.rooms.fileTransfer.desc'),
      image: '/img/features/file-transfer.png',
      icon: FileUp,
    },
  ];

  const trustItems = [
    { title: t('marketing.trust.items.private'), icon: ShieldCheck },
    { title: t('marketing.trust.items.time'), icon: CheckCircle2 },
    { title: t('marketing.trust.items.workflow'), icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#111827]">
      <header className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white/90 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3" aria-label={t('marketing.nav.homeAria')}>
            <img src="/icon.svg" alt="" className="h-8 w-8" loading="eager" />
            <span className="text-lg font-bold tracking-tight text-[#111827]">PonsLink</span>
          </Link>
          <div className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <a href="#flow" className="transition hover:text-[#1E63FF]">{t('marketing.nav.flow')}</a>
            <a href="#features" className="transition hover:text-[#1E63FF]">{t('marketing.nav.features')}</a>
            <a href="#usecases" className="transition hover:text-[#1E63FF]">{t('marketing.nav.useCases')}</a>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link to="/login" className="hidden h-10 items-center rounded-[10px] border border-[#E5E7EB] px-4 text-sm font-semibold text-slate-700 transition hover:border-[#1E63FF]/30 hover:text-[#1E63FF] sm:inline-flex">
              {t('marketing.nav.login')}
            </Link>
            <Link to="/login" className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[#1E63FF] px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(30,99,255,0.22)] transition hover:bg-[#174fd1]">
              {t('marketing.nav.start')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D7E5FF] bg-[#EEF5FF] px-3 py-1 text-xs font-semibold text-[#1E63FF]">
              <Link2 className="h-3.5 w-3.5" />
              {t('marketing.hero.badge')}
            </div>
            <h1 className="mt-6 text-5xl font-bold leading-[1.02] tracking-tight text-[#111827] sm:text-6xl">
              {t('marketing.hero.title')}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#6B7280]">
              {t('marketing.hero.description')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login" className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-[#1E63FF] px-5 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(30,99,255,0.24)] transition hover:bg-[#174fd1]">
                {t('marketing.hero.primaryCta')}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/legacy-home" className="inline-flex h-11 items-center rounded-[10px] border border-[#E5E7EB] bg-white px-5 text-sm font-semibold text-[#1E63FF] transition hover:border-[#BCD4FF]">
                {t('marketing.hero.secondaryCta')}
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[28px] border border-[#E5E7EB] bg-white p-3 shadow-[0_28px_80px_rgba(15,23,42,0.10)]">
              <div className="overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC]">
                <img
                  src="/img/hero/marketing-cinematic-live-call.png"
                  alt={t('marketing.hero.imageAlt')}
                  className="aspect-[16/9] w-full object-cover"
                  loading="eager"
                />
              </div>
              <div className="grid gap-3 p-3 md:grid-cols-3">
                {flowSteps.map(({ title, icon: Icon }, index) => (
                  <div key={title} className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                    <div className="flex items-center justify-between">
                      <Icon className="h-5 w-5 text-[#1E63FF]" />
                      <span className="text-xs font-bold text-[#6B7280]">0{index + 1}</span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-[#111827]">{title}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="flow" className="border-y border-[#E5E7EB] bg-white px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl py-16">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1E63FF]">{t('marketing.flow.eyebrow')}</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
                {t('marketing.flow.heading')}
              </h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {flowSteps.map(({ title, desc, icon: Icon }) => (
                <article key={title} className="rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF5FF] text-[#1E63FF]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-[#111827]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#6B7280]">{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1E63FF]">{t('marketing.features.eyebrow')}</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
                {t('marketing.features.heading')}
              </h2>
            </div>
            <div className="flex max-w-xl flex-wrap gap-2">
              {capabilities.map(({ label, icon: Icon }) => (
                <span key={label} className="inline-flex h-9 items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-slate-700">
                  <Icon className="h-4 w-4 text-[#1E63FF]" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-12">
            {roomCapabilities.map(({ title, tag, desc, image, icon: Icon }, index) => (
              <article
                key={title}
                className={[
                  'overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)]',
                  index < 2 ? 'xl:col-span-6' : 'xl:col-span-4',
                ].join(' ')}
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-[#05070D]">
                  <img src={image} alt={t('marketing.features.imageAlt', { title })} className="h-full w-full object-cover" loading="lazy" />
                  <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#111827] shadow-sm">
                    <Icon className="h-3.5 w-3.5 text-[#1E63FF]" />
                    {tag}
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-[#111827]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#6B7280]">{desc}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="usecases" className="bg-[#0B1220] px-4 py-16 text-white sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 py-16 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#18D7C8]">{t('marketing.trust.eyebrow')}</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
                {t('marketing.trust.heading')}
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {trustItems.map(({ title, icon: Icon }) => (
                <div key={title} className="rounded-2xl border border-white/[0.08] bg-white/[0.05] p-5">
                  <Icon className="h-5 w-5 text-[#18D7C8]" />
                  <p className="mt-3 text-sm font-semibold">{title}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Marketing;
