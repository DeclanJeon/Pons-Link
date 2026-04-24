import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  ImagePlus,
  LayoutPanelTop,
  Link2,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { getConfiguredPersonalLinkApiUrl, usePersonalLinkRepository } from '@/features/personal-link/usePersonalLinkRepository';
import { localRepository } from '@/features/personal-link/localRepository';
import type { AccountProfile, PublicProfile } from '@/features/personal-link/types';

const HEADLINE_MAX = 100;
const BIO_MAX = 500;

const LoungeProfile = () => {
  const { session } = useAuthSession();
  const apiUrl = getConfiguredPersonalLinkApiUrl();
  const repositorySelection = apiUrl ? { apiUrl } : undefined;
  const repository = usePersonalLinkRepository(repositorySelection);
  const [displayName, setDisplayName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [image, setImage] = useState('');
  const [roomType, setRoomType] = useState<'audio-one-to-one' | 'video-one-to-one'>('audio-one-to-one');
  const [message, setMessage] = useState('');
  const [imgError, setImgError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [initialValues, setInitialValues] = useState({ displayName: '', headline: '', bio: '', image: '', roomType: 'audio-one-to-one' as 'audio-one-to-one' | 'video-one-to-one' });
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDirty = useMemo(() => {
    return (
      displayName !== initialValues.displayName ||
      headline !== initialValues.headline ||
      bio !== initialValues.bio ||
      image !== initialValues.image ||
      roomType !== initialValues.roomType
    );
  }, [displayName, headline, bio, image, roomType, initialValues]);

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
        const rt = data.publicProfile?.defaultRoomType ?? 'audio-one-to-one';
        setDisplayName(dn);
        setHeadline(hl);
        setBio(b);
        setImage(img);
        setRoomType(rt as 'audio-one-to-one' | 'video-one-to-one');
        setImgError(false);
        setInitialValues({ displayName: dn, headline: hl, bio: b, image: img, roomType: rt as 'audio-one-to-one' | 'video-one-to-one' });
      })
      .catch(() => {
        // Fallback to localRepository data if remote fails
        void localRepository.getAuthBootstrapProfile(session.email).then((localData) => {
          const dn = localData.accountProfile?.displayName ?? session.displayName ?? '';
          const hl = localData.publicProfile?.headline ?? '';
          const b = localData.publicProfile?.bio ?? '';
          const img = localData.accountProfile?.profileImageUrl ?? session.avatarUrl ?? '';
          const rt = localData.publicProfile?.defaultRoomType ?? 'audio-one-to-one';
          setDisplayName(dn);
          setHeadline(hl);
          setBio(b);
          setImage(img);
          setRoomType(rt as 'audio-one-to-one' | 'video-one-to-one');
          setImgError(false);
          setInitialValues({ displayName: dn, headline: hl, bio: b, image: img, roomType: rt as 'audio-one-to-one' | 'video-one-to-one' });
        }).catch(() => {
          const dn = session.displayName || '';
          setDisplayName(dn);
          setHeadline('');
          setBio('');
          setImage(session.avatarUrl ?? '');
          setRoomType('audio-one-to-one');
          setImgError(false);
          setInitialValues({ displayName: dn, headline: '', bio: '', image: session.avatarUrl ?? '', roomType: 'audio-one-to-one' });
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
      const accountProfile: AccountProfile = {
        userId: session.userId,
        displayName,
        statusMessage: 'Available for conversations',
        profileImageUrl: customProfileImageUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const existing = await repo.getAuthBootstrapProfile(session.email);
      const publicProfile: PublicProfile = existing.publicProfile
        ? {
            ...existing.publicProfile,
            headline,
            bio,
            defaultRoomType: roomType,
            updatedAt: new Date().toISOString(),
          }
        : {
            userId: session.userId,
            slug: `user-${session.userId}`,
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
      setInitialValues({ displayName, headline, bio, image, roomType });
      showMessage('Profile saved.');
    } catch {
      try {
        await buildProfiles(localRepository);
        setInitialValues({ displayName, headline, bio, image, roomType });
        showMessage('Profile saved.');
      } catch {
        showMessage('Failed to save profile. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const previewName = displayName.trim() || session.displayName || 'Add a display name';
  const previewHeadline = headline.trim() || 'Write the one-line introduction visitors should see first.';
  const previewBio = bio.trim() || 'Use this space to explain what kinds of requests you accept, what people can expect, and how you like to respond.';

  const completionItems = useMemo(
    () => [displayName.trim(), headline.trim(), bio.trim(), image.trim() && !imgError].filter(Boolean).length,
    [bio, displayName, headline, image, imgError],
  );

  return (
    <div
      data-testid="lounge-profile-shell"
      data-tone="lounge-noir"
      className="min-h-screen bg-[#080808] px-4 py-6 text-white sm:px-6 lg:px-8"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {/* Nav */}
        <div className="flex items-center justify-between gap-4 rounded-full border border-white/[0.08] bg-[#111111] px-4 py-3 shadow-[0_16px_40px_-30px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="PonsLink" className="h-8 w-auto" loading="eager" />
            <p className="hidden text-xs text-zinc-500 sm:block">Profile studio</p>
          </div>
          <Link to="/lounge" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Lounge
          </Link>
        </div>

        {/* Top: Overview */}
        <section
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
                <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
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
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">Refine the public profile details</h2>
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
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-white">Default session type</span>
                <span className="text-xs text-zinc-500">The default room type for new bookings</span>
                <select
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500/40 focus:bg-white/[0.05] focus:ring-4 focus:ring-indigo-500/10"
                  value={roomType}
                  onChange={(event) => setRoomType(event.target.value as 'audio-one-to-one' | 'video-one-to-one')}
                >
                  <option value="audio-one-to-one">1:1 Audio</option>
                  <option value="video-one-to-one">1:1 Video</option>
                </select>
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
    </div>
  );
};

export default LoungeProfile;
