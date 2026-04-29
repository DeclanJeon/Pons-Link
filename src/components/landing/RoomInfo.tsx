import { useLandingStore } from "@/stores/useLandingStore";
import { sessionManager } from "@/utils/session.utils";
import { ArrowRight, Shuffle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export const RoomInfo = () => {
    const navigate = useNavigate();
    const {
        roomTitle,
        nickname,
        roomType,
        setRoomTitle,
        setNickname,
        generateRandomNickname
    } = useLandingStore();

    const handleNicknameGenerate = () => {
        generateRandomNickname();
        toast("Nickname generated", { duration: 1600 });
    };

    const handleConnect = () => {
        if (!roomType) {
            toast.error('Please select a room type');
            return;
        }

        if (!roomTitle.trim()) {
            toast.error('Please enter a room title');
            return;
        }

        const finalNickname = nickname.trim() || generateRandomNickname();
        
        sessionManager.saveNickname(finalNickname);
        
        navigate(`/lobby/${encodeURIComponent(roomTitle.trim())}?type=${roomType}`);
    };

    return (
        <section aria-label="Room details" className="mx-auto w-full max-w-md">
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="roomTitle" className="text-sm font-medium text-slate-100">
                        Room Title
                    </Label>
                    <Input
                        id="roomTitle"
                        placeholder="325235 or team-sync"
                        value={roomTitle}
                        onChange={(e) => setRoomTitle(e.target.value)}
                        className="h-12 rounded-2xl border-white/10 bg-white/[0.05] px-4 text-base text-white placeholder:text-slate-500 ring-offset-transparent transition-all focus-visible:border-primary/50 focus-visible:ring-primary/40 focus-visible:ring-offset-0 md:text-base"
                        onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="nickname" className="text-sm font-medium text-slate-100">
                            Nickname <span className="text-xs text-slate-500">(optional)</span>
                        </Label>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleNicknameGenerate}
                            className="min-h-8 gap-2 rounded-full px-3 text-xs text-primary-subtle transition-all hover:bg-primary/[0.12] hover:text-white"
                        >
                            <Shuffle className="h-3.5 w-3.5" />
                            Random
                        </Button>
                    </div>
                    <Input
                        id="nickname"
                        placeholder="Leave empty for a surprise..."
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        className="h-12 rounded-2xl border-white/10 bg-white/[0.05] px-4 text-base text-white placeholder:text-slate-500 ring-offset-transparent transition-all focus-visible:border-primary/50 focus-visible:ring-primary/40 focus-visible:ring-offset-0 md:text-base"
                        onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                    />
                </div>

                <Button
                    onClick={handleConnect}
                    className="mt-2 h-[52px] w-full rounded-[22px] border border-primary/[0.15] bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary-glow)))] text-base font-semibold text-primary-foreground shadow-[0_22px_52px_-24px_hsl(var(--primary)_/_0.95)] transition-all duration-300 hover:-translate-y-0.5 hover:opacity-95 active:scale-[0.99] disabled:translate-y-0 disabled:border-white/[0.08] disabled:bg-white/[0.06] disabled:text-slate-300 disabled:opacity-80 disabled:shadow-none sm:h-14"
                    disabled={!roomTitle.trim() || !roomType}
                >
                    Join Lobby
                    <ArrowRight className="h-4 w-4" />
                </Button>
            </div>
        </section>
    );
};
