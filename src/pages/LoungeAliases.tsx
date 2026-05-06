import { Link, Navigate } from 'react-router-dom';
import { ArrowUpRight, Globe, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LoungeShell from '@/components/lounge/LoungeShell';
import { useAliases } from '@/features/personal-link/useAliases';
import { useAuthSession } from '@/features/personal-link/useAuthSession';

const LoungeAliases = () => {
  const { t } = useTranslation();
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
                {t('lounge.aliasesPage.eyebrow')}
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">{t('lounge.aliasesPage.title')}</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t('lounge.aliasesPage.description')}
                </p>
              </div>
            </div>
            <Link
              to="/lounge/profile"
              className="inline-flex items-center justify-center rounded-lg border border-border/70 bg-[#F8FAFC] px-4 py-2 text-sm text-muted-foreground transition hover:border-[#1E63FF]/30 hover:text-[#1E63FF]"
            >
              {t('lounge.aliasesPage.editSettings')}
            </Link>
          </div>
        </section>

        {aliases.items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center text-foreground">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#1E63FF]">
              <Globe className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">{t('lounge.aliasesPage.emptyTitle')}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t('lounge.aliasesPage.emptyDescription')}
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
                      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{t('lounge.aliasesPage.primaryAlias')}</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-tight">{alias.alias}</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        {alias.headline || t('lounge.aliasesPage.headlineFallback')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className="rounded-full border border-border/70 bg-[#F8FAFC] px-3 py-1 text-muted-foreground">
                        {t('lounge.aliasesPage.status')} · {alias.statusLabel}
                      </span>
                      <span className="rounded-full border border-border/70 bg-[#F8FAFC] px-3 py-1 text-muted-foreground">
                        {t('lounge.aliasesPage.visibility')} · {alias.visibilityLabel}
                      </span>
                      <span className="rounded-full border border-border/70 bg-[#F8FAFC] px-3 py-1 text-muted-foreground">
                        {t('lounge.aliasesPage.response')} · {alias.responseLabel}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-[#F8FAFC] p-4 lg:min-w-80">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{t('lounge.aliasesPage.publicReach')}</p>
                    <p className="mt-2 break-all font-mono text-sm text-foreground">
                      {window.location.origin}
                      {alias.href}
                    </p>
                    <p className="mt-4 text-sm text-muted-foreground">{t('lounge.aliasesPage.timezone')} · {alias.timezone}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{t('lounge.aliasesPage.availability')} · {alias.availabilitySummary}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t('lounge.aliasesPage.requestTypes')} · {alias.enabledRequestTypes.length > 0 ? alias.enabledRequestTypes.join(', ') : t('lounge.aliasesPage.noneEnabled')}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        to={alias.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-[#1E63FF]/20 bg-[#EAF1FF] px-4 py-2 text-sm font-medium text-[#1E63FF] transition hover:bg-[#dbe8ff]"
                      >
                        {t('lounge.aliasesPage.openPublicAlias')}
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                      <Link
                        to="/lounge/profile"
                        className="inline-flex items-center gap-2 rounded-lg border border-border/70 px-4 py-2 text-sm text-muted-foreground transition hover:border-[#1E63FF]/30 hover:text-[#1E63FF]"
                      >
                        {t('lounge.aliasesPage.refineInProfile')}
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
