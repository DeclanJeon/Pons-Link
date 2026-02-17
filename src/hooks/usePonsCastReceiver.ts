import { useRef, useCallback, useEffect, useState } from 'react';

interface UsePonsCastReceiverProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  mimeType?: string;
  jitterBufferMs?: number;
}

interface Packet {
  seq: number;
  timestamp: number;
  data: ArrayBuffer;
}

export const usePonsCastReceiver = ({
  videoRef,
  mimeType = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
  jitterBufferMs = 1500
}: UsePonsCastReceiverProps) => {
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const packetQueueRef = useRef<Map<number, Packet>>(new Map());
  const nextSeqRef = useRef<number>(-1);
  const isUpdatingRef = useRef<boolean>(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    if (mediaSourceRef.current && mediaSourceRef.current.readyState === 'open') {
      try {
        if (sourceBufferRef.current) {
          mediaSourceRef.current.removeSourceBuffer(sourceBufferRef.current);
        }
        mediaSourceRef.current.endOfStream();
      } catch (e) {
        console.warn('[PonsCastReceiver] Error during cleanup:', e);
      }
    }
    mediaSourceRef.current = null;
    sourceBufferRef.current = null;
    packetQueueRef.current.clear();
    nextSeqRef.current = -1;
    isUpdatingRef.current = false;
    setIsReady(false);
  }, []);

  const initMSE = useCallback(() => {
    if (!videoRef.current) return;

    cleanup();

    const ms = new MediaSource();
    mediaSourceRef.current = ms;
    videoRef.current.src = URL.createObjectURL(ms);

    ms.addEventListener('sourceopen', () => {
      console.log('[PonsCastReceiver] MediaSource opened');
      try {
        const sb = ms.addSourceBuffer(mimeType);
        sb.mode = 'sequence'; 
        
        sb.addEventListener('updateend', () => {
          isUpdatingRef.current = false;
          processQueue();
        });

        sb.addEventListener('error', (e) => {
          console.error('[PonsCastReceiver] SourceBuffer error:', e);
          setError('SourceBuffer error');
        });

        sourceBufferRef.current = sb;
        setIsReady(true);
      } catch (e) {
        console.error('[PonsCastReceiver] Failed to add SourceBuffer:', e);
        setError(`MIME type not supported: ${mimeType}`);
      }
    });

    ms.addEventListener('sourceclose', () => {
      console.log('[PonsCastReceiver] MediaSource closed');
      setIsReady(false);
    });
  }, [videoRef, mimeType, cleanup]);

  const processQueue = useCallback(() => {
    if (!sourceBufferRef.current || isUpdatingRef.current || !isReady) return;

    const sequences = Array.from(packetQueueRef.current.keys()).sort((a, b) => a - b);
    
    if (sequences.length === 0) return;

    if (nextSeqRef.current === -1) {
      nextSeqRef.current = sequences[0];
    }

    const packet = packetQueueRef.current.get(nextSeqRef.current);
    
    if (packet) {
      try {
        isUpdatingRef.current = true;
        sourceBufferRef.current.appendBuffer(packet.data);
        packetQueueRef.current.delete(nextSeqRef.current);
        nextSeqRef.current++;
        
        const MAX_QUEUE_SIZE = 30;
        if (packetQueueRef.current.size > MAX_QUEUE_SIZE) {
          console.warn('[PonsCastReceiver] Queue too large, skipping to latest');
          const latestSeq = Math.max(...Array.from(packetQueueRef.current.keys()));
          
          for (const seq of packetQueueRef.current.keys()) {
            if (seq < latestSeq - 5) {
              packetQueueRef.current.delete(seq);
            }
          }
          nextSeqRef.current = latestSeq - 5;
        }
      } catch (e) {
        console.error('[PonsCastReceiver] Failed to append buffer:', e);
        isUpdatingRef.current = false;
      }
    } else {
      const firstAvailable = sequences[0];
      const DISCONTINUITY_THRESHOLD = 10;
      if (firstAvailable > nextSeqRef.current + DISCONTINUITY_THRESHOLD) {
        console.warn(`[PonsCastReceiver] Discontinuity detected. Expected ${nextSeqRef.current}, got ${firstAvailable}. Skipping.`);
        nextSeqRef.current = firstAvailable;
        processQueue();
      }
    }
  }, [isReady]);

  const handleData = useCallback((data: ArrayBuffer) => {
    if (data.byteLength < 13) return;

    const view = new DataView(data);
    const type = view.getUint8(0);
    
    if (type !== 9) return;

    const seq = view.getUint32(1);
    const timestamp = view.getFloat64(5);
    const packetData = data.slice(13);

    packetQueueRef.current.set(seq, { seq, timestamp, data: packetData });
    
    if (!isUpdatingRef.current) {
      processQueue();
    }
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
