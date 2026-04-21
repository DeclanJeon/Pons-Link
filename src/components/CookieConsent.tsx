import { useState, useEffect } from 'react';

const STORAGE_KEY = 'ponslink:cookie-consent';

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setVisible(false);
  };

  const reject = () => {
    localStorage.setItem(STORAGE_KEY, 'rejected');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl rounded-2xl border border-white/[0.08] bg-[#0D0D0D] p-4 shadow-2xl sm:left-auto sm:right-6 sm:max-w-sm">
      <div className="mb-4 h-px w-full bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
      <p className="text-sm leading-6 text-zinc-400">
        We use cookies to keep you signed in and remember your preferences.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={accept}
          className="flex-1 cursor-pointer rounded-full bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
        >
          Accept
        </button>
        <button
          onClick={reject}
          className="flex-1 cursor-pointer rounded-full border border-white/[0.08] px-3 py-2 text-xs font-medium text-zinc-400 transition hover:bg-white/[0.04]"
        >
          Reject
        </button>
      </div>
    </div>
  );
};

export default CookieConsent;
