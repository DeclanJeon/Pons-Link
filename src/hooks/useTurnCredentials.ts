/**
 * TURN 자격증명 자동 갱신 Hook
 */
import { useEffect, useRef, useCallback } from 'react';
import { useSignalingStore } from '@/stores/useSignalingStore';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { toast } from 'sonner';

interface TurnCredentialsResponse {
  iceServers?: RTCIceServer[];
  ttl?: number;
  timestamp?: number;
  error?: string;
  code?: string;
  quota?: {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
  };
  stats?: {
    connectionCount: number;
    connectionLimit: number;
  };
}

export const useTurnCredentials = () => {
  const renewalTimer = useRef<NodeJS.Timeout>();
  const retryCount = useRef(0);
  const lastCredentials = useRef<TurnCredentialsResponse | null>(null);
  
  const { socket } = useSignalingStore();
  const { updateIceServers } = usePeerConnectionStore();
  
  /**
   * 자격증명 갱신
   */
  const renewCredentials = useCallback(() => {
    if (!socket || !socket.connected) {
      console.warn('[TurnCredentials] Socket not connected, skipping renewal');
      return;
    }
    
    // socket.auth에서 userId 가져오기
    const userId = (socket as any).auth?.userId;
    const roomId = (socket as any).data?.roomId || 'default';
    
    console.log('[TurnCredentials] Requesting new credentials...', { userId, roomId });
    
    socket.emit('request-turn-credentials', { userId, roomId });
    
    const handleCredentials = (data: TurnCredentialsResponse) => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[TurnCredentials] 🔐 TURN Credentials Received');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Response Details:', {
        hasIceServers: !!data.iceServers,
        serverCount: data.iceServers?.length || 0,
        ttl: data.ttl,
        timestamp: data.timestamp,
        error: data.error,
        quota: data.quota,
        stats: data.stats
      });
      
      if (data.iceServers) {
        console.log('📡 ICE Servers Configuration:');
        data.iceServers.forEach((server, index) => {
          console.log(`  [${index + 1}] ${JSON.stringify(server, null, 2)}`);
          if (server.urls) {
            const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
            urls.forEach(url => {
              const isTurn = url.startsWith('turn:') || url.startsWith('turns:');
              const isStun = url.startsWith('stun:');
              console.log(`    ${isTurn ? '🔄 TURN' : isStun ? '🌐 STUN' : '❓'}: ${url}`);
              if (isTurn && server.username) {
                console.log(`    👤 Username: ${server.username}`);
                console.log(`    🔑 Credential: ${server.credential ? '✓ Present' : '✗ Missing'}`);
              }
            });
          }
        });
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      if (data.error) {
        handleError(data);
        return;
      }
      
      if (data.iceServers) {
        // ICE 서버 업데이트
        updateIceServers(data.iceServers);
        lastCredentials.current = data;
        retryCount.current = 0;
        
        // 할당량 경고
        if (data.quota && data.quota.percentage > 80) {
          toast.warning(`TURN quota ${data.quota.percentage.toFixed(1)}% used`);
        }
        
        // TTL의 75%에서 갱신 (안전 마진)
        const ttl = data.ttl || 86400;
        const renewalTime = ttl * 0.75 * 1000;
        
        console.log(`[TurnCredentials] Scheduling renewal in ${renewalTime / 1000}s`);
        
        // 기존 타이머 취소
        if (renewalTimer.current) {
          clearTimeout(renewalTimer.current);
        }
        
        renewalTimer.current = setTimeout(renewCredentials, renewalTime);
        
        // 성공 알림 (첫 요청시만)
        if (retryCount.current === 0 && !lastCredentials.current) {
          toast.success('Relay server connected', { duration: 2000 });
        }
      }
    };
    
    // 일회성 리스너
    socket.once('turn-credentials', handleCredentials);
    
    // 타임아웃 처리
    const timeout = setTimeout(() => {
      socket.off('turn-credentials', handleCredentials);
      handleTimeout();
    }, 5000);
    
    // 응답 받으면 타임아웃 취소
    socket.once('turn-credentials', () => {
      clearTimeout(timeout);
    });
    
  }, [socket, updateIceServers]);
  
  /**
   * 에러 처리
   */
  const handleError = (data: TurnCredentialsResponse) => {
    console.error('[TurnCredentials] Error:', data.error, data.code);
    
    switch (data.code) {
      case 'AUTH_REQUIRED':
        toast.error('Authentication required for TURN server');
        break;
        
      case 'RATE_LIMIT': {
        const retryAfter = (data as { retryAfter?: number }).retryAfter || 60;
        toast.warning(`Rate limited. Retry after ${retryAfter}s`);
        
        // 재시도 스케줄
        renewalTimer.current = setTimeout(renewCredentials, retryAfter * 1000);
        break;
      }
        
      case 'QUOTA_EXCEEDED': {
        toast.error('Daily bandwidth quota exceeded');
        // Fallback to STUN only
        updateIceServers([
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]);
        break;
      }
        
      case 'LIMIT_EXCEEDED':
        toast.error('Connection limit exceeded');
        break;
        
      default:
        toast.error('Failed to get TURN credentials');
        // 재시도
        scheduleRetry();
    }
  };
  
  /**
   * 타임아웃 처리
   */
  const handleTimeout = () => {
    console.warn('[TurnCredentials] Request timeout');
    
    if (lastCredentials.current?.iceServers) {
      // 이전 자격증명 재사용
      console.log('[TurnCredentials] Using cached credentials');
      updateIceServers(lastCredentials.current.iceServers);
    } else {
      // STUN 전용 fallback
      console.log('[TurnCredentials] Falling back to STUN only');
      updateIceServers([
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]);
    }
    
    scheduleRetry();
  };
  
  /**
   * 재시도 스케줄링
   */
  const scheduleRetry = () => {
    retryCount.current++;
    
    if (retryCount.current > 5) {
      console.error('[TurnCredentials] Max retries exceeded');
      toast.error('Unable to connect to relay server');
      return;
    }
    
    // 지수 백오프
    const delay = Math.min(30000, Math.pow(2, retryCount.current) * 1000);
    console.log(`[TurnCredentials] Retrying in ${delay / 1000}s (attempt ${retryCount.current})`);
    
    renewalTimer.current = setTimeout(renewCredentials, delay);
  };
  
  /**
   * 수동 갱신
   */
  const refreshCredentials = useCallback(() => {
    console.log('[TurnCredentials] Manual refresh requested');
    retryCount.current = 0;
    renewCredentials();
  }, [renewCredentials]);
  
  /**
   * 초기화 및 정리
   */
  useEffect(() => {
    if (socket && socket.connected) {
      // 초기 요청
      renewCredentials();
    }
    
    return () => {
      if (renewalTimer.current) {
        clearTimeout(renewalTimer.current);
      }
    };
  }, [socket, renewCredentials]);
  
  return {
    refreshCredentials,
    lastCredentials: lastCredentials.current
  };
};