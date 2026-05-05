import React, { useState } from 'react';
import { useCreateRequest } from '@/features/personal-link/useCreateRequest';
import type { ContactRequest, RequestCreateInput, RequestType } from '@/features/personal-link/types';

export interface DeskRequestFormProps {
  apiUrl?: string | null;
  hostSlug: string;
  requestType: RequestType;
  onSubmitted?: (request: ContactRequest) => void;
}

export const DeskRequestForm: React.FC<DeskRequestFormProps> = ({ apiUrl, hostSlug, requestType, onSubmitted }) => {
  // Form state
  const [visitorName, setVisitorName] = useState<string>('');
  const [visitorEmail, setVisitorEmail] = useState<string>('');
  const [visitorTimezone, setVisitorTimezone] = useState<string>(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
  const [message, setMessage] = useState<string>('');
  const [preferredTimeNote, setPreferredTimeNote] = useState<string>('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; message?: string }>({});

  const createMutation = useCreateRequest(apiUrl, { requireRemote: true });

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = visitorName.trim();
    const trimmedEmail = visitorEmail.trim();
    const trimmedMessage = message.trim();
    const trimmedPreferredTimeNote = preferredTimeNote.trim();
    const errs: { name?: string; email?: string; message?: string } = {};
    if (!trimmedName) {
      errs.name = 'Please enter your name';
    }
    if (!trimmedEmail) {
      errs.email = 'Please enter your email';
    } else if (!isValidEmail(trimmedEmail)) {
      errs.email = 'Please enter a valid email';
    }
    if (!trimmedMessage) {
      errs.message = 'Please enter a message';
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      return;
    }

    const input: RequestCreateInput = {
      hostSlug,
      visitorName: trimmedName,
      visitorEmail: trimmedEmail,
      visitorTimezone: visitorTimezone.trim() || undefined,
      deliveryMode: 'mediated',
      requestType,
      message: trimmedMessage,
      preferredTimeNote: trimmedPreferredTimeNote,
    };
    createMutation.mutate(input, {
      onSuccess: (request) => onSubmitted?.(request),
    });
  };

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-md">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <div className="flex flex-col">
          <label className="text-sm text-zinc-300 mb-1">Your name</label>
          <input className="rounded-md border border-zinc-400 bg-black text-white px-3 py-2" value={visitorName} onChange={(e) => setVisitorName(e.target.value)} placeholder="Your name" />
          {errors.name && <span className="mt-1 text-xs text-rose-300">{errors.name}</span>}
        </div>
        <div className="flex flex-col">
          <label className="text-sm text-zinc-300 mb-1">Email</label>
          <input type="email" className="rounded-md border border-zinc-400 bg-black text-white px-3 py-2" value={visitorEmail} onChange={(e) => setVisitorEmail(e.target.value)} placeholder="you@example.com" />
          {errors.email && <span className="mt-1 text-xs text-rose-300">{errors.email}</span>}
        </div>
        <div className="flex flex-col">
          <label className="text-sm text-zinc-300 mb-1">Timezone</label>
          <input className="rounded-md border border-zinc-400 bg-black text-white px-3 py-2" value={visitorTimezone} onChange={(e) => setVisitorTimezone(e.target.value)} placeholder="e.g. America/Los_Angeles" />
        </div>
        <div className="flex flex-col">
          <label className="text-sm text-zinc-300 mb-1">Request type</label>
          <input readOnly className="rounded-md border border-zinc-400 bg-black text-white px-3 py-2" value={String(requestType)} />
        </div>
        <div className="sm:col-span-2 flex flex-col">
          <label className="text-sm text-zinc-300 mb-1">Message</label>
          <textarea className="rounded-md border border-zinc-400 bg-black text-white px-3 py-2 h-28" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your message or context..." />
          {errors.message && <span className="mt-1 text-xs text-rose-300">{errors.message}</span>}
        </div>
        <div className="sm:col-span-2 flex flex-col">
          <label className="text-sm text-zinc-300 mb-1">Preferred time note</label>
          <textarea className="rounded-md border border-zinc-400 bg-black text-white px-3 py-2 h-20" value={preferredTimeNote} onChange={(e) => setPreferredTimeNote(e.target.value)} placeholder="Suggested times..." />
        </div>
        <div className="sm:col-span-2 flex items-center justify-end pt-2">
          {createMutation.error && (
            <p className="mr-auto text-sm text-rose-300">Could not send this request. Please check the desk link and try again.</p>
          )}
          <button type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Sending...' : 'Submit request'}
          </button>
        </div>
      </form>
    </section>
  );
};

export default DeskRequestForm;
