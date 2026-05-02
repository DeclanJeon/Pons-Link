import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
const ROOM_TYPE_HINTS: Record<
  PersonalLinkRoomType,
  {
    title: string;
    tone: string;
    summary: string;
    cadence: string;
  }
> = {
  'audio-one-to-one': {
    title: '1:1 Audio',
    tone: 'Quiet depth',
    summary: 'Focus calls and lowers barrier-to-entry for quick scheduling.',
    cadence: 'Best for high-signal coaching and strategic sessions.',
  },
  'video-one-to-one': {
    title: '1:1 Video',
    tone: 'Present and visual',
    summary: 'Show products, whiteboards, and gestures in real time.',
    cadence: 'Use when visual context changes outcomes.',
  },
  'audio-group': {
    title: 'N:N Audio',
    tone: 'Open roundtable',
    summary: 'Keep every voice clear while reducing visual fatigue.',
    cadence: 'Great for mentoring circles and panel check-ins.',
  },
  'video-group': {
    title: 'N:N Video',
    tone: 'Studio mode',
    summary: 'Best when shared screens, expressions, and status signals matter.',
    cadence: 'Useful for workshops, demos, and team planning.',
  },
};

const LoungeProfile = () => {
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
      showMessage('Images must be 5MB or smaller.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showMessage('Only jpg, png, and webp images are supported.');
      return;
    }
    try {
      const imageUrl = await repository.saveAccountProfileImage(file);
      setImage(imageUrl);
      setImgError(false);
      showMessage('Profile image uploaded.');
    } catch {
      showMessage('Image upload failed. Please try again.');
    }
  };

  const handleDeleteImage = async () => {
    try {
      await repository.removeAccountProfileImage();
      const fallback = session.avatarUrl ?? '';
      setImage(fallback);
      setImgError(false);
      showMessage(
        session.avatarUrl ? 'Removed custom image. Google profile image is now shown.' : 'Profile image removed.',
      );
    } catch {
      showMessage('Failed to remove image. Please try again.');
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
      showMessage('Profile saved.');
    } catch {
      showMessage('Could not publish this alias to the backend. Visitors cannot send requests until it is saved online.');
    } finally {
      setIsSaving(false);
    }
  };

  const previewName = displayName.trim() || session.displayName || 'Add a display name';
  const previewHeadline = headline.trim() || 'Write the one-line introduction visitors should see first.';
  const previewBio = bio.trim() || 'Use this space to explain what kinds of requests you accept, what people can expect, and how you like to respond.';
  const normalizedPublicAlias = publicAlias.trim().replace(/^@+/, '').toLowerCase();
  const publicPathPreview = normalizedPublicAlias ? `/room/${normalizedPublicAlias}` : 'Set an alias to activate your room link';
  const internalUniqueNumber = session.uniqueNumber ?? 'Issued after backend login';

  const completionItems = [displayName.trim(), headline.trim(), bio.trim(), image.trim() && !imgError].filter(Boolean).length;

  return (
    <LoungeShell contentClassName="max-w-6xl">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {/* Top: Overview */}
        <section
          data-testid="lounge-profile-shell"
          data-tone="lounge-noir"
          className="overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#0D0D0D] shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
          aria-label="Profile overview"
        >
          {/* Header */}
          <div className="border-b border-white/[0.06] bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] px-6 py-6 sm:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  Lounge identity
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Lounge profile
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-400 sm:text-base">
                  Shape the name, intro, image, and public tone visitors see first. This page should feel like a profile
                  studio inside the lounge, not a generic settings form.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[320px]">
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Profile score</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{completionItems}/4</p>
                  <p className="mt-1 text-xs text-zinc-500">Core profile fields completed</p>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Visibility</p>
                  <p className="mt-2 text-base font-semibold text-white">Public-ready</p>
                  <p className="mt-1 text-xs text-zinc-500">Aligned to your personal link page</p>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Response mode</p>
                  <p className="mt-2 text-base font-semibold text-white">Approve first</p>
                  <p className="mt-1 text-xs text-zinc-500">Requests are reviewed before booking</p>
                </div>
              </div>
            </div>
          </div>

          {/* Cards grid */}
          <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_320px]">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Profile preview */}
              <article className="flex flex-col rounded-[28px] border border-white/[0.08] bg-[#111111] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.24)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-300">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Profile preview</p>
                    <p className="text-xs text-zinc-500">This is how the public-facing identity currently reads.</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-4 rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-5">
                  {hasValidImage ? (
                    <img
                      src={image}
                      alt="profile"
                      className="h-20 w-20 rounded-3xl object-cover shadow-sm"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <div
                      data-testid="profile-image-fallback"
                      className="flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-500/10 text-indigo-300 ring-1 ring-white/[0.08]"
                    >
                      <Camera className="h-8 w-8" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-white">{previewName}</p>
                    <p className="mt-1 text-sm font-medium text-indigo-200">{previewHeadline}</p>
                    {isUsingDefaultAvatar ? (
                      <p className="mt-2 text-xs text-zinc-500">Using your Google profile image as the default avatar.</p>
                    ) : null}
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-zinc-400">{previewBio}</p>
              </article>

              {/* Tone guide */}
              <article className="flex flex-col rounded-[28px] border border-white/[0.08] bg-[#111111] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.24)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Tone guide</p>
                    <p className="text-xs text-zinc-500">What makes a public profile feel trustworthy fast</p>
                  </div>
                </div>
                <ul className="mt-5 flex-1 space-y-3 text-sm leading-6 text-zinc-400">
                  <li>• Match the display name to the name you actually use in sessions</li>
                  <li>• Make the headline filter the right requests before they reach you</li>
                  <li>• Explain what you help with, not just who you are</li>
                  <li>• Keep the image aligned with the same trust level as your public link</li>
                </ul>
              </article>
            </div>

            {/* Quick links */}
            <aside
              className="rounded-[28px] border border-white/[0.08] bg-[#111111] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.24)]"
              aria-label="Profile quick links"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-300">
                  <Link2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Quick links</p>
                  <p className="text-xs text-zinc-500">Move between the profile studio and the rest of the lounge</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <Link
                  to="/lounge"
                  className="group rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-4 transition hover:border-indigo-500/30 hover:bg-white/[0.05]"
                  aria-label="Lounge home"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">Lounge home</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Return to the request, reservation, and dashboard flow
                      </p>
                    </div>
                    <LayoutPanelTop className="h-5 w-5 shrink-0 text-indigo-300 transition group-hover:translate-x-0.5" />
                  </div>
                </Link>
                <Link
                  to="/lounge/aliases"
                  className="group rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-4 transition hover:border-indigo-500/30 hover:bg-white/[0.05]"
                  aria-label="Alias management"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">Alias management</p>
                      <p className="mt-1 text-xs text-zinc-500">Review the slug and visibility rules tied to your public link</p>
                    </div>
                    <Link2 className="h-5 w-5 shrink-0 text-indigo-300 transition group-hover:translate-x-0.5" />
                  </div>
                </Link>
              </div>

              <div className="mt-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-4 text-white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-200">Current status</p>
                <p className="mt-2 text-sm leading-7 text-zinc-300">
                  The Google account image acts as the default profile image until you upload a custom one. If you
                  remove a custom image, the page falls back to the Google avatar again instead of leaving the preview
                  blank.
                </p>
              </div>
            </aside>
          </div>
        </section>

        {/* Bottom: Form */}
        <section
          className="rounded-[32px] border border-white/[0.08] bg-[#0D0D0D] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.24)] sm:p-8"
          aria-label="Profile form"
        >
          <div className="flex flex-col gap-2 border-b border-white/[0.06] pb-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-300">Edit fields</p>
              {isDirty && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-300">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
                  </span>
                  Unsaved changes
                </span>
              )}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">Refine the public profile details</h2>
            <p className="text-sm leading-7 text-zinc-400">
              Keep the fields focused and explain what each one does for the public-facing profile. The page should help
              you write for visitors, not just fill in settings.
            </p>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-5">
              {/* Display name */}
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-white">Display name</span>
                <span className="text-xs text-zinc-500">The name visitors see and the name used inside the session</span>
                <input
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500/40 focus:bg-white/[0.05] focus:ring-4 focus:ring-indigo-500/10"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Name"
                />
              </label>

              {/* Public alias */}
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-white">Public lounge alias</span>
                <span className="text-xs text-zinc-500">
                  This is the public value people use to request a meeting. Your backend-issued unique number stays internal.
                </span>
                <div className="flex rounded-2xl border border-white/[0.08] bg-white/[0.03] text-sm text-white transition focus-within:border-indigo-500/40 focus-within:bg-white/[0.05] focus-within:ring-4 focus-within:ring-indigo-500/10">
                  <span className="flex items-center border-r border-white/[0.08] px-4 text-zinc-500">/room/</span>
                  <input
                    aria-label="Public lounge alias"
                    className="min-w-0 flex-1 bg-transparent px-4 py-3 outline-none"
                    value={publicAlias}
                    onChange={(event) => setPublicAlias(event.target.value)}
                    placeholder="your-alias"
                  />
                </div>
                <div className="grid gap-2 rounded-2xl border border-white/[0.08] bg-[#111111] px-4 py-3 text-xs text-zinc-400 sm:grid-cols-2">
                  <div>
                    <p className="font-semibold uppercase tracking-[0.16em] text-zinc-500">Public link</p>
                    <p className="mt-1 font-mono text-indigo-200">{publicPathPreview}</p>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-[0.16em] text-zinc-500">Internal unique number</p>
                    <p className="mt-1 font-mono text-zinc-200">{internalUniqueNumber}</p>
                  </div>
                </div>
              </label>

              {/* Headline */}
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-white">Headline</span>
                <span className="text-xs text-zinc-500">A one-line promise that helps the right people self-select</span>
                <input
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500/40 focus:bg-white/[0.05] focus:ring-4 focus:ring-indigo-500/10"
                  value={headline}
                  maxLength={HEADLINE_MAX}
                  onChange={(event) => setHeadline(event.target.value)}
                  placeholder="One-line introduction"
                />
                <p className="text-right text-[11px] text-zinc-500">
                  {headline.length} / {HEADLINE_MAX}
                </p>
              </label>

              {/* Bio */}
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-white">Bio</span>
                <span className="text-xs text-zinc-500">
                  Explain what you help with, the context you care about, and how you usually respond
                </span>
                <textarea
                  className="min-h-[140px] resize-y rounded-3xl border border-white/[0.08] bg-white/[0.03] px-4 py-4 text-sm leading-7 text-white outline-none transition focus:border-indigo-500/40 focus:bg-white/[0.05] focus:ring-4 focus:ring-indigo-500/10"
                  value={bio}
                  maxLength={BIO_MAX}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="Profile bio"
                />
                <p className="text-right text-[11px] text-zinc-500">
                  {bio.length} / {BIO_MAX}
                </p>
              </label>

              {/* Default session type */}
              <label className="grid gap-3">
                <div>
                  <span className="text-sm font-semibold text-white" id="default-session-type-label">Default session type</span>
                  <p className="mt-1 text-xs text-zinc-500">The room preset every new booking opens with</p>
                </div>
                <div className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#101010]">
                  <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_210px] sm:items-center">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Current preset</p>
                      <p className="mt-1 text-sm font-semibold text-white">{ROOM_TYPE_HINTS[roomType].title}</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-400">{ROOM_TYPE_HINTS[roomType].summary}</p>
                    </div>
                    <div className="relative">
                      <select
                        aria-labelledby="default-session-type-label"
                        className="w-full appearance-none rounded-xl border border-emerald-300/25 bg-[#181A17] px-3 py-3 pr-9 text-sm font-medium text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.18)] outline-none [color-scheme:dark] transition hover:border-emerald-200/35 hover:bg-[#1D211C] focus:border-emerald-200/70 focus:bg-[#1D211C] focus:ring-4 focus:ring-emerald-300/12"
                        value={roomType}
                        onChange={(event) => {
                          if (isValidRoomType(event.target.value)) {
                            setRoomType(event.target.value);
                          }
                        }}
                      >
                        <option className="bg-[#181A17] text-emerald-50" value="audio-one-to-one">1:1 Audio</option>
                        <option className="bg-[#181A17] text-emerald-50" value="video-one-to-one">1:1 Video</option>
                        <option className="bg-[#181A17] text-emerald-50" value="audio-group">N:N Audio</option>
                        <option className="bg-[#181A17] text-emerald-50" value="video-group">N:N Video</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-200/80" />
                    </div>
                  </div>
                  <div className="grid gap-2 border-t border-white/[0.08] bg-white/[0.025] px-4 py-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                    <p className="text-xs font-medium text-indigo-200">{ROOM_TYPE_HINTS[roomType].tone}</p>
                    <p className="text-xs leading-5 text-zinc-500">{ROOM_TYPE_HINTS[roomType].cadence}</p>
                  </div>
                </div>
              </label>
            </div>

            {/* Profile image */}
            <div className="grid gap-4 rounded-[28px] border border-white/[0.08] bg-[#111111] p-5">
              <div>
                <p className="text-sm font-semibold text-white">Profile image</p>
                <p className="mt-1 text-xs leading-6 text-zinc-500">jpg, png, webp / max 5MB</p>
              </div>

              <div className="flex flex-col items-center rounded-[28px] border border-dashed border-white/[0.12] bg-white/[0.03] px-5 py-6 text-center">
                {hasValidImage ? (
                  <img
                    src={image}
                    alt="profile"
                    className="h-28 w-28 rounded-[28px] object-cover shadow-sm"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div
                    data-testid="profile-upload-fallback"
                    className="flex h-28 w-28 items-center justify-center rounded-[28px] bg-indigo-500/10 text-indigo-300 ring-1 ring-white/[0.08]"
                  >
                    <ImagePlus className="h-10 w-10" />
                  </div>
                )}
                <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-100">
                  <ImagePlus className="h-4 w-4" />
                  Upload image
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(event) => void handleImage(event.target.files?.[0])}
                  />
                </label>
                {hasValidImage && (
                  <button
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/[0.12] px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-white/[0.2] hover:bg-white/[0.05]"
                    onClick={() => void handleDeleteImage()}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove image
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="mt-6 flex flex-col gap-3 border-t border-white/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-[1.25rem]">
              {message && (
                <p
                  className={`text-sm transition-opacity duration-300 ${
                    message.includes('Failed') || message.includes('failed') ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {message}
                </p>
              )}
            </div>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void handleSave()}
              disabled={isSaving || !isDirty}
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </section>
      </div>
    </LoungeShell>
  );
};

export default LoungeProfile;
