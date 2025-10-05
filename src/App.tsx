import React, { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Lobby from "./pages/Lobby";
import Room from "./pages/Room";
import NotFound from "./pages/NotFound";
import { EnvError } from "./config";
import { useFullscreenStore } from "./stores/useFullscreenStore"; // 스토어 임포트

const queryClient = new QueryClient();

const EnvErrorDisplay = () => (
  <div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground">
    <div className="rounded-lg border border-destructive bg-card p-8 text-center shadow-lg">
      <h1 className="mb-4 text-2xl font-bold text-destructive">Configuration Error</h1>
      <p className="mb-2">The application cannot start due to an invalid configuration.</p>
      <p className="text-muted-foreground">Please check the `.env` file for the following variable:</p>
      <code className="mt-4 inline-block rounded bg-muted px-2 py-1 font-mono text-sm">
        VITE_SIGNALING_SERVER_URL
      </code>
      <p className="mt-2 text-xs text-muted-foreground">It must be a valid URL.</p>
    </div>
  </div>
);

const App = () => {
  if (EnvError) {
    return <EnvErrorDisplay />;
  }

  // 전역 전체 화면 상태 동기화 로직
  const syncFullscreenState = useFullscreenStore(state => state.syncStateWithDOM);
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
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/lobby" element={<Lobby />} />
            <Route path="/lobby/:roomTitle" element={<Lobby />} />
            <Route path="/room/:roomTitle" element={<Room />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
