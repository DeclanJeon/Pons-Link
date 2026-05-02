import { Link, Navigate } from 'react-router-dom';
import { ArrowUpRight, Globe, UserRound } from 'lucide-react';
import LoungeShell from '@/components/lounge/LoungeShell';
import { useAliases } from '@/features/personal-link/useAliases';
import { useAuthSession } from '@/features/personal-link/useAuthSession';

const LoungeAliases = () => {
  const { session } = useAuthSession();
  const aliases = useAliases();

  if (!session) return <Navigate to="/login" replace />;

  return (
    <LoungeShell>
        <section className="rounded-lg border border-white/[0.08] bg-[#111216]/90 p-6 shadow-[0_30px_120px_-65px_rgba(0,0,0,0.95)] lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-medium text-zinc-400">
                <UserRound className="h-3.5 w-3.5" />
                Alias Management
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">Alias operations</h1>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Check visibility, response policy, and allowed request types for public aliases in one place, then jump to profile editing.
                </p>
              </div>
            </div>
            <Link
              to="/lounge/profile"
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.07] hover:text-white"
            >
              Edit alias settings in profile
            </Link>
          </div>
        </section>

        {aliases.items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/[0.12] bg-[#111216]/70 p-10 text-center text-white">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-teal-400/10 text-teal-200">
              <Globe className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">No public aliases configured yet</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Alias operation status will appear here once you save a public link slug and response policy in your profile.
            </p>
          </div>
        ) : (
          <section className="grid gap-4">
            {aliases.items.map((alias) => (
              <div
                key={alias.id}
                className="rounded-lg border border-white/[0.08] bg-[#111216]/80 p-5 text-white shadow-[0_20px_60px_-35px_rgba(20,184,166,0.35)]"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Primary alias</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-tight">{alias.alias}</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                        {alias.headline || 'Add a sharper headline in profile so visitors understand what this alias is for.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-zinc-300">
                        Status · {alias.statusLabel}
                      </span>
                      <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-zinc-300">
                        Visibility · {alias.visibilityLabel}
                      </span>
                      <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-zinc-300">
                        Response · {alias.responseLabel}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-4 lg:min-w-80">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Public reach</p>
                    <p className="mt-2 break-all font-mono text-sm text-white">
                      {window.location.origin}
                      {alias.href}
                    </p>
                    <p className="mt-4 text-sm text-zinc-400">Timezone · {alias.timezone}</p>
                    <p className="mt-2 text-sm text-zinc-400">Availability · {alias.availabilitySummary}</p>
                    <p className="mt-2 text-sm text-zinc-400">
                      Request types · {alias.enabledRequestTypes.length > 0 ? alias.enabledRequestTypes.join(', ') : 'None enabled'}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        to={alias.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-teal-300/25 bg-teal-300/10 px-4 py-2 text-sm text-teal-200 transition hover:bg-teal-300/15"
                      >
                        Open public alias
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                      <Link
                        to="/lounge/profile"
                        className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-4 py-2 text-sm text-zinc-400 transition hover:text-white"
                      >
                        Refine in profile
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}
    </LoungeShell>
  );
};

export default LoungeAliases;
