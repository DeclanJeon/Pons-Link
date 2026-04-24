import { useEffect, useRef, memo, useState } from "react";
import { usePonsCastReceiver } from "@/hooks/usePonsCastReceiver";
import { cn } from "@/lib/utils";
import {
  PONSCAST_BINARY_EVENT,
  PONSCAST_METADATA_EVENT,
  PONSCAST_STREAM_END_EVENT,
  type PonsCastStreamMetadata,
} from "@/lib/ponscast/protocol";

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
  const [metadata, setMetadata] = useState<PonsCastStreamMetadata | null>(null);
  const { handleData, isReady, error, reset } = usePonsCastReceiver({
    videoRef,
    mimeType: metadata?.mimeType,
  });

  useEffect(() => {
    const handleMetadata = (event: CustomEvent<PonsCastStreamMetadata>) => {
      if (event.detail.senderId !== userId) return;
      setMetadata(event.detail);
    };

    const handleEnd = (event: CustomEvent<{ senderId: string; streamId?: string }>) => {
      if (event.detail.senderId !== userId) return;
      setMetadata(null);
      reset();
    };

    window.addEventListener(PONSCAST_METADATA_EVENT, handleMetadata as EventListener);
    window.addEventListener(PONSCAST_STREAM_END_EVENT, handleEnd as EventListener);
    return () => {
      window.removeEventListener(PONSCAST_METADATA_EVENT, handleMetadata as EventListener);
      window.removeEventListener(PONSCAST_STREAM_END_EVENT, handleEnd as EventListener);
    };
  }, [userId, reset]);

  useEffect(() => {
    const handler = (event: CustomEvent<{ data: ArrayBuffer, senderId: string }>) => {
      if (event.detail.senderId === userId) {
        handleData(event.detail.data);
      }
    };

    window.addEventListener(PONSCAST_BINARY_EVENT, handler as EventListener);
    return () => window.removeEventListener(PONSCAST_BINARY_EVENT, handler as EventListener);
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
        {metadata?.fileName ? `${metadata.fileName} · ` : ''}{nickname} (PonsCast)
      </div>

      {!isReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-white text-sm">Initializing PonsCast...</div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/80 p-4 text-center">
          <div className="text-white text-sm">{error}</div>
        </div>
      )}
    </div>
  );
});

PonsCastReceiverViewer.displayName = 'PonsCastReceiverViewer';
