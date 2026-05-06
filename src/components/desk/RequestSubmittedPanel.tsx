import React from 'react';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import type { ContactRequest } from '@/features/personal-link/types';

export interface RequestSubmittedPanelProps {
  hostSlug: string;
  request?: ContactRequest | null;
}

export const RequestSubmittedPanel: React.FC<RequestSubmittedPanelProps> = ({ hostSlug, request }) => {
  return (
    <section className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 text-[#10B981]" />
          <div>
            <h3 className="text-lg font-semibold text-[#111827]">Request submitted</h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#374151]">
              Your request has been sent. You will receive a response with next steps via the provided contact information.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#047857]">Host: {hostSlug}</span>
      </div>
      {request?.id && (
        <p className="mt-4 text-xs text-[#6B7280]">Request ID: {request.id}</p>
      )}
      {request?.meetingAccess?.url && (
        <a
          href={request.meetingAccess.url}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-[10px] bg-[#1E63FF] px-4 text-sm font-semibold text-white transition hover:bg-[#174fd1]"
        >
          <ExternalLink className="h-4 w-4" />
          Open room access
        </a>
      )}
    </section>
  );
};

export default RequestSubmittedPanel;
