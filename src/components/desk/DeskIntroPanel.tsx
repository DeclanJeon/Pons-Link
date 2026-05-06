import React from 'react';
import { CheckCircle2, Link2, MessageSquareText } from 'lucide-react';

export const DeskIntroPanel: React.FC = () => {
  return (
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1E63FF]">Request gate</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#111827]">Send a request before entering the room.</h2>
        </div>
        <span className="rounded-full bg-[#EEF5FF] px-3 py-1 text-xs font-semibold text-[#1E63FF]">Context first</span>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6B7280]">
        Share who you are, why you want to meet, and when works for you. The host can approve the right conversation and issue a focused meeting link.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Profile verified', icon: CheckCircle2 },
          { label: 'Request reviewed', icon: MessageSquareText },
          { label: 'Room link follows', icon: Link2 },
        ].map(({ label, icon: Icon }) => (
          <div key={label} className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-sm font-medium text-[#111827]">
            <Icon className="h-4 w-4 text-[#10B981]" />
            {label}
          </div>
        ))}
      </div>
    </section>
  );
};

export default DeskIntroPanel;
