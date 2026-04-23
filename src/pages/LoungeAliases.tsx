import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Globe, UserRound } from 'lucide-react';
import { useAliases } from '@/features/personal-link/useAliases';
import { useAuthSession } from '@/features/personal-link/useAuthSession';

const LoungeAliases = () => {
  const { session } = useAuthSession();
  const aliases = useAliases();

  if (!session) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_24%)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 rounded-full border border-border/70 bg-card/75 px-4 py-3 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.5)] backdrop-blur">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="PonsLink" className="h-8 w-auto" loading="eager" />
            <p className="hidden text-xs text-muted-foreground sm:block">Alias policy and public reachability</p>
          </div>
          <Link to="/lounge" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> 라운지
          </Link>
        </div>

        <section className="rounded-[28px] border border-border/70 bg-card/85 p-6 shadow-[0_30px_120px_-45px_rgba(15,23,42,0.45)] backdrop-blur lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                <UserRound className="h-3.5 w-3.5" />
                Alias Management
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">별칭 운영</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  공개 별칭의 가시성, 응답 정책, 허용 request type을 한 곳에서 확인하고 프로필 편집으로 이어집니다.
                </p>
              </div>
            </div>
            <Link
              to="/lounge/profile"
              className="inline-flex items-center justify-center rounded-full border border-border/70 bg-background/75 px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              Edit alias settings in profile
            </Link>
          </div>
        </section>

        {aliases.items.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-border/80 bg-card/70 p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Globe className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">아직 구성된 공개 별칭이 없습니다</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              프로필에서 공개 링크 슬러그와 응답 정책을 저장하면 여기에 alias 운영 상태가 나타납니다.
            </p>
          </div>
        ) : (
          <section className="grid gap-4">
            {aliases.items.map((alias) => (
              <div
                key={alias.id}
                className="rounded-[24px] border border-border/70 bg-card/80 p-5 shadow-[0_20px_60px_-35px_rgba(14,165,233,0.35)]"
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
                      <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1">
                        Status · {alias.statusLabel}
                      </span>
                      <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1">
                        Visibility · {alias.visibilityLabel}
                      </span>
                      <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1">
                        Response · {alias.responseLabel}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-border/70 bg-background/75 p-4 lg:min-w-80">
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
                        className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-sm text-primary transition hover:bg-primary/15"
                      >
                        Open public alias
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                      <Link
                        to="/lounge/profile"
                        className="inline-flex items-center gap-2 rounded-full border border-border/70 px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground"
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
      </div>
    </div>
  );
};

export default LoungeAliases;
