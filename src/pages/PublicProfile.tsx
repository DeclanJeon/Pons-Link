import { useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Handshake,
  Mail,
  MessageSquareHeart,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { usePublicProfile } from '@/features/personal-link/usePublicProfile';
import { useCreateRequest } from '@/features/personal-link/useCreateRequest';
import { useMemo, useState } from 'react';
import type { RequestType } from '@/features/personal-link/types';

const requestTypeLabels: Record<RequestType, string> = {
  general: 'General inquiry',
  schedule: 'Schedule a call',
  mentoring: 'Mentoring',
  collab: 'Collaboration',
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PublicProfile = () => {
  const { slug = '' } = useParams();
  const profile = usePublicProfile(slug);
  const createRequest = useCreateRequest();

  const [step, setStep] = useState<1 | 2>(1);
  const [visitorName, setVisitorName] = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');
  const [message, setMessage] = useState('');
  const [requestType, setRequestType] = useState<RequestType>('general');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const step1Errors = useMemo(
    () => ({
      visitorName: visitorName.trim() ? '' : 'Name is required.',
      visitorEmail: !visitorEmail.trim()
        ? 'Email is required.'
        : !emailRegex.test(visitorEmail)
          ? 'Invalid email format.'
          : '',
      message: !message.trim()
        ? 'Message is required.'
        : message.trim().length < 10
          ? 'At least 10 characters.'
          : '',
    }),
    [visitorName, visitorEmail, message],
  );

  const step1Valid = !step1Errors.visitorName && !step1Errors.visitorEmail && !step1Errors.message;

  if (!profile.isLoading && !profile.data) {
    return <div className="p-6">Link not found.</div>;
  }

  const data = profile.data;
  const requestTypes = (['general', 'schedule', 'mentoring', 'collab'] as RequestType[]).filter(
    (type) => {
      if (type === 'general') return data?.allowGeneralRequest;
      if (type === 'schedule') return data?.allowScheduleRequest;
      if (type === 'mentoring') return data?.allowMentoringRequest;
      return data?.allowCollabRequest;
    },
  );

  const submit = async () => {
    setSubmitError('');
    const preferredTimeNote = [preferredDate, preferredTime].filter(Boolean).join(' ');
    try {
      await createRequest.mutateAsync({
        hostSlug: slug,
        visitorName,
        visitorEmail,
        requestType,
        message,
        preferredTimeNote,
      });

      // Fire-and-forget: notify host via backend
      const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
      if (apiUrl && data?.hostEmail) {
        fetch(`${apiUrl}/api/email/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hostEmail: data.hostEmail,
            hostDisplayName: data.displayName,
            visitorName,
            visitorEmail,
            requestType,
            message,
            preferredTime: preferredTimeNote,
            loungeUrl: `${window.location.origin}/lounge/requests`,
          }),
        }).catch(console.error);
      }

      setDone(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to send request.');
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.16),_transparent_30%),linear-gradient(180deg,_rgba(15,23,42,0.04),_transparent_24%)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-6 rounded-[28px] border border-border/70 bg-card/85 p-6 shadow-[0_30px_120px_-40px_rgba(15,23,42,0.45)] backdrop-blur lg:grid-cols-[minmax(0,1.1fr)_420px] lg:p-8">
          {/* Left: host profile info */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Personal Link
            </div>

            <div className="flex items-start gap-4">
              {data?.profileImageUrl ? (
                <img
                  src={data.profileImageUrl}
                  alt="profile"
                  className="h-20 w-20 rounded-[24px] object-cover ring-1 ring-border/60"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-primary/10 text-primary ring-1 ring-primary/20">
                  <UserRound className="h-8 w-8" />
                </div>
              )}
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  {data?.displayName ?? 'Profile'}
                </h1>
                <p className="text-base leading-7 text-foreground/90">{data?.headline}</p>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{data?.bio}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  icon: MessageSquareHeart,
                  title: 'No barriers',
                  body: 'Leave a message after reading the profile.',
                },
                {
                  icon: CalendarClock,
                  title: 'Include timing',
                  body: 'Share your preferred time to improve response quality.',
                },
                {
                  icon: Handshake,
                  title: 'Intent first',
                  body: 'Context and intent before scores or automation.',
                },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-sm font-medium">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: 2-step wizard */}
          <div className="rounded-[24px] border border-border/70 bg-background/85 p-5 sm:p-6">
            <div className="mb-5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">request</p>
                <span className="text-xs text-muted-foreground">Step {step} of 2</span>
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">
                {step === 1 ? 'Send a request' : 'Preferred timing'}
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {step === 1
                  ? "Tell them who you are and why you'd like to connect."
                  : 'When works best for you? (optional — skip to send)'}
              </p>
            </div>

            {done ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm text-emerald-200">
                Request sent. The host will review and reach out via email.
              </div>
            ) : (
              <>
                {submitError ? (
                  <div className="mb-4 flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                ) : null}

                {step === 1 ? (
                  <div className="space-y-4">
                    <label className="block space-y-2 text-sm">
                      <span className="text-muted-foreground">Name</span>
                      <input
                        className={`w-full rounded-2xl border bg-card px-4 py-3 outline-none transition focus:ring-4 ${
                          step1Errors.visitorName && visitorName
                            ? 'border-destructive/50 focus:ring-destructive/10'
                            : 'border-border/70 focus:border-primary/40 focus:ring-primary/10'
                        }`}
                        value={visitorName}
                        onChange={(e) => setVisitorName(e.target.value)}
                        placeholder="How should they address you?"
                      />
                    </label>
                    <label className="block space-y-2 text-sm">
                      <span className="text-muted-foreground">Email</span>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          className={`w-full rounded-2xl border bg-card py-3 pl-11 pr-4 outline-none transition focus:ring-4 ${
                            step1Errors.visitorEmail && visitorEmail
                              ? 'border-destructive/50 focus:ring-destructive/10'
                              : 'border-border/70 focus:border-primary/40 focus:ring-primary/10'
                          }`}
                          value={visitorEmail}
                          onChange={(e) => setVisitorEmail(e.target.value)}
                          placeholder="Email for the reply"
                        />
                      </div>
                    </label>
                    <label className="block space-y-2 text-sm">
                      <span className="text-muted-foreground">Request type</span>
                      <select
                        className="w-full rounded-2xl border border-border/70 bg-card px-4 py-3 outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                        value={requestType}
                        onChange={(e) => setRequestType(e.target.value as RequestType)}
                      >
                        {requestTypes.map((type) => (
                          <option key={type} value={type}>
                            {requestTypeLabels[type]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-2 text-sm">
                      <span className="text-muted-foreground">Message</span>
                      <textarea
                        className={`min-h-32 w-full rounded-2xl border bg-card px-4 py-3 outline-none transition focus:ring-4 ${
                          step1Errors.message && message
                            ? 'border-destructive/50 focus:ring-destructive/10'
                            : 'border-border/70 focus:border-primary/40 focus:ring-primary/10'
                        }`}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="What do you want to discuss, and why now?"
                      />
                    </label>
                    <button
                      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!step1Valid}
                      onClick={() => setStep(2)}
                    >
                      Next <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <label className="block space-y-2 text-sm">
                      <span className="text-muted-foreground">Preferred date</span>
                      <input
                        type="date"
                        className="w-full rounded-2xl border border-border/70 bg-card px-4 py-3 outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                        value={preferredDate}
                        onChange={(e) => setPreferredDate(e.target.value)}
                      />
                    </label>
                    <label className="block space-y-2 text-sm">
                      <span className="text-muted-foreground">Preferred time</span>
                      <input
                        type="time"
                        className="w-full rounded-2xl border border-border/70 bg-card px-4 py-3 outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                        value={preferredTime}
                        onChange={(e) => setPreferredTime(e.target.value)}
                      />
                    </label>
                    <div className="flex gap-3">
                      <button
                        className="flex cursor-pointer items-center gap-2 rounded-full border border-border/70 px-4 py-3 text-sm font-medium transition hover:bg-accent"
                        onClick={() => setStep(1)}
                      >
                        <ArrowLeft className="h-4 w-4" /> Back
                      </button>
                      <button
                        className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={createRequest.isPending}
                        onClick={() => void submit()}
                      >
                        {createRequest.isPending ? 'Sending...' : 'Send request'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default PublicProfile;
