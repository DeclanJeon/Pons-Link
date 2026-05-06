import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Link2, Settings2, UserRound } from 'lucide-react';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { getConfiguredPersonalLinkApiUrl, usePersonalLinkRepository } from '@/features/personal-link/usePersonalLinkRepository';
import { localRepository } from '@/features/personal-link/localRepository';
import type { AccountProfile, PublicProfile, UserProfile } from '@/features/personal-link/types';
import { validateSlug, normalizeSlug } from '@/features/personal-link/slug';

const STEPS = [
  { num: 1, label: 'Basic Info', icon: UserRound },
  { num: 2, label: 'Link Setup', icon: Link2 },
  { num: 3, label: 'Preferences', icon: Settings2 },
] as const;

const LoungeOnboarding = () => {
  const navigate = useNavigate();
  const apiUrl = getConfiguredPersonalLinkApiUrl();
  const repositorySelection = apiUrl ? { apiUrl } : undefined;
  const repository = usePersonalLinkRepository(repositorySelection);
  const { session } = useAuthSession();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [displayName, setDisplayName] = useState(session?.displayName ?? '');
  const [imagePreview, setImagePreview] = useState(session?.avatarUrl ?? '');
  const [slug, setSlug] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [roomType, setRoomType] = useState<'audio-one-to-one' | 'video-one-to-one'>('audio-one-to-one');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!session) return <div className="min-h-screen bg-[#F5F7FB] p-6 text-foreground">Login required.</div>;

  const handleImage = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only jpg, png, webp allowed.');
      return;
    }
    const imageUrl = await repository.saveAccountProfileImage(file);
    setImagePreview(imageUrl);
  };

  const goNext = () => {
    setError('');
    if (step === 1 && !displayName.trim()) {
      setError('Name is required.');
      return;
    }
    if (step === 2) {
      const slugErr = validateSlug(slug);
      if (slugErr) {
        setError(slugErr);
        return;
      }
    }
    setStep((s) => (s + 1) as 2 | 3);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');

    const buildAndSave = async (repo: typeof repository) => {
      const accountProfile: AccountProfile = {
        userId: session.userId,
        displayName,
        statusMessage: 'Available',
        profileImageUrl: imagePreview || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const userProfile: UserProfile = {
        userId: session.userId,
        providerSubject: session.providerSubject,
        primaryEmail: session.email,
        emailVerified: true,
        displayName,
        avatarUrl: imagePreview || session.avatarUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const publicProfile: PublicProfile = {
        userId: session.userId,
        slug: normalizeSlug(slug),
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
      await repo.saveUserProfile(userProfile);
      await repo.saveAccountProfile(accountProfile);
      await repo.savePublicProfile(publicProfile);
    };

    const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
      Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
      ]);

    try {
      await withTimeout(buildAndSave(repository), 5000);
      navigate('/lounge');
    } catch {
      try {
        await buildAndSave(localRepository);
        navigate('/lounge');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save profile.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F7FB] text-foreground">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#1E63FF]/40 to-transparent" />
      <div className="flex items-center justify-between px-6 py-4">
        <button
          onClick={() => navigate('/lounge')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to lounge
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          {/* Logo */}
          <div className="mb-8 flex items-center justify-center">
            <div className="flex items-center gap-3">
              <img src="/icon.svg" alt="" className="h-9 w-9" loading="eager" />
              <span className="text-xl font-semibold tracking-tight">PonsLink</span>
            </div>
          </div>

          {/* Step indicators */}
          <div className="mb-8 flex items-center justify-center">
            {STEPS.map(({ num, label, icon: Icon }) => (
              <div key={num} className="flex items-center">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition ${
                      step > num
                        ? 'bg-[#1E63FF] text-white'
                        : step === num
                          ? 'border border-[#1E63FF]/30 bg-[#EAF1FF] text-[#1E63FF]'
                          : 'border border-border/70 text-muted-foreground'
                    }`}
                  >
                    {step > num ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </div>
                  <span
                    className={`hidden text-xs sm:block ${step === num ? 'text-foreground' : 'text-muted-foreground'}`}
                  >
                    {label}
                  </span>
                </div>
                {num < 3 && (
                  <div
                    className={`mx-2 h-px w-8 ${step > num ? 'bg-[#1E63FF]/45' : 'bg-border'}`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Card */}
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-white shadow-[0_24px_80px_-60px_rgba(15,23,42,0.45)]">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#1E63FF]/35 to-transparent" />
            <div className="p-8">
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold">Basic Info</h2>
                    <p className="mt-1 text-sm text-muted-foreground">How should others know you?</p>
                  </div>
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="profile"
                      className="h-20 w-20 rounded-full object-cover ring-2 ring-[#1E63FF]/30"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#EAF1FF] text-[#1E63FF] ring-1 ring-[#1E63FF]/20">
                      <UserRound className="h-8 w-8" />
                    </div>
                  )}
                  <label className="block space-y-2 text-sm">
                    <span className="text-muted-foreground">Profile photo</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="w-full rounded-xl border border-border/70 bg-[#F8FAFC] px-4 py-2.5 text-sm text-muted-foreground file:mr-3 file:rounded-full file:border-0 file:bg-[#1E63FF] file:px-3 file:py-1 file:text-xs file:font-medium file:text-white"
                      onChange={(e) => void handleImage(e.target.files?.[0])}
                    />
                  </label>
                  <label className="block space-y-2 text-sm">
                    <span className="text-muted-foreground">Display name *</span>
                    <input
                      className="w-full rounded-xl border border-border/70 bg-[#F8FAFC] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-[#1E63FF]/40 focus:ring-4 focus:ring-[#1E63FF]/10"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                    />
                  </label>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold">Link Setup</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Create your personal link.</p>
                  </div>
                  <label className="block space-y-2 text-sm">
                    <span className="text-muted-foreground">Personal link slug *</span>
                    <div className="flex items-center overflow-hidden rounded-xl border border-border/70 bg-[#F8FAFC] focus-within:border-[#1E63FF]/40 focus-within:ring-4 focus-within:ring-[#1E63FF]/10">
                      <span className="shrink-0 pl-4 text-sm text-muted-foreground">ponslink.com/room/</span>
                      <input
                        className="flex-1 bg-transparent px-2 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="yourname"
                      />
                    </div>
                  </label>
                  <label className="block space-y-2 text-sm">
                    <span className="text-muted-foreground">Headline</span>
                    <input
                      className="w-full rounded-xl border border-border/70 bg-[#F8FAFC] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-[#1E63FF]/40 focus:ring-4 focus:ring-[#1E63FF]/10"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder="One-line intro"
                    />
                  </label>
                  <label className="block space-y-2 text-sm">
                    <span className="text-muted-foreground">Bio</span>
                    <textarea
                      className="min-h-24 w-full rounded-xl border border-border/70 bg-[#F8FAFC] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-[#1E63FF]/40 focus:ring-4 focus:ring-[#1E63FF]/10"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell visitors about yourself..."
                    />
                  </label>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold">Preferences</h2>
                    <p className="mt-1 text-sm text-muted-foreground">How do you want to connect?</p>
                  </div>
                  <label className="block space-y-2 text-sm">
                    <span className="text-muted-foreground">Default session type</span>
                    <select
                      className="w-full rounded-xl border border-border/70 bg-[#F8FAFC] px-4 py-3 text-sm text-foreground outline-none transition focus:border-[#1E63FF]/40 focus:ring-4 focus:ring-[#1E63FF]/10"
                      value={roomType}
                      onChange={(e) =>
                        setRoomType(e.target.value as 'audio-one-to-one' | 'video-one-to-one')
                      }
                    >
                      <option value="audio-one-to-one">1:1 Audio</option>
                      <option value="video-one-to-one">1:1 Video</option>
                    </select>
                  </label>
                  <div className="rounded-xl border border-[#1E63FF]/20 bg-[#EAF1FF] p-4 text-sm text-[#174fd1]">
                    Your link will be live at{' '}
                    <strong>ponslink.com/room/{slug || 'yourname'}</strong>. You can update these
                    settings later in your lounge profile.
                  </div>
                </div>
              )}

              {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

              <div className="mt-6 flex gap-3">
                {step > 1 && (
                  <button
                    className="flex cursor-pointer items-center gap-2 rounded-full border border-border/70 px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-[#1E63FF]"
                    onClick={() => setStep((s) => (s - 1) as 1 | 2)}
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                )}
                {step < 3 ? (
                  <button
                    className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#1E63FF] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#174fd1]"
                    onClick={goNext}
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#1E63FF] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#174fd1] disabled:opacity-50"
                    disabled={submitting}
                    onClick={() => void handleSubmit()}
                  >
                    {submitting ? 'Setting up...' : 'Launch your lounge →'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoungeOnboarding;
