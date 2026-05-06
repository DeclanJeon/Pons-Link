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
        <section className="rounded-lg border border-border/70 bg-white p-6 shadow-[0_24px_80px_-60px_rgba(15,23,42,0.45)] lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-muted-foreground">
                <UserRound className="h-3.5 w-3.5" />
                Alias Management
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Alias operations</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Check visibility, response policy, and allowed request types for public aliases in one place, then jump to profile editing.
                </p>
              </div>
            </div>
            <Link
              to="/lounge/profile"
              className="inline-flex items-center justify-center rounded-lg border border-border/70 bg-[#F8FAFC] px-4 py-2 text-sm text-muted-foreground transition hover:border-[#1E63FF]/30 hover:text-[#1E63FF]"
            >
              Edit alias settings in profile
            </Link>
          </div>
        </section>

        {aliases.items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center text-foreground">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#1E63FF]">
              <Globe className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">No public aliases configured yet</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Alias operation status will appear here once you save a public link slug and response policy in your profile.
            </p>
          </div>
        ) : (
          <section className="grid gap-4">
            {aliases.items.map((alias) => (
              <div
                key={alias.id}
                className="rounded-lg border border-border/70 bg-white p-5 text-foreground shadow-[0_18px_55px_-45px_rgba(15,23,42,0.5)]"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Primary alias</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-tight">{alias.alias}</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        {alias.headline || 'Add a sharper headline in profile so visitors understand what this alias is for.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className="rounded-full border border-border/70 bg-[#F8FAFC] px-3 py-1 text-muted-foreground">
                        Status · {alias.statusLabel}
                      </span>
                      <span className="rounded-full border border-border/70 bg-[#F8FAFC] px-3 py-1 text-muted-foreground">
                        Visibility · {alias.visibilityLabel}
                      </span>
                      <span className="rounded-full border border-border/70 bg-[#F8FAFC] px-3 py-1 text-muted-foreground">
                        Response · {alias.responseLabel}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-[#F8FAFC] p-4 lg:min-w-80">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Public reach</p>
                    <p className="mt-2 break-all font-mono text-sm text-foreground">
                      {window.location.origin}
                      {alias.href}
                    </p>
                    <p className="mt-4 text-sm text-muted-foreground">Timezone · {alias.timezone}</p>
                    <p className="mt-2 text-sm text-muted-foreground">Availability · {alias.availabilitySummary}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Request types · {alias.enabledRequestTypes.length > 0 ? alias.enabledRequestTypes.join(', ') : 'None enabled'}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        to={alias.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-[#1E63FF]/20 bg-[#EAF1FF] px-4 py-2 text-sm font-medium text-[#1E63FF] transition hover:bg-[#dbe8ff]"
                      >
                        Open public alias
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                      <Link
                        to="/lounge/profile"
                        className="inline-flex items-center gap-2 rounded-lg border border-border/70 px-4 py-2 text-sm text-muted-foreground transition hover:border-[#1E63FF]/30 hover:text-[#1E63FF]"
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
