import React from 'react';
import type { RequestType } from '@/features/personal-link/types';

export interface PurposeRequestSelectorProps {
  value: RequestType;
  onChange: (value: RequestType) => void;
  availability?: Partial<Record<RequestType, boolean>>;
}

export const PurposeRequestSelector: React.FC<PurposeRequestSelectorProps> = ({ value, onChange, availability }) => {
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-md">
      <label className="block text-sm font-medium text-zinc-300 mb-2">Choose your purpose</label>
      <div className="flex items-center gap-3">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as RequestType)}
          className="w-full rounded-md border border-zinc-400 bg-black text-white px-3 py-2"
        >
          <option value="general" disabled={availability?.general === false}>General</option>
          <option value="schedule" disabled={availability?.schedule === false}>Schedule</option>
          <option value="mentoring" disabled={availability?.mentoring === false}>Mentoring</option>
          <option value="collab" disabled={availability?.collab === false}>Collab</option>
        </select>
        {availability && Object.values(availability).some((enabled) => enabled === false) && (
          <span className="shrink-0 text-xs text-zinc-500">Unavailable types are disabled</span>
        )}
      </div>
    </section>
  );
};

export default PurposeRequestSelector;
