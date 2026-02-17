import { useMemo, useState, useEffect } from 'react';
import { useSignalingStore } from '@/stores/useSignalingStore';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { WifiOff } from 'lucide-react';

export const GlobalConnectionStatus = () => {
  const signalingStatus = useSignalingStore((state) => state.status);
  const peers = usePeerConnectionStore((state) => state.peers);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const phase = useMemo(() => {
    if (!isOnline) return 'offline';

    if (signalingStatus === 'connecting') return 'signaling_reconnecting';
    if (signalingStatus === 'disconnected' || signalingStatus === 'error') return 'degraded';

    const peerStates = Array.from(peers.values()).map((peer) => peer.connectionState);
    if (peerStates.length === 0) return 'fully_connected';

    const connectedCount = peerStates.filter((state) => state === 'connected').length;
    const hardFailedCount = peerStates.filter((state) => state === 'failed' || state === 'disconnected').length;

    if (connectedCount === peerStates.length) return 'fully_connected';
    if (hardFailedCount === peerStates.length) return 'degraded';
    return 'signaling_connected_media_recovering';
  }, [isOnline, peers, signalingStatus]);

  if (phase === 'fully_connected') {
    return null;
  }

  const toneClass = phase === 'degraded' || phase === 'offline'
    ? 'bg-destructive text-destructive-foreground'
    : 'bg-amber-500 text-black';

  const message = phase === 'offline'
    ? 'You are offline. Reconnection will resume automatically when network returns.'
    : phase === 'signaling_reconnecting'
      ? 'Reconnecting signaling channel...'
      : phase === 'signaling_connected_media_recovering'
        ? 'Server reconnected. Recovering media connections...'
        : 'Connection is degraded. Some realtime features may be unavailable.';

  return (
    <div className={`fixed top-0 left-0 right-0 z-[200] p-2 text-center text-sm flex items-center justify-center gap-2 ${toneClass}`} role="status" aria-live="polite">
      <WifiOff className="w-4 h-4" />
      {message}
    </div>
  );
};
