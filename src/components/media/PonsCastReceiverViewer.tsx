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
    <div
      className={cn("relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-black ponscast-stage", className)}
      aria-label={`PonsCast stream from ${nickname}`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="h-full w-full object-contain"
      />
      
      <div className="absolute left-3 top-3 rounded-full border border-indigo-200/15 bg-black/55 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-100/85 backdrop-blur-md">
        Receiving PonsCast
      </div>

      <div className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] rounded-2xl border border-white/10 bg-black/65 px-3 py-2 text-xs text-white shadow-2xl backdrop-blur-md">
        <div className="truncate font-semibold text-white/90">{metadata?.fileName || 'Waiting for media'}</div>
        <div className="mt-0.5 text-[10px] text-white/52">{nickname} · PonsCast</div>
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
