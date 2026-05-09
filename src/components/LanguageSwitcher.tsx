import { type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveUiLanguage, UI_LANGUAGES } from '@/i18n';
import { cn } from '@/lib/utils';

interface LanguageSwitcherProps {
  className?: string;
}

const LanguageSwitcher = ({ className }: LanguageSwitcherProps) => {
  const { t, i18n } = useTranslation();
  const activeLanguage = resolveUiLanguage(i18n.resolvedLanguage || i18n.language);

  const handleLanguageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    void i18n.changeLanguage(resolveUiLanguage(event.target.value));
  };

  return (
    <div className={cn('inline-flex items-center', className)}>
      <label htmlFor="ponslink-language" className="sr-only">
        {t('common.language')}
      </label>
      <select
        id="ponslink-language"
        value={activeLanguage}
        onChange={handleLanguageChange}
        aria-label={t('common.language')}
        className="h-10 rounded-[10px] border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#1E63FF]/30 focus:outline-none focus:ring-2 focus:ring-[#1E63FF]/25"
      >
        {UI_LANGUAGES.map((language) => (
          <option key={language.code} value={language.code}>
            {language.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSwitcher;
