import { CosmicBackground } from "@/components/landing/CosmicBackground";
import { Header } from "@/components/landing/Header";
import { RoomInfo } from "@/components/landing/RoomInfo";
// import { SelectionMode } from "@/components/landing/SelectionMode";

const Landing = () => {
  return (
    <div className="min-h-screen relative overflow-hidden cosmic-bg">
      <CosmicBackground />
      <div className="relative z-10 min-h-screen flex items-center justify-center py-8 md:py-12">
        <div className="w-full max-w-6xl px-4 md:px-6">
          <div className="animate-fade-in-up mb-8 md:mb-12">
            <Header />
          </div>

          <div className="space-y-6 md:space-y-8">
            {/* <div className="animate-fade-in-up animation-delay-200">
              <SelectionMode />
            </div> */}
            <div className="animate-fade-in-up animation-delay-400">
              <RoomInfo />
            </div>
          </div>

          <div className="text-center mt-8 md:mt-12 animate-fade-in-up animation-delay-600">
            <p className="text-muted-foreground/70 text-xs md:text-sm tracking-wide">
              Experience design that disappears into pure connection
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;
