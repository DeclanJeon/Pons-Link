import { cn } from "@/lib/utils";
import { useLandingStore } from "@/stores/useLandingStore";
import { connectionModes } from "@/types/room.types";

export const SelectionMode = () => {
  const roomType = useLandingStore(s => s.roomType);
  const setRoomType = useLandingStore(s => s.setRoomType);

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex items-center justify-center gap-4 md:gap-8 lg:gap-12">
        {connectionModes.map((mode, index) => {
          const Icon = mode.icon;
          const isSelected = roomType === mode.id;

          return (
            <button
              key={mode.id}
              onClick={() => setRoomType(mode.id)}
              className={cn(
                "group flex flex-col items-center gap-2 transition-all duration-300",
                "animate-fade-in-up",
                "touch-manipulation", // 모바일 터치 최적화
                isSelected ? "scale-110" : "hover:scale-105 active:scale-95"
              )}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div
                className={cn(
                  "relative p-3 sm:p-4 md:p-5 rounded-xl transition-all duration-300",
                  "touch-manipulation", // 모바일 터치 최적화
                  isSelected
                    ? "bg-primary/20 ring-2 ring-primary shadow-lg shadow-primary/30"
                    : "bg-white/5 hover:bg-white/10 active:bg-white/15"
                )}
              >
                <Icon size={typeof window !== 'undefined' && window.innerWidth < 640 ? 24 : window.innerWidth < 768 ? 28 : 36} strokeWidth={2} />
                {isSelected && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-primary rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
              <span className={cn(
                "text-xs sm:text-sm font-medium transition-colors",
                "select-none", // 모바일에서 텍스트 선택 방지
                isSelected ? "text-foreground" : "text-foreground/70"
              )}>
                {mode.title}
              </span>
            </button>
          );
        })}
      </div>

      {roomType && (
        <div className="animate-fade-in text-center px-4">
          <p className="text-sm md:text-base text-muted-foreground/80 max-w-md mx-auto">
            {connectionModes.find(m => m.id === roomType)?.description}
          </p>
        </div>
      )}
    </div>
  );
};
