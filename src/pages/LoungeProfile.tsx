import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import {
  Camera,
  ChevronDown,
  ImagePlus,
  LayoutPanelTop,
  Link2,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react';
import LoungeShell from '@/components/lounge/LoungeShell';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { getConfiguredPersonalLinkApiUrl, usePersonalLinkRepository } from '@/features/personal-link/usePersonalLinkRepository';
import { localRepository } from '@/features/personal-link/localRepository';
import type { AccountProfile, PersonalLinkRoomType, PublicProfile, UserProfile } from '@/features/personal-link/types';
import { isValidRoomType } from '@/types/roomCapabilities';

const HEADLINE_MAX = 100;
const BIO_MAX = 500;
const LoungeProfile = () => {
  const { t } = useTranslation();
  const { session } = useAuthSession();
  const apiUrl = getConfiguredPersonalLinkApiUrl();
  const repositorySelection = apiUrl ? { apiUrl } : undefined;
  const repository = usePersonalLinkRepository(repositorySelection);
  const [displayName, setDisplayName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [image, setImage] = useState('');
  const [roomType, setRoomType] = useState<PersonalLinkRoomType>('audio-one-to-one');
  const [publicAlias, setPublicAlias] = useState('');
  const [message, setMessage] = useState('');
  const [imgError, setImgError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [initialValues, setInitialValues] = useState({ displayName: '', headline: '', bio: '', image: '', roomType: 'audio-one-to-one' as PersonalLinkRoomType, publicAlias: '' });
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDirty = useMemo(() => {
    return (
      displayName !== initialValues.displayName ||
      headline !== initialValues.headline ||
      bio !== initialValues.bio ||
      image !== initialValues.image ||
      roomType !== initialValues.roomType ||
      publicAlias !== initialValues.publicAlias
    );
  }, [displayName, headline, bio, image, roomType, publicAlias, initialValues]);

  const clearMessage = useCallback(() => {
    if (messageTimer.current) {
      clearTimeout(messageTimer.current);
      messageTimer.current = null;
    }
  }, []);

  const showMessage = useCallback(
    (text: string, duration = 4000) => {
      clearMessage();
      setMessage(text);
      messageTimer.current = setTimeout(() => setMessage(''), duration);
    },
    [clearMessage],
  );

  useEffect(() => {
    if (!session) return;

    setDisplayName((current) => current || session.displayName || '');
    setImage((current) => current || session.avatarUrl || '');

    void repository
      .getAuthBootstrapProfile(session.email)
      .then((data) => {
        const dn = data.accountProfile?.displayName ?? session.displayName ?? '';
        const hl = data.publicProfile?.headline ?? '';
        const b = data.publicProfile?.bio ?? '';
        const img = data.accountProfile?.profileImageUrl ?? session.avatarUrl ?? '';
        const rt = isValidRoomType(data.publicProfile?.defaultRoomType) ? data.publicProfile.defaultRoomType : 'audio-one-to-one';
        const alias = data.publicProfile?.slug ?? session.primaryAlias ?? '';
        setDisplayName(dn);
        setHeadline(hl);
        setBio(b);
        setImage(img);
        setRoomType(rt);
        setPublicAlias(alias);
        setImgError(false);
        setInitialValues({ displayName: dn, headline: hl, bio: b, image: img, roomType: rt, publicAlias: alias });
      })
      .catch(() => {
        // Fallback to localRepository data if remote fails
        void localRepository.getAuthBootstrapProfile(session.email).then((localData) => {
          const dn = localData.accountProfile?.displayName ?? session.displayName ?? '';
          const hl = localData.publicProfile?.headline ?? '';
          const b = localData.publicProfile?.bio ?? '';
          const img = localData.accountProfile?.profileImageUrl ?? session.avatarUrl ?? '';
          const rt = isValidRoomType(localData.publicProfile?.defaultRoomType) ? localData.publicProfile.defaultRoomType : 'audio-one-to-one';
          const alias = localData.publicProfile?.slug ?? session.primaryAlias ?? '';
          setDisplayName(dn);
          setHeadline(hl);
          setBio(b);
          setImage(img);
          setRoomType(rt);
          setPublicAlias(alias);
          setImgError(false);
          setInitialValues({ displayName: dn, headline: hl, bio: b, image: img, roomType: rt, publicAlias: alias });
        }).catch(() => {
          const dn = session.displayName || '';
          setDisplayName(dn);
          setHeadline('');
          setBio('');
          setImage(session.avatarUrl ?? '');
          setRoomType('audio-one-to-one');
          setPublicAlias(session.primaryAlias ?? '');
          setImgError(false);
          setInitialValues({ displayName: dn, headline: '', bio: '', image: session.avatarUrl ?? '', roomType: 'audio-one-to-one', publicAlias: session.primaryAlias ?? '' });
        });
      });

    return () => clearMessage();
  }, [repository, session, apiUrl, clearMessage]);

  if (!session) return <Navigate to="/login" replace />;

  const hasValidImage = Boolean(image) && !imgError;
  const isUsingDefaultAvatar = Boolean(hasValidImage && session.avatarUrl && image === session.avatarUrl);

  const handleImage = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showMessage(t('lounge.profilePage.imageTooLarge'));
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showMessage(t('lounge.profilePage.imageTypeError'));
      return;
    }
    try {
      const imageUrl = await repository.saveAccountProfileImage(file);
      setImage(imageUrl);
      setImgError(false);
      showMessage(t('lounge.profilePage.imageUploaded'));
    } catch {
      showMessage(t('lounge.profilePage.imageUploadFailed'));
    }
  };

  const handleDeleteImage = async () => {
    try {
      await repository.removeAccountProfileImage();
      const fallback = session.avatarUrl ?? '';
      setImage(fallback);
      setImgError(false);
      showMessage(
        session.avatarUrl ? t('lounge.profilePage.customImageRemoved') : t('lounge.profilePage.imageRemoved'),
      );
    } catch {
      showMessage(t('lounge.profilePage.removeImageFailed'));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    const buildProfiles = async (repo: typeof repository) => {
      const customProfileImageUrl = image && image !== session.avatarUrl ? image : undefined;
      const userProfile: UserProfile = {
        userId: session.userId,
        providerSubject: session.providerSubject,
        primaryEmail: session.email,
        emailVerified: true,
        displayName,
        avatarUrl: session.avatarUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const accountProfile: AccountProfile = {
        userId: session.userId,
        displayName,
        statusMessage: 'Available for conversations',
        profileImageUrl: customProfileImageUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const existing = await repo.getAuthBootstrapProfile(session.email);
      const aliasForPublicProfile = publicAlias.trim() || existing.publicProfile?.slug || session.primaryAlias || `user-${session.userId}`;
      const publicProfile: PublicProfile = existing.publicProfile
        ? {
            ...existing.publicProfile,
            slug: aliasForPublicProfile,
            headline,
            bio,
            defaultRoomType: roomType,
            updatedAt: new Date().toISOString(),
          }
        : {
            userId: session.userId,
            slug: aliasForPublicProfile,
            headline,
            bio,
            responsePolicy: 'approve_before_booking',
            defaultRoomType: roomType,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            profileVisibility: 'public',
            allowGeneralRequest: true,
            allowScheduleRequest: true,
            allowMentoringRequest: true,
            allowCollabRequest: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

      await (repo as Partial<typeof repository>).saveUserProfile?.(userProfile);
      await repo.saveAccountProfile(accountProfile);
      await repo.savePublicProfile(publicProfile);
    };

    const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
      Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
      ]);

    try {
      await withTimeout(buildProfiles(repository), 5000);
      setInitialValues({ displayName, headline, bio, image, roomType, publicAlias });
      showMessage(t('lounge.profilePage.profileSaved'));
    } catch {
      showMessage(t('lounge.profilePage.publishFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const previewName = displayName.trim() || session.displayName || t('lounge.profilePage.addDisplayName');
  const previewHeadline = headline.trim() || t('lounge.profilePage.previewHeadline');
  const previewBio = bio.trim() || t('lounge.profilePage.previewBio');
  const normalizedPublicAlias = publicAlias.trim().replace(/^@+/, '').toLowerCase();
  const publicPathPreview = normalizedPublicAlias ? `/room/${normalizedPublicAlias}` : t('lounge.profilePage.inactiveLink');
  const internalUniqueNumber = session.uniqueNumber ?? t('lounge.profilePage.issuedAfterLogin');

  const completionItems = [displayName.trim(), headline.trim(), bio.trim(), image.trim() && !imgError].filter(Boolean).length;

  return (
    <LoungeShell contentClassName="max-w-6xl">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {/* Top: Overview */}
        <section
          data-testid="lounge-profile-shell"
          data-tone="lounge-light"
          className="overflow-hidden rounded-[32px] border border-border/70 bg-white shadow-[0_24px_80px_-60px_rgba(15,23,42,0.45)]"
          aria-label={t('lounge.profilePage.overviewAria')}
        >
          {/* Header */}
          <div className="border-b border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(30,99,255,0.10),transparent_34%),linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,0))] px-6 py-6 sm:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#1E63FF]/20 bg-[#EAF1FF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#1E63FF]">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t('lounge.profilePage.identity')}
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  {t('lounge.profilePage.title')}
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                  {t('lounge.profilePage.description')}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[320px]">
                <div className="rounded-2xl border border-border/70 bg-[#F8FAFC] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('lounge.profilePage.profileScore')}</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{completionItems}/4</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t('lounge.profilePage.scoreDescription')}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-[#F8FAFC] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('lounge.profilePage.visibility')}</p>
                  <p className="mt-2 text-base font-semibold text-foreground">{t('lounge.profilePage.publicReady')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t('lounge.profilePage.visibilityDescription')}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-[#F8FAFC] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('lounge.profilePage.responseMode')}</p>
                  <p className="mt-2 text-base font-semibold text-foreground">{t('lounge.profilePage.approveFirst')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t('lounge.profilePage.responseDescription')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Cards grid */}
          <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_320px]">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Profile preview */}
              <article className="flex flex-col rounded-[28px] border border-border/70 bg-[#F8FAFC] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF1FF] text-[#1E63FF]">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t('lounge.profilePage.preview')}</p>
                    <p className="text-xs text-muted-foreground">{t('lounge.profilePage.previewDescription')}</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-4 rounded-[24px] border border-border/70 bg-white p-5">
                  {hasValidImage ? (
                    <img
                      src={image}
                      alt={t('lounge.profilePage.profileAlt')}
                      className="h-20 w-20 rounded-3xl object-cover shadow-sm"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <div
                      data-testid="profile-image-fallback"
                      className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#EAF1FF] text-[#1E63FF] ring-1 ring-[#1E63FF]/20"
                    >
                      <Camera className="h-8 w-8" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-foreground">{previewName}</p>
                    <p className="mt-1 text-sm font-medium text-[#1E63FF]">{previewHeadline}</p>
                    {isUsingDefaultAvatar ? (
                      <p className="mt-2 text-xs text-muted-foreground">{t('lounge.profilePage.usingGoogleImage')}</p>
                    ) : null}
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">{previewBio}</p>
              </article>

              {/* Tone guide */}
              <article className="flex flex-col rounded-[28px] border border-border/70 bg-[#F8FAFC] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t('lounge.profilePage.toneGuide')}</p>
                    <p className="text-xs text-muted-foreground">{t('lounge.profilePage.toneGuideDescription')}</p>
                  </div>
                </div>
                <ul className="mt-5 flex-1 space-y-3 text-sm leading-6 text-muted-foreground">
                  <li>• {t('lounge.profilePage.toneItems.name')}</li>
                  <li>• {t('lounge.profilePage.toneItems.headline')}</li>
                  <li>• {t('lounge.profilePage.toneItems.bio')}</li>
                  <li>• {t('lounge.profilePage.toneItems.image')}</li>
                </ul>
              </article>
            </div>

            {/* Quick links */}
            <aside
              className="rounded-[28px] border border-border/70 bg-[#F8FAFC] p-5"
              aria-label={t('lounge.profilePage.quickLinksAria')}
            >
              <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF1FF] text-[#1E63FF]">
                  <Link2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t('lounge.profilePage.quickLinks')}</p>
                  <p className="text-xs text-muted-foreground">{t('lounge.profilePage.quickLinksDescription')}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <Link
                  to="/lounge"
                  className="group rounded-2xl border border-border/70 bg-white px-4 py-4 transition hover:border-[#1E63FF]/30"
                  aria-label={t('lounge.profilePage.loungeHome')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{t('lounge.profilePage.loungeHome')}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('lounge.profilePage.loungeHomeDescription')}
                      </p>
                    </div>
                    <LayoutPanelTop className="h-5 w-5 shrink-0 text-[#1E63FF] transition group-hover:translate-x-0.5" />
                  </div>
                </Link>
                <Link
                  to="/lounge/aliases"
                  className="group rounded-2xl border border-border/70 bg-white px-4 py-4 transition hover:border-[#1E63FF]/30"
                  aria-label={t('lounge.profilePage.aliasManagement')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{t('lounge.profilePage.aliasManagement')}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{t('lounge.profilePage.aliasManagementDescription')}</p>
                    </div>
                    <Link2 className="h-5 w-5 shrink-0 text-[#1E63FF] transition group-hover:translate-x-0.5" />
                  </div>
                </Link>
              </div>

              <div className="mt-5 rounded-2xl border border-[#1E63FF]/20 bg-[#EAF1FF] px-4 py-4 text-[#174fd1]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1E63FF]">{t('lounge.profilePage.currentStatus')}</p>
                <p className="mt-2 text-sm leading-7 text-[#174fd1]">
                  {t('lounge.profilePage.currentStatusDescription')}
                </p>
              </div>
            </aside>
          </div>
        </section>

        {/* Bottom: Form */}
        <section
          className="rounded-[32px] border border-border/70 bg-white p-6 shadow-[0_24px_80px_-60px_rgba(15,23,42,0.45)] sm:p-8"
          aria-label={t('lounge.profilePage.formAria')}
        >
          <div className="flex flex-col gap-2 border-b border-border/70 pb-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1E63FF]">{t('lounge.profilePage.editFields')}</p>
              {isDirty && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
                  </span>
                  {t('lounge.profilePage.unsavedChanges')}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{t('lounge.profilePage.refineTitle')}</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              {t('lounge.profilePage.refineDescription')}
            </p>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-5">
              {/* Display name */}
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-foreground">{t('lounge.onboardingPage.displayNameRequired').replace(' *', '')}</span>
                <span className="text-xs text-muted-foreground">{t('lounge.profilePage.displayNameDescription')}</span>
                <input
                  className="rounded-2xl border border-border/70 bg-[#F8FAFC] px-4 py-3 text-sm text-foreground outline-none transition focus:border-[#1E63FF]/40 focus:ring-4 focus:ring-[#1E63FF]/10"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder={t('lounge.profilePage.namePlaceholder')}
                />
              </label>

              {/* Public alias */}
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-foreground">{t('lounge.profilePage.publicAlias')}</span>
                <span className="text-xs text-muted-foreground">
                  {t('lounge.profilePage.publicAliasDescription')}
                </span>
                <div className="flex rounded-2xl border border-border/70 bg-[#F8FAFC] text-sm text-foreground transition focus-within:border-[#1E63FF]/40 focus-within:ring-4 focus-within:ring-[#1E63FF]/10">
                  <span className="flex items-center border-r border-border/70 px-4 text-muted-foreground">/room/</span>
                  <input
                    aria-label={t('lounge.profilePage.publicAliasAria')}
                    className="min-w-0 flex-1 bg-transparent px-4 py-3 outline-none"
                    value={publicAlias}
                    onChange={(event) => setPublicAlias(event.target.value)}
                    placeholder={t('lounge.profilePage.aliasPlaceholder')}
                  />
                </div>
                <div className="grid gap-2 rounded-2xl border border-border/70 bg-[#F8FAFC] px-4 py-3 text-xs text-muted-foreground sm:grid-cols-2">
                  <div>
                    <p className="font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t('lounge.profilePage.publicLink')}</p>
                    <p className="mt-1 font-mono text-[#1E63FF]">{publicPathPreview}</p>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t('lounge.profilePage.internalUniqueNumber')}</p>
                    <p className="mt-1 font-mono text-foreground">{internalUniqueNumber}</p>
                  </div>
                </div>
              </label>

              {/* Headline */}
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-foreground">{t('profile.headline')}</span>
                <span className="text-xs text-muted-foreground">{t('lounge.profilePage.headlineDescription')}</span>
                <input
                  className="rounded-2xl border border-border/70 bg-[#F8FAFC] px-4 py-3 text-sm text-foreground outline-none transition focus:border-[#1E63FF]/40 focus:ring-4 focus:ring-[#1E63FF]/10"
                  value={headline}
                  maxLength={HEADLINE_MAX}
                  onChange={(event) => setHeadline(event.target.value)}
                  placeholder={t('lounge.profilePage.headlinePlaceholder')}
                />
                <p className="text-right text-[11px] text-muted-foreground">
                  {headline.length} / {HEADLINE_MAX}
                </p>
              </label>

              {/* Bio */}
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-foreground">{t('profile.bio')}</span>
                <span className="text-xs text-muted-foreground">
                  {t('lounge.profilePage.bioDescription')}
                </span>
                <textarea
                  className="min-h-[140px] resize-y rounded-3xl border border-border/70 bg-[#F8FAFC] px-4 py-4 text-sm leading-7 text-foreground outline-none transition focus:border-[#1E63FF]/40 focus:ring-4 focus:ring-[#1E63FF]/10"
                  value={bio}
                  maxLength={BIO_MAX}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder={t('lounge.profilePage.bioPlaceholder')}
                />
                <p className="text-right text-[11px] text-muted-foreground">
                  {bio.length} / {BIO_MAX}
                </p>
              </label>

              {/* Default session type */}
              <label className="grid gap-3">
                <div>
                  <span className="text-sm font-semibold text-foreground" id="default-session-type-label">{t('lounge.profilePage.defaultSessionType')}</span>
                  <p className="mt-1 text-xs text-muted-foreground">{t('lounge.profilePage.roomPresetDescription')}</p>
                </div>
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-white">
                  <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_210px] sm:items-center">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t('lounge.profilePage.currentPreset')}</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{t(`lounge.roomTypes.${roomType}.title`)}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{t(`lounge.roomTypes.${roomType}.summary`)}</p>
                    </div>
                    <div className="relative">
                      <select
                        aria-labelledby="default-session-type-label"
                        className="w-full appearance-none rounded-xl border border-border/70 bg-[#F8FAFC] px-3 py-3 pr-9 text-sm font-medium text-foreground outline-none transition hover:border-[#1E63FF]/30 hover:bg-white focus:border-[#1E63FF]/50 focus:ring-4 focus:ring-[#1E63FF]/10"
                        value={roomType}
                        onChange={(event) => {
                          if (isValidRoomType(event.target.value)) {
                            setRoomType(event.target.value);
                          }
                        }}
                      >
                        <option value="audio-one-to-one">{t('lounge.roomTypes.audio-one-to-one.title')}</option>
                        <option value="video-one-to-one">{t('lounge.roomTypes.video-one-to-one.title')}</option>
                        <option value="audio-group">{t('lounge.roomTypes.audio-group.title')}</option>
                        <option value="video-group">{t('lounge.roomTypes.video-group.title')}</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="grid gap-2 border-t border-border/70 bg-[#F8FAFC] px-4 py-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                    <p className="text-xs font-medium text-[#1E63FF]">{t(`lounge.roomTypes.${roomType}.tone`)}</p>
                    <p className="text-xs leading-5 text-muted-foreground">{t(`lounge.roomTypes.${roomType}.cadence`)}</p>
                  </div>
                </div>
              </label>
            </div>

            {/* Profile image */}
            <div className="grid gap-4 rounded-[28px] border border-border/70 bg-[#F8FAFC] p-5">
              <div>
                <p className="text-sm font-semibold text-foreground">{t('lounge.profilePage.profileImage')}</p>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">{t('lounge.profilePage.imageRequirements')}</p>
              </div>

              <div className="flex flex-col items-center rounded-[28px] border border-dashed border-[#1E63FF]/25 bg-white px-5 py-6 text-center">
                {hasValidImage ? (
                  <img
                    src={image}
                  alt={t('lounge.profilePage.profileAlt')}
                    className="h-28 w-28 rounded-[28px] object-cover shadow-sm"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div
                    data-testid="profile-upload-fallback"
                    className="flex h-28 w-28 items-center justify-center rounded-[28px] bg-[#EAF1FF] text-[#1E63FF] ring-1 ring-[#1E63FF]/15"
                  >
                    <ImagePlus className="h-10 w-10" />
                  </div>
                )}
                <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#1E63FF] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#174fd1]">
                  <ImagePlus className="h-4 w-4" />
                  {t('lounge.profilePage.uploadImage')}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(event) => void handleImage(event.target.files?.[0])}
                  />
                </label>
                {hasValidImage && (
                  <button
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-border/70 px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                    onClick={() => void handleDeleteImage()}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('lounge.profilePage.removeImage')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="mt-6 flex flex-col gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-[1.25rem]">
              {message && (
                <p
                  className={`text-sm transition-opacity duration-300 ${
                    message.includes('Failed') || message.includes('failed') ? 'text-red-700' : 'text-emerald-700'
                  }`}
                >
                  {message}
                </p>
              )}
            </div>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1E63FF] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#174fd1] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void handleSave()}
              disabled={isSaving || !isDirty}
            >
              <Save className="h-4 w-4" />
              {isSaving ? t('common.saving') : t('lounge.profilePage.saveProfile')}
            </button>
          </div>
        </section>
      </div>
    </LoungeShell>
  );
};

export default LoungeProfile;
