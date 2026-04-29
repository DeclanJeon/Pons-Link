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
    <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-w-xl items-center gap-3 rounded-t-2xl border border-white/[0.08] bg-[#0D0D0D]/95 p-2 shadow-2xl backdrop-blur-xl sm:bottom-4 sm:left-auto sm:right-6 sm:block sm:max-w-sm sm:rounded-2xl sm:p-4">
      <div className="hidden h-px w-full bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent sm:mb-4 sm:block" />
      <p className="min-w-0 flex-1 text-xs leading-5 text-zinc-400 sm:text-sm sm:leading-6">
        We use cookies to keep you signed in and remember your preferences.
      </p>
      <div className="flex shrink-0 gap-2 sm:mt-3">
        <button
          onClick={accept}
          className="min-h-10 cursor-pointer rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 sm:flex-1 sm:px-3"
        >
          Accept
        </button>
        <button
          onClick={reject}
          className="min-h-10 cursor-pointer rounded-full border border-white/[0.08] px-4 py-2 text-xs font-medium text-zinc-400 transition hover:bg-white/[0.04] sm:flex-1 sm:px-3"
        >
          Reject
        </button>
      </div>
    </div>
  );
};

export default CookieConsent;
