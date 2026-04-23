import { Suspense, lazy, useEffect } from "react";
import CookieConsent from "@/components/CookieConsent";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useFullscreenStore } from "./stores/useFullscreenStore";
import { analytics } from "./lib/analytics";

const Marketing = lazy(() => import("./pages/Marketing"));
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const LoungeOnboarding = lazy(() => import("./pages/LoungeOnboarding"));
const SelfUnderstandingHome = lazy(() => import("./pages/SelfUnderstandingHome"));
const MyProfile = lazy(() => import("./pages/MyProfile"));
const MyTraits = lazy(() => import("./pages/MyTraits"));
const MyRelationships = lazy(() => import("./pages/MyRelationships"));
const MyGrowth = lazy(() => import("./pages/MyGrowth"));
const Archive = lazy(() => import("./pages/Archive"));
const MySettings = lazy(() => import("./pages/MySettings"));
const Lounge = lazy(() => import("./pages/Lounge"));
const LoungeConversations = lazy(() => import("./pages/LoungeConversations"));
const LoungeAliases = lazy(() => import("./pages/LoungeAliases"));
const LoungeProfile = lazy(() => import("./pages/LoungeProfile"));
const LoungeFriends = lazy(() => import("./pages/LoungeFriends"));
const LoungeRequests = lazy(() => import("./pages/LoungeRequests"));
const LoungeRequestDetail = lazy(() => import("./pages/LoungeRequestDetail"));
const LoungeBookings = lazy(() => import("./pages/LoungeBookings"));
const LoungeBookingDetail = lazy(() => import("./pages/LoungeBookingDetail"));
const LoungeEmailDeliveries = lazy(() => import("./pages/LoungeEmailDeliveries"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const SessionAccess = lazy(() => import("./pages/SessionAccess"));
const Lobby = lazy(() => import("./pages/Lobby"));
const Room = lazy(() => import("./pages/Room"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function PageViewTracker() {
  const location = useLocation();
  
  useEffect(() => {
    analytics.page(location.pathname);
  }, [location.pathname]);
  
  return null;
}

const App = () => {
  const syncFullscreenState = useFullscreenStore((state) => state.syncStateWithDOM);

  useEffect(() => {
    analytics.init();
  }, []);

  useEffect(() => {
    if (!syncFullscreenState) return;
    const handler = () => syncFullscreenState();

    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    document.addEventListener('mozfullscreenchange', handler);
    document.addEventListener('MSFullscreenChange', handler);

    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
      document.removeEventListener('mozfullscreenchange', handler);
      document.removeEventListener('MSFullscreenChange', handler);
    };
  }, [syncFullscreenState]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <PageViewTracker />
          <Suspense fallback={<div className="h-screen w-screen bg-background" />}>
            <Routes>
              <Route path="/" element={<Marketing />} />
              <Route path="/home" element={<SelfUnderstandingHome />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/legacy-home" element={<Landing />} />

              <Route path="/login" element={<Login />} />
              <Route path="/lounge/onboarding" element={<LoungeOnboarding />} />
              <Route path="/lounge" element={<Lounge />} />
              <Route path="/lounge/conversations" element={<LoungeConversations />} />
              <Route path="/lounge/aliases" element={<LoungeAliases />} />
              <Route path="/lounge/profile" element={<LoungeProfile />} />
              <Route path="/lounge/friends" element={<LoungeFriends />} />
              <Route path="/lounge/requests" element={<LoungeRequests />} />
              <Route path="/lounge/requests/:requestId" element={<LoungeRequestDetail />} />
              <Route path="/lounge/bookings" element={<LoungeBookings />} />
              <Route path="/lounge/bookings/:bookingId" element={<LoungeBookingDetail />} />
              <Route path="/lounge/email-deliveries" element={<LoungeEmailDeliveries />} />

              <Route path="/me" element={<Navigate to="/home" replace />} />
              <Route path="/me/profile" element={<MyProfile />} />
              <Route path="/me/traits" element={<MyTraits />} />
              <Route path="/me/relationships" element={<MyRelationships />} />
              <Route path="/me/growth" element={<MyGrowth />} />
              <Route path="/me/archive" element={<Archive />} />
              <Route path="/me/settings" element={<MySettings />} />
              <Route path="/me/requests" element={<Navigate to="/lounge/requests" replace />} />
              <Route path="/me/requests/:requestId" element={<LoungeRequestDetail />} />
              <Route path="/me/bookings" element={<Navigate to="/lounge/bookings" replace />} />
              <Route path="/me/bookings/:bookingId" element={<LoungeBookingDetail />} />

              <Route path="/u/:slug" element={<PublicProfile />} />
              <Route path="/session-access/:reservationId" element={<SessionAccess />} />
              <Route path="/lobby" element={<Lobby />} />
              <Route path="/lobby/:roomTitle" element={<Lobby />} />
              <Route path="/room/:roomTitle" element={<Room />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <CookieConsent />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
