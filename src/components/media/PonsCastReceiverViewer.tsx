import { useEffect, useRef, memo, useCallback } from "react";
import { usePonsCastReceiver } from "@/hooks/usePonsCastReceiver";
import { cn } from "@/lib/utils";
import { usePeerConnectionStore } from "@/stores/usePeerConnectionStore";

interface PonsCastReceiverViewerProps {
  nickname: string;
  userId: string;
  className?: string;
}

export const PonsCastReceiverViewer = memo(({
  nickname,
  userId,
  className
}: PonsCastReceiverViewerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { handleData, isReady, error } = usePonsCastReceiver({ videoRef });

  const onBinaryData = useCallback((data: ArrayBuffer) => {
    handleData(data);
  }, [handleData]);

  useEffect(() => {
    const handler = (event: CustomEvent<{ data: ArrayBuffer, senderId: string }>) => {
      if (event.detail.senderId === userId) {
        handleData(event.detail.data);
      }
    };

    window.addEventListener('ponscast-binary-data' as any, handler as any);
    return () => window.removeEventListener('ponscast-binary-data' as any, handler as any);
  }, [userId, handleData]);

  return (
    <div className={cn("relative w-full h-full bg-black rounded-lg overflow-hidden flex items-center justify-center", className)}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-contain"
      />
      
      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-white">
        {nickname} (PonsCast)
      </div>

      {!isReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-white text-sm">Initializing PonsCast...</div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/80">
          <div className="text-white text-sm">{error}</div>
        </div>
      )}
    </div>
  );
});

PonsCastReceiverViewer.displayName = 'PonsCastReceiverViewer';
