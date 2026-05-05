import React from 'react';
import type { ContactRequest } from '@/features/personal-link/types';

export interface RequestSubmittedPanelProps {
  hostSlug: string;
  request?: ContactRequest | null;
}

export const RequestSubmittedPanel: React.FC<RequestSubmittedPanelProps> = ({ hostSlug, request }) => {
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-md">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Request submitted</h3>
        <span className="text-xs text-zinc-400">Host: {hostSlug}</span>
      </div>
      <p className="mt-2 text-sm text-zinc-300">Your request has been sent. You will receive a response with next steps via the provided contact information.</p>
      {request?.id && (
        <p className="mt-3 text-xs text-zinc-500">Request ID: {request.id}</p>
      )}
      {request?.meetingAccess?.url && (
        <a
          href={request.meetingAccess.url}
          className="mt-4 inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
        >
          Open room access
        </a>
      )}
    </section>
  );
};

export default RequestSubmittedPanel;
