import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck2,
  Link2,
  Mail,
  MessageSquareText,
  RadioTower,
} from 'lucide-react';

const features = [
  {
    num: '01',
    title: 'Personal Link Control',
    desc: 'Replace phone numbers and emails with a single URL. You decide who reaches you, when, and for what purpose — full control over every inbound connection.',
    icon: Link2,
    accent: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
  },
  {
    num: '02',
    title: 'Request Review',
    desc: 'Read the visitor\'s intent and preferred time, then accept or decline. Every decision is yours — no algorithmic filtering, just raw context.',
    icon: MessageSquareText,
    accent: 'text-violet-400',
    bg: 'bg-violet-500/10',
  },
  {
    num: '03',
    title: 'Booking Automation',
    desc: 'The moment you accept, a confirmation email and session link are sent automatically. Timezone handling and messaging — all taken care of.',
    icon: CalendarCheck2,
    accent: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  {
    num: '04',
    title: 'Direct Session Entry',
    desc: 'Only approved contacts enter your Lobby and Room. No random connections — only conversations that actually matter.',
    icon: RadioTower,
    accent: 'text-sky-400',
    bg: 'bg-sky-500/10',
  },
];

const useCases = [
  {
    title: 'Freelancers & Creators',
    desc: 'Consolidate all inbound inquiries into one link and filter out noise before it reaches you.',
  },
  {
    title: 'Mentors & Coaches',
    desc: 'Automate 1:1 requests and bookings so you can focus entirely on the session itself.',
  },
  {
    title: 'Hiring & Business Meetings',
    desc: 'Create a clear first touchpoint and open every conversation with context and trust.',
  },
];

const Marketing = () => {
  return (
    <div
      className="min-h-screen bg-[#080808] text-white"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% -10%, rgba(99,102,241,0.12), transparent)' }}
    >
      {/* Nav */}
      <nav className="fixed inset-x-0 top-0 z-50 bg-[#080808]/80 backdrop-blur-xl">
        {/* Top gradient line */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
        <div className="flex h-16 items-center justify-between px-6 lg:px-10">
          {/* Logo */}
          <Link to="/" className="flex cursor-pointer items-center gap-2.5 group">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_0_12px_rgba(99,102,241,0.5)]">
              <span className="text-[11px] font-bold text-white">P</span>
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">PonsLink</span>
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
      <section className="flex min-h-screen flex-col items-center justify-center px-6 pb-0 pt-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-zinc-500 mb-10">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Personal Link Communication
        </div>

        <h1
          className="max-w-5xl font-bold tracking-[-0.04em] text-white"
          style={{ fontSize: 'clamp(2.8rem, 7vw, 6.5rem)', lineHeight: '0.95' }}
        >
          From First Contact<br />
          to Real Conversation,<br />
          <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            One Link.
          </span>
        </h1>

        <p className="mx-auto mt-8 max-w-lg text-base leading-7 text-zinc-500">
          Receive requests through your personal link, review them<br />
          directly, confirm a schedule, and connect to a real<br />
          session — all in one seamless flow.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/login"
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-zinc-100"
          >
            Get Started for Free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/legacy-home"
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-6 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.08]"
          >
            See Live Spaces
          </Link>
        </div>

        {/* Product Mockup */}
        <div className="mt-16 w-full max-w-6xl overflow-hidden rounded-t-2xl border border-b-0 border-white/[0.08] bg-[#0D0D0D] shadow-[0_-20px_80px_rgba(99,102,241,0.1)]">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 border-b border-white/[0.06] bg-[#111111] px-5 py-3">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
              <div className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
              <div className="h-3 w-3 rounded-full bg-[#28C840]" />
            </div>
            <div className="mx-auto flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.04] px-4 py-1 text-xs text-zinc-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
              app.ponslink.com/lounge
            </div>
          </div>
          {/* Mockup bento */}
          <div className="grid gap-2.5 p-4 lg:grid-cols-3">
            {/* Profile */}
            <div className="col-span-2 rounded-xl border border-white/[0.07] bg-gradient-to-br from-indigo-500/[0.12] to-transparent p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/20 text-sm font-bold text-indigo-300">JD</div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-600">Active Link</p>
                  <h2 className="text-base font-semibold text-white">Jane Doe</h2>
                  <p className="text-xs text-zinc-500">ponslink.com/u/jane</p>
                </div>
                <span className="ml-auto rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">active</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[['Friends', '12', 'bg-sky-500/[0.08]'], ['Pending', '3', 'bg-violet-500/[0.08]'], ['Confirmed', '5', 'bg-emerald-500/[0.08]']].map(([label, value, bg]) => (
                  <div key={label} className={`rounded-lg border border-white/[0.06] ${bg} p-3`}>
                    <p className="text-[10px] text-zinc-500">{label}</p>
                    <p className="mt-1.5 text-2xl font-bold tracking-tight text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* Quick menu */}
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <p className="mb-3 text-[10px] uppercase tracking-widest text-zinc-600">Quick Access</p>
              <div className="flex flex-col gap-1.5">
                {[['Requests', 'bg-violet-400'], ['Bookings', 'bg-emerald-400'], ['Email Guides', 'bg-sky-400'], ['Profile', 'bg-indigo-400']].map(([label, dot]) => (
                  <div key={label} className="flex items-center gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.03] px-3 py-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                    <span className="text-xs text-zinc-400">{label}</span>
                    <ArrowRight className="ml-auto h-3 w-3 text-zinc-700" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-32 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">Features</p>
            <h2 className="mt-4 text-4xl font-bold tracking-[-0.03em] text-white sm:text-5xl">
              One Link.<br />Four Flows.
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
              Who's it for?
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
            style={{ backgroundImage: 'radial-gradient(ellipse 60% 80% at 50% 50%, rgba(99,102,241,0.12), transparent)' }}
          >
            <h2 className="text-4xl font-bold tracking-[-0.03em] text-white sm:text-5xl">
              Start Your Lounge Today
            </h2>
            <p className="mx-auto mt-5 max-w-md text-zinc-500">
              Manage requests, bookings, and sessions in one seamless flow with a single personal link.
            </p>
            <Link
              to="/login"
              className="mt-10 inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-semibold text-black transition hover:bg-zinc-100"
            >
              Get Started for Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-6 py-8 lg:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-600">
              <span className="text-[9px] font-bold text-white">P</span>
            </div>
            <span className="text-sm font-semibold text-white">PonsLink</span>
          </div>
          <span className="text-xs text-zinc-700">© 2026 · "The Bridge That Never Breaks."</span>
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
