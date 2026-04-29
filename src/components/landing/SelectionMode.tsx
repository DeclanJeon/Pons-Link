import { cn } from "@/lib/utils";
import { useLandingStore } from "@/stores/useLandingStore";
import { connectionModes } from "@/types/room.types";

export const SelectionMode = () => {
  const roomType = useLandingStore(s => s.roomType);
  const setRoomType = useLandingStore(s => s.setRoomType);

  return (
    <section aria-label="Choose room mode" className="space-y-3">
      <div className="flex items-center justify-center gap-3 sm:gap-5">
        {connectionModes.map((mode, index) => {
          const Icon = mode.icon;
          const isSelected = roomType === mode.id;

          return (
            <button
              key={mode.id}
              onClick={() => setRoomType(mode.id)}
              className={cn(
                "group flex min-w-0 flex-1 flex-col items-center gap-2 transition-all duration-300",
                "animate-fade-in-up",
                "touch-manipulation",
                isSelected
                  ? "scale-105"
                  : "hover:scale-[1.03] active:scale-95"
              )}
              style={{ animationDelay: `${index * 100}ms` }}
              aria-pressed={isSelected}
            >
              <div
                className={cn(
                  "relative flex h-14 w-14 items-center justify-center rounded-2xl border transition-all duration-300 sm:h-16 sm:w-16 sm:rounded-[22px]",
                  isSelected
                    ? "border-primary/50 bg-primary/[0.16] text-primary-subtle shadow-[0_18px_40px_-24px_hsl(var(--primary)_/_0.95)]"
                    : "border-white/[0.08] bg-white/[0.05] text-slate-200 hover:bg-white/[0.08]"
                )}
              >
                <Icon className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2} />
                {isSelected && (
                  <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_22px_hsl(var(--primary)_/_0.55)]">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
              </div>
              <span className={cn(
                "max-w-full text-center text-[11px] font-medium leading-tight transition-colors sm:text-xs",
                isSelected ? "text-white" : "text-slate-400"
              )}>
                {mode.title}
              </span>
            </button>
          );
        })}
      </div>

      {roomType && (
        <div className="hidden animate-fade-in px-3 text-center sm:block">
          <p className="mx-auto max-w-md text-xs leading-5 text-slate-500 sm:text-sm">
            {connectionModes.find(m => m.id === roomType)?.description}
          </p>
        </div>
      )}
    </section>
  );
};
