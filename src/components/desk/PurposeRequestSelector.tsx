import React from 'react';
import type { RequestType } from '@/features/personal-link/types';

export interface PurposeRequestSelectorProps {
  value: RequestType;
  onChange: (value: RequestType) => void;
  availability?: Partial<Record<RequestType, boolean>>;
}

export const PurposeRequestSelector: React.FC<PurposeRequestSelectorProps> = ({ value, onChange, availability }) => {
  const types: Array<{ value: RequestType; label: string; desc: string }> = [
    { value: 'general', label: 'General', desc: 'Start a conversation' },
    { value: 'schedule', label: 'Schedule', desc: 'Find a meeting time' },
    { value: 'mentoring', label: 'Mentoring', desc: 'Ask for guidance' },
    { value: 'collab', label: 'Collab', desc: 'Propose work together' },
  ];

  return (
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <label className="block text-sm font-semibold text-[#111827]">Request type</label>
        {availability && Object.values(availability).some((enabled) => enabled === false) && (
          <span className="shrink-0 text-xs text-[#6B7280]">Unavailable types are disabled</span>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {types.map((type) => {
          const disabled = availability?.[type.value] === false;
          const selected = value === type.value;
          return (
            <button
              key={type.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(type.value)}
              className={[
                'rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45',
                selected
                  ? 'border-[#1E63FF] bg-[#EEF5FF] text-[#111827] shadow-[0_10px_24px_rgba(30,99,255,0.12)]'
                  : 'border-[#E5E7EB] bg-[#F8FAFC] text-[#111827] hover:border-[#BCD4FF]',
              ].join(' ')}
            >
              <span className="block text-sm font-semibold">{type.label}</span>
              <span className="mt-1 block text-xs text-[#6B7280]">{type.desc}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default PurposeRequestSelector;
