import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck2,
  Clapperboard,
  Link2,
  MessageSquareText,
  Mic,
  Palette,
  RadioTower,
  Upload,
  Video,
} from 'lucide-react';

const features = [
  {
    num: '01',
    title: 'One Link for First Contact',
    desc: 'Share a room-shaped profile link that collects the visitor, context, and preferred time before anyone enters your live space.',
    icon: Link2,
    accent: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
  },
  {
    num: '02',
    title: 'Approve With Context',
    desc: 'Read the purpose, timing, and identity signal first. Accept, decline, or ask for another time without exposing your inbox.',
    icon: MessageSquareText,
    accent: 'text-violet-400',
    bg: 'bg-violet-500/10',
  },
  {
    num: '03',
    title: 'Scheduling That Carries the Thread',
    desc: 'When you approve a request, PonsLink turns it into a scheduled session link with the conversation history still attached.',
    icon: CalendarCheck2,
    accent: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  {
    num: '04',
    title: 'A Room That Opens at the Right Moment',
    desc: 'Approved guests move from the access link into voice or video. Everyone else stays at the request gate.',
    icon: RadioTower,
    accent: 'text-sky-400',
    bg: 'bg-sky-500/10',
  },
];

const useCases = [
  {
    title: 'Freelancers & Creators',
    desc: 'Turn portfolio interest into reviewed calls without publishing your personal email or juggling separate tools.',
  },
  {
    title: 'Mentors & Coaches',
    desc: 'Keep intake, scheduling, and the actual session in one controlled flow.',
  },
  {
    title: 'Hiring & Business Meetings',
    desc: 'Start every conversation with purpose, time, and participant context already captured.',
  },
];

const roomCapabilities = [
  {
    title: 'Voice mode',
    tag: 'Audio-first presence',
    desc: 'Jump into lighter rooms when voice is enough. Mute fast, keep the pressure low, and stay present without forcing camera time.',
    image: '/img/features/voice-mode.png',
    icon: Mic,
  },
  {
    title: 'Video rooms',
    tag: 'Face-to-face energy',
    desc: 'Switch on camera, keep the grid alive, and move from a request link to a real conversation without changing products.',
    image: '/img/features/video-rooms.png',
    icon: Video,
  },
  {
    title: 'Collaborative whiteboard',
    tag: 'Draw together live',
    desc: 'Sketch, annotate, zoom, and follow each other on the same canvas with pen, shapes, text, and shared focus tools.',
    image: '/img/features/whiteboard.png',
    icon: Palette,
  },
  {
    title: 'Live chat',
    tag: 'Keep context moving',
    desc: 'Chat stays inside the room with replies, reactions, message flow, and file handoff support when talking alone is too slow.',
    image: '/img/features/live-chat.png',
    icon: MessageSquareText,
  },
  {
    title: 'PonsCast',
    tag: 'Stream media to the room',
    desc: 'Share videos, PDFs, images, and playlists as a live room surface instead of asking everyone to hunt for separate links.',
    image: '/img/features/ponscast.png',
    icon: RadioTower,
  },
  {
    title: 'YouTube CoWatch',
    tag: 'Watch together, react together',
    desc: 'Open synchronized shared viewing with a dedicated CoWatch control so the room can talk around the same moment in real time.',
    image: '/img/features/youtube-cowatch.png',
    icon: Clapperboard,
  },
  {
    title: 'File transfer',
    tag: 'Send it without leaving',
    desc: 'Move files directly between participants with transfer progress, pause-resume controls, and room-native delivery instead of email ping-pong.',
    image: '/img/features/file-transfer.png',
    icon: Upload,
  },
];

const Marketing = () => {
  return (
    <div
      className="min-h-screen bg-[#080808] text-white"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% -10%, rgba(125,231,223,0.12), transparent)' }}
    >
      {/* Nav */}
      <nav className="fixed inset-x-0 top-0 z-50 bg-[#080808]/80 backdrop-blur-xl">
        {/* Top gradient line */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
        <div className="flex h-16 items-center justify-between px-6 lg:px-10">
          {/* Logo */}
          <Link to="/" className="flex cursor-pointer items-center gap-3 group">
            <img
              src="/logo.svg"
              alt="PonsLink"
              className="h-8 w-auto drop-shadow-[0_8px_20px_rgba(125,231,223,0.16)]"
              loading="eager"
            />
          </Link>

          {/* Links */}
          <div className="hidden items-center gap-1 sm:flex">
            {[['#features', 'Features'], ['#usecases', 'Use Cases']].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="cursor-pointer rounded-md px-3 py-1.5 text-sm text-zinc-500 transition hover:bg-white/[0.05] hover:text-white"
              >
                {label}
              </a>
            ))}
          </div>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden cursor-pointer text-sm text-zinc-500 transition hover:text-white sm:block">
              Log in
            </Link>
            <Link
              to="/login"
              className="group relative cursor-pointer overflow-hidden rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-100"
            >
              <span className="relative flex items-center gap-1.5">
                Get Started
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          </div>
        </div>
        {/* Bottom border */}
        <div className="h-px w-full bg-white/[0.06]" />
      </nav>

      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pb-10 pt-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-zinc-500 mb-10">
          <span className="h-1.5 w-1.5 rounded-full bg-[#8DEBE4]" />
          Personal link, request gate, live room
        </div>

        <h1
          className="max-w-5xl font-bold tracking-[-0.04em] text-white"
          style={{ fontSize: 'clamp(2.8rem, 7vw, 6.5rem)', lineHeight: '0.95' }}
        >
          Your profile link<br />
          becomes the room<br />
          <span className="bg-gradient-to-r from-[#F5C16C] to-[#8DEBE4] bg-clip-text text-transparent">
            when it matters.
          </span>
        </h1>

        <p className="mx-auto mt-8 max-w-lg text-base leading-7 text-zinc-500">
          Collect the reason, approve the moment, and open<br />
          a secure voice or video space without sending people<br />
          across your inbox, calendar, and meeting app.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/login"
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-zinc-100"
          >
            Create your link
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/legacy-home"
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-6 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.08]"
          >
            See the room
          </Link>
        </div>

        {/* Product Hero Image */}
        <div className="relative mt-10 w-full max-w-[1240px]">
          <div className="pointer-events-none absolute inset-x-[8%] -top-10 bottom-8 rounded-[40px] bg-[radial-gradient(circle_at_50%_35%,rgba(125,231,223,0.18),rgba(245,193,108,0.08)_34%,rgba(8,8,12,0)_72%)] blur-3xl" />
          <div className="relative overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#0D0D0D]/96 p-2 shadow-[0_22px_60px_rgba(0,0,0,0.38),0_40px_140px_rgba(76,29,149,0.20)] sm:p-3 lg:p-4">
            <div className="overflow-hidden rounded-[24px] border border-white/[0.05] bg-[#09090B] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <img
                src="/img/hero/marketing-cinematic-live-call.png"
                alt="PonsLink cinematic hero image showing a smiling man and woman in a premium live video conversation with subtle collaboration and media-sharing cues"
                className="aspect-[16/9] w-full object-cover object-center"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="sessions" className="px-6 py-24 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-600">Live room capabilities</p>
            <h2 className="mt-4 text-4xl font-bold tracking-[-0.03em] text-white sm:text-5xl">
              Inside every session,
              <br />
              the room keeps the context alive.
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
              Voice, video, whiteboard, chat, media streaming, synchronized watching, and file sharing stay in the same room as the request that started it.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">Talk live</span>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">Draw together</span>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">Watch together</span>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">Send in-room</span>
            </div>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-12">
            {roomCapabilities.map(({ title, tag, desc, image, icon: Icon }, index) => {
              const wide = index < 2;
              return (
                <article
                  key={title}
                  className={[
                    'group relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.03] shadow-[0_20px_80px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-1 hover:border-white/[0.16] hover:bg-white/[0.05]',
                    wide ? 'xl:col-span-6' : 'xl:col-span-4',
                  ].join(' ')}
                >
                  <div className="relative aspect-[16/10] overflow-hidden border-b border-white/[0.08] bg-[#05070d]">
                    <img
                      src={image}
                      alt={`${title} feature artwork for PonsLink room page`}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,18,0.02)_0%,rgba(6,10,18,0.18)_45%,rgba(6,10,18,0.82)_100%)]" />
                    <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-black/35 px-3 py-1.5 backdrop-blur-md">
                      <Icon className="h-3.5 w-3.5 text-[#8DEBE4]" />
                      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-200">{tag}</span>
                    </div>
                  </div>
                  <div className="p-6 sm:p-7">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-2xl font-semibold tracking-[-0.02em] text-white">{title}</h3>
                        <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-400">{desc}</p>
                      </div>
                      <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-zinc-300 sm:flex">
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-32 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">Features</p>
            <h2 className="mt-4 text-4xl font-bold tracking-[-0.03em] text-white sm:text-5xl">
              Request to room,<br />without the handoff.
            </h2>
          </div>

          <div className="flex flex-col">
            {features.map(({ num, title, desc, icon: Icon, accent, bg }) => (
              <div key={num} className="group grid grid-cols-[3.5rem_1fr_auto] items-start gap-8 border-t border-white/[0.07] py-10 transition hover:border-white/[0.14]">
                <span className="pt-1 font-mono text-sm text-zinc-700">{num}</span>
                <div className="min-w-0">
                  <h3 className="text-xl font-semibold text-white">{title}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-7 text-zinc-500">{desc}</p>
                </div>
                <div className={`hidden shrink-0 rounded-2xl ${bg} p-3 lg:flex`}>
                  <Icon className={`h-6 w-6 ${accent}`} />
                </div>
              </div>
            ))}
            <div className="border-t border-white/[0.07]" />
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="usecases" className="px-6 py-32 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">Use Cases</p>
            <h2 className="mt-4 text-4xl font-bold tracking-[-0.03em] text-white sm:text-5xl">
              Built for people whose time needs context.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {useCases.map(({ title, desc }) => (
              <div key={title} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 transition hover:border-white/[0.12] hover:bg-white/[0.04]">
                <h3 className="font-semibold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-32 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div
            className="overflow-hidden rounded-3xl border border-white/[0.07] px-10 py-20 text-center"
            style={{ backgroundImage: 'radial-gradient(ellipse 60% 80% at 50% 50%, rgba(125,231,223,0.12), transparent)' }}
          >
            <h2 className="text-4xl font-bold tracking-[-0.03em] text-white sm:text-5xl">
              Start with one link
            </h2>
            <p className="mx-auto mt-5 max-w-md text-zinc-500">
              Let people introduce their reason first, then meet them in a room that already knows the context.
            </p>
            <Link
              to="/login"
              className="mt-10 inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-semibold text-black transition hover:bg-zinc-100"
            >
              Create your PonsLink
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-6 py-8 lg:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo.svg"
              alt="PonsLink"
              className="h-7 w-auto opacity-95"
              loading="lazy"
            />
          </div>
          <span className="text-xs text-zinc-700">© 2026 · From request to room.</span>
          <div className="flex items-center gap-6">
            <Link to="/login" className="text-xs text-zinc-600 transition hover:text-white">Log in</Link>
            <Link to="/legacy-home" className="text-xs text-zinc-600 transition hover:text-white">Live Space</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Marketing;
