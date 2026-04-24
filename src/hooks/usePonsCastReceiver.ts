import { useRef, useCallback, useEffect, useState } from 'react';
import { getSafePonsCastMimeType, parsePonsCastFrame } from '@/lib/ponscast/protocol';

interface UsePonsCastReceiverProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  mimeType?: string;
  jitterBufferMs?: number;
}

interface Packet {
  seq: number;
  timestamp: number;
  data: ArrayBuffer;
  receivedAt: number;
}

export const usePonsCastReceiver = ({
  videoRef,
  mimeType,
  jitterBufferMs = 1500
}: UsePonsCastReceiverProps) => {
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const packetQueueRef = useRef<Map<number, Packet>>(new Map());
  const nextSeqRef = useRef<number>(-1);
  const isUpdatingRef = useRef<boolean>(false);
  const isReadyRef = useRef<boolean>(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    if (sourceBufferRef.current && mediaSourceRef.current?.readyState === 'open') {
      try {
        mediaSourceRef.current.removeSourceBuffer(sourceBufferRef.current);
      } catch (e) {
        console.warn('[PonsCastReceiver] Error removing SourceBuffer:', e);
      }
    }
    if (mediaSourceRef.current && mediaSourceRef.current.readyState === 'open') {
      try {
        mediaSourceRef.current.endOfStream();
      } catch (e) {
        console.warn('[PonsCastReceiver] Error ending stream:', e);
      }
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    mediaSourceRef.current = null;
    sourceBufferRef.current = null;
    packetQueueRef.current.clear();
    nextSeqRef.current = -1;
    isUpdatingRef.current = false;
    isReadyRef.current = false;
    setIsReady(false);
  }, []);

  const evictOldBuffer = useCallback(() => {
    const sb = sourceBufferRef.current;
    const video = videoRef.current;
    if (!sb || !video || sb.updating || video.buffered.length === 0) return;
    const currentTime = video.currentTime || 0;
    const firstStart = video.buffered.start(0);
    if (currentTime - firstStart > 45) {
      try {
        sb.remove(firstStart, Math.max(firstStart, currentTime - 30));
      } catch (e) {
        console.warn('[PonsCastReceiver] Failed to evict old buffer:', e);
      }
    }
  }, [videoRef]);

  const processQueue = useCallback(() => {
    if (!sourceBufferRef.current || sourceBufferRef.current.updating || isUpdatingRef.current || !isReadyRef.current) return;

    const sequences = Array.from(packetQueueRef.current.keys()).sort((a, b) => a - b);
    if (sequences.length === 0) return;

    if (nextSeqRef.current === -1) {
      const first = packetQueueRef.current.get(sequences[0]);
      if (first && Date.now() - first.receivedAt < Math.min(jitterBufferMs, 250) && sequences.length < 2) return;
      nextSeqRef.current = sequences[0];
    }

    let packet = packetQueueRef.current.get(nextSeqRef.current);
    if (!packet) {
      const firstAvailableSeq = sequences[0];
      const firstAvailable = packetQueueRef.current.get(firstAvailableSeq);
      const waitedMs = firstAvailable ? Date.now() - firstAvailable.receivedAt : 0;
      if (waitedMs >= jitterBufferMs || firstAvailableSeq > nextSeqRef.current + 10) {
        console.warn(`[PonsCastReceiver] Missing packet ${nextSeqRef.current}, skipping to ${firstAvailableSeq}`);
        nextSeqRef.current = firstAvailableSeq;
        packet = packetQueueRef.current.get(nextSeqRef.current);
      } else {
        return;
      }
    }

    if (!packet) return;

    try {
      isUpdatingRef.current = true;
      sourceBufferRef.current.appendBuffer(packet.data);
      packetQueueRef.current.delete(nextSeqRef.current);
      nextSeqRef.current++;

      const MAX_QUEUE_SIZE = 30;
      if (packetQueueRef.current.size > MAX_QUEUE_SIZE) {
        const latestSeq = Math.max(...Array.from(packetQueueRef.current.keys()));
        for (const seq of packetQueueRef.current.keys()) {
          if (seq < latestSeq - 5) packetQueueRef.current.delete(seq);
        }
        nextSeqRef.current = Math.max(nextSeqRef.current, latestSeq - 5);
      }
    } catch (e) {
      console.error('[PonsCastReceiver] Failed to append buffer:', e);
      isUpdatingRef.current = false;
      setError('Failed to append PonsCast media data');
    }
  }, [jitterBufferMs]);

  const initMSE = useCallback(() => {
    if (!videoRef.current) return;
    cleanup();
    setError(null);

    if (typeof MediaSource === 'undefined') {
      setError('PonsCast playback is not supported on this browser.');
      return;
    }

    const resolvedMimeType = getSafePonsCastMimeType(mimeType);
    if (typeof MediaSource.isTypeSupported === 'function' && !MediaSource.isTypeSupported(resolvedMimeType)) {
      setError(`PonsCast MIME type is not supported: ${resolvedMimeType}`);
      return;
    }

    const ms = new MediaSource();
    mediaSourceRef.current = ms;
    const objectUrl = URL.createObjectURL(ms);
    objectUrlRef.current = objectUrl;
    videoRef.current.src = objectUrl;

    ms.addEventListener('sourceopen', () => {
      try {
        const sb = ms.addSourceBuffer(resolvedMimeType);
        sb.mode = 'sequence';
        sb.addEventListener('updateend', () => {
          isUpdatingRef.current = false;
          evictOldBuffer();
          processQueue();
        });
        sb.addEventListener('error', () => setError('PonsCast source buffer error'));
        sourceBufferRef.current = sb;
        isReadyRef.current = true;
        setIsReady(true);
        setTimeout(processQueue, 0);
      } catch (e) {
        console.error('[PonsCastReceiver] Failed to add SourceBuffer:', e);
        setError(`PonsCast MIME type is not supported: ${resolvedMimeType}`);
      }
    });

    ms.addEventListener('sourceclose', () => {
      isReadyRef.current = false;
      setIsReady(false);
    });
  }, [videoRef, mimeType, cleanup, evictOldBuffer, processQueue]);

  const handleData = useCallback((data: ArrayBuffer) => {
    const frame = parsePonsCastFrame(data);
    if (!frame) return;
    packetQueueRef.current.set(frame.seq, {
      seq: frame.seq,
      timestamp: frame.timestamp,
      data: frame.payload,
      receivedAt: Date.now(),
    });
    processQueue();
  }, [processQueue]);

  useEffect(() => {
    initMSE();
    return cleanup;
  }, [initMSE, cleanup]);

  return {
    handleData,
    isReady,
    error,
    reset: initMSE
  };
};
