import React from 'react';

// Intro panel that explains the public desk experience and what to expect.
export const DeskIntroPanel: React.FC = () => {
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-md">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Public Desk Gate</h2>
        <span className="text-xs text-zinc-400">Phase 1</span>
      </div>
      <p className="mt-2 text-sm text-zinc-300">
        Load a public profile by slug, review the purpose, and submit a mediated request to join a moment in a room.
      </p>
      <p className="mt-2 text-sm text-zinc-300">This interface follows the existing dark cosmic design language.</p>
    </section>
  );
};

export default DeskIntroPanel;
