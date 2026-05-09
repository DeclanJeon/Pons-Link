import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export const Header = () => {
    const { t } = useTranslation();

    return (
        <header className="absolute left-4 top-4 z-20 flex items-center gap-3 sm:left-6 sm:top-6">
            <Link
                to="/"
                aria-label={t('landing.header.homeAria')}
                className="group flex items-center gap-3 rounded-2xl outline-none transition duration-300 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050507]"
            >
                <img
                    src="/icon.svg"
                    alt=""
                    className="h-10 w-10 rounded-[15px] drop-shadow-[0_18px_38px_rgba(99,102,241,0.25)] transition duration-300 group-hover:scale-[1.03] sm:h-11 sm:w-11"
                />
                <div className="text-left">
                    <p className="text-xl font-semibold tracking-[-0.04em] text-white sm:text-2xl">PonsLink</p>
                    <p className="text-[8px] font-semibold uppercase tracking-[0.22em] text-slate-500 sm:text-[9px]">
                        {t('landing.header.tagline')}
                    </p>
                </div>
            </Link>
        </header>
    );
}
