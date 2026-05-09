import React, { useState } from 'react';
import { Send } from 'lucide-react';
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

  const inputClass = 'h-11 rounded-[10px] border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#1E63FF] focus:ring-4 focus:ring-[#1E63FF]/10';
  const labelClass = 'mb-1.5 text-sm font-medium text-[#111827]';

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
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight text-[#111827]">Meeting request</h2>
        <p className="mt-1 text-sm text-[#6B7280]">Keep the visible form short; add timing context only if it matters.</p>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <div className="flex flex-col">
          <label className={labelClass}>Your name</label>
          <input className={inputClass} value={visitorName} onChange={(e) => setVisitorName(e.target.value)} placeholder="Your name" />
          {errors.name && <span className="mt-1 text-xs text-[#B91C1C]">{errors.name}</span>}
        </div>
        <div className="flex flex-col">
          <label className={labelClass}>Email</label>
          <input type="email" className={inputClass} value={visitorEmail} onChange={(e) => setVisitorEmail(e.target.value)} placeholder="you@example.com" />
          {errors.email && <span className="mt-1 text-xs text-[#B91C1C]">{errors.email}</span>}
        </div>
        <div className="flex flex-col">
          <label className={labelClass}>Timezone</label>
          <input className={inputClass} value={visitorTimezone} onChange={(e) => setVisitorTimezone(e.target.value)} placeholder="e.g. America/Los_Angeles" />
        </div>
        <div className="flex flex-col">
          <label className={labelClass}>Request type</label>
          <input readOnly className={`${inputClass} bg-[#F8FAFC] font-medium capitalize`} value={String(requestType)} />
        </div>
        <div className="sm:col-span-2 flex flex-col">
          <label className={labelClass}>Message</label>
          <textarea className="min-h-28 rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#1E63FF] focus:ring-4 focus:ring-[#1E63FF]/10" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What would you like to discuss?" />
          {errors.message && <span className="mt-1 text-xs text-[#B91C1C]">{errors.message}</span>}
        </div>
        <div className="sm:col-span-2 flex flex-col">
          <label className={labelClass}>Preferred time note</label>
          <textarea className="min-h-20 rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#1E63FF] focus:ring-4 focus:ring-[#1E63FF]/10" value={preferredTimeNote} onChange={(e) => setPreferredTimeNote(e.target.value)} placeholder="Suggested times..." />
        </div>
        <div className="sm:col-span-2 flex items-center justify-end pt-2">
          {createMutation.error && (
            <p className="mr-auto text-sm text-[#B91C1C]">Could not send this request. Please check the desk link and try again.</p>
          )}
          <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-[#1E63FF] px-5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(30,99,255,0.22)] transition hover:bg-[#174fd1] disabled:opacity-50" disabled={createMutation.isPending}>
            <Send className="h-4 w-4" />
            {createMutation.isPending ? 'Sending...' : 'Send request'}
          </button>
        </div>
      </form>
    </section>
  );
};

export default DeskRequestForm;
