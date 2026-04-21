import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Link2, Settings2, UserRound } from 'lucide-react';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { usePersonalLinkRepository } from '@/features/personal-link/usePersonalLinkRepository';
import type { AccountProfile, PublicProfile, UserProfile } from '@/features/personal-link/types';
import { validateSlug, normalizeSlug } from '@/features/personal-link/slug';

const STEPS = [
  { num: 1, label: 'Basic Info', icon: UserRound },
  { num: 2, label: 'Link Setup', icon: Link2 },
  { num: 3, label: 'Preferences', icon: Settings2 },
] as const;

const LoungeOnboarding = () => {
  const navigate = useNavigate();
  const repository = usePersonalLinkRepository();
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

  if (!session) return <div className="p-6 text-white">Login required.</div>;

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
    try {
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
      await repository.saveUserProfile(userProfile);
      await repository.saveAccountProfile(accountProfile);
      await repository.savePublicProfile(publicProfile);
      navigate('/lounge');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-[#080808] text-white"
      style={{
        backgroundImage: 'radial-gradient(ellipse 70% 50% at 50% -5%, rgba(99,102,241,0.12), transparent)',
      }}
    >
      <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          {/* Logo */}
          <div className="mb-8 flex items-center justify-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_0_16px_rgba(99,102,241,0.4)]">
              <span className="text-sm font-bold text-white">P</span>
            </div>
            <span className="font-semibold tracking-tight">PonsLink</span>
          </div>

          {/* Step indicators */}
          <div className="mb-8 flex items-center justify-center">
            {STEPS.map(({ num, label, icon: Icon }) => (
              <div key={num} className="flex items-center">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition ${
                      step > num
                        ? 'bg-indigo-600 text-white'
                        : step === num
                          ? 'border border-indigo-500 bg-indigo-500/10 text-indigo-400'
                          : 'border border-white/[0.08] text-zinc-600'
                    }`}
                  >
                    {step > num ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </div>
                  <span
                    className={`hidden text-xs sm:block ${step === num ? 'text-white' : 'text-zinc-600'}`}
                  >
                    {label}
                  </span>
                </div>
                {num < 3 && (
                  <div
                    className={`mx-2 h-px w-8 ${step > num ? 'bg-indigo-500/50' : 'bg-white/[0.06]'}`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Card */}
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0D0D0D]">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
            <div className="p-8">
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold">Basic Info</h2>
                    <p className="mt-1 text-sm text-zinc-500">How should others know you?</p>
                  </div>
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="profile"
                      className="h-20 w-20 rounded-full object-cover ring-2 ring-indigo-500/30"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20">
                      <UserRound className="h-8 w-8" />
                    </div>
                  )}
                  <label className="block space-y-2 text-sm">
                    <span className="text-zinc-400">Profile photo</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-400 file:mr-3 file:rounded-full file:border-0 file:bg-indigo-600 file:px-3 file:py-1 file:text-xs file:font-medium file:text-white"
                      onChange={(e) => void handleImage(e.target.files?.[0])}
                    />
                  </label>
                  <label className="block space-y-2 text-sm">
                    <span className="text-zinc-400">Display name *</span>
                    <input
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
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
                    <p className="mt-1 text-sm text-zinc-500">Create your personal link.</p>
                  </div>
                  <label className="block space-y-2 text-sm">
                    <span className="text-zinc-400">Personal link slug *</span>
                    <div className="flex items-center overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/20">
                      <span className="shrink-0 pl-4 text-sm text-zinc-600">ponslink.com/u/</span>
                      <input
                        className="flex-1 bg-transparent px-2 py-3 text-sm text-white placeholder-zinc-600 outline-none"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="yourname"
                      />
                    </div>
                  </label>
                  <label className="block space-y-2 text-sm">
                    <span className="text-zinc-400">Headline</span>
                    <input
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder="One-line intro"
                    />
                  </label>
                  <label className="block space-y-2 text-sm">
                    <span className="text-zinc-400">Bio</span>
                    <textarea
                      className="min-h-24 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
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
                    <p className="mt-1 text-sm text-zinc-500">How do you want to connect?</p>
                  </div>
                  <label className="block space-y-2 text-sm">
                    <span className="text-zinc-400">Default session type</span>
                    <select
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                      value={roomType}
                      onChange={(e) =>
                        setRoomType(e.target.value as 'audio-one-to-one' | 'video-one-to-one')
                      }
                    >
                      <option value="audio-one-to-one">1:1 Audio</option>
                      <option value="video-one-to-one">1:1 Video</option>
                    </select>
                  </label>
                  <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] p-4 text-sm text-indigo-300">
                    Your link will be live at{' '}
                    <strong>ponslink.com/u/{slug || 'yourname'}</strong>. You can update these
                    settings later in your lounge profile.
                  </div>
                </div>
              )}

              {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

              <div className="mt-6 flex gap-3">
                {step > 1 && (
                  <button
                    className="flex cursor-pointer items-center gap-2 rounded-full border border-white/[0.08] px-4 py-2.5 text-sm font-medium text-zinc-400 transition hover:bg-white/[0.04]"
                    onClick={() => setStep((s) => (s - 1) as 1 | 2)}
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                )}
                {step < 3 ? (
                  <button
                    className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
                    onClick={goNext}
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
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
