import { useLandingStore } from "@/stores/useLandingStore";
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
        setRoomTitle,
        setNickname,
        generateRandomNickname,
        handleConnect
    } = useLandingStore();

    // const roomType = useLandingStore(s => s.roomType);

    /**
     * 랜덤 닉네임 생성 핸들러
     * 사용자의 의사결정 부담을 줄이기 위한 보조 기능
     */
    const handleNicknameGenerate = () => {
        const randomName = generateRandomNickname();
        toast("✨ Perfect! This name suits you", { duration: 2000 });
    };

    const connect = () => {
        handleConnect(navigate, toast);
    };

    return (
        <div className={`
            transition-all duration-500 ease-out
            opacity-100 translate-y-0 max-h-96
        `}>
            <div className="max-w-md mx-auto space-y-6">
                {/* Room Title Input */}
                <div className="space-y-2">
                    <Label htmlFor="roomTitle" className="text-foreground font-medium">
                        Room Title
                    </Label>
                    <Input
                        id="roomTitle"
                        placeholder="Enter your meeting room name..."
                        value={roomTitle}
                        onChange={(e) => setRoomTitle(e.target.value)}
                        className="h-12 text-lg bg-input/50 backdrop-blur-sm border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all"
                        onKeyDown={(e) => e.key === "Enter" && connect()}
                    />
                </div>

                {/* Nickname Input - Optional with Smart Generation */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="nickname" className="text-foreground font-medium">
                            Nickname <span className="text-muted-foreground text-sm">(optional)</span>
                        </Label>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleNicknameGenerate}
                            className="text-primary hover:text-primary-glow text-sm transition-all"
                        >
                            ✨ Inspire me
                        </Button>
                    </div>
                    <Input
                        id="nickname"
                        placeholder="Leave empty for a surprise..."
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        className="h-12 text-lg bg-input/50 backdrop-blur-sm border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all"
                        onKeyDown={(e) => e.key === "Enter" && connect()}
                    />
                </div>

                {/* Connection Button - Clear Call-to-Action */}
                <Button
                    onClick={connect}
                    className="w-full h-14 text-lg btn-connection mt-8 transition-all duration-300 hover:scale-105"
                    // disabled={!roomTitle.trim() || !roomType}
                >
                    {/* {`Connect to ${connectionModes.find(m => m.id === selectedMode)?.title}` : 'Connect'} */}
                    { `Join Lobby` }
                </Button>
            </div>
        </div>
    );
};
