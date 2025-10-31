// frontend/src/lib/analytics.ts (간소화 버전)

/**
 * @fileoverview 실전 GA4 통합 - 최소 구현
 */

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
const IS_ENABLED = import.meta.env.VITE_ENABLE_ANALYTICS === 'true';

class SimpleAnalytics {
  private initialized = false;

  // 초기화 (한 번만)
  init() {
    if (!IS_ENABLED || this.initialized) return;

    // gtag.js 로드
    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    script.async = true;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function(...args: any[]) { window.dataLayer.push(args); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, {
      send_page_view: false, // SPA이므로 수동 제어
      anonymize_ip: true
    });

    this.initialized = true;
    console.log('[Analytics] ✅ Initialized');
  }

  // 1️⃣ 페이지뷰 (가장 기본)
  page(path: string) {
    if (!this.initialized) return;
    window.gtag('event', 'page_view', { page_path: path });
  }

  // 2️⃣ 방 입장 (핵심 전환)
  roomJoin(roomId: string) {
    if (!this.initialized) return;
    window.gtag('event', 'room_join', { room_id: roomId });
  }

  // 3️⃣ 방 퇴장 (체류 시간)
  roomLeave(roomId: string, durationSec: number) {
    if (!this.initialized) return;
    window.gtag('event', 'room_leave', { 
      room_id: roomId, 
      duration: durationSec 
    });
  }

  // 4️⃣ 기능 사용 (사용률 추적)
  feature(name: string) {
    if (!this.initialized) return;
    window.gtag('event', 'feature_use', { feature: name });
  }

  // 5️⃣ 오류 (안정성 모니터링)
  error(message: string, component?: string) {
    if (!this.initialized) return;
    window.gtag('event', 'error', { 
      error_message: message,
      component: component || 'unknown'
    });
  }
}

export const analytics = new SimpleAnalytics();

// TypeScript 타입
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: unknown[]) => void;
  }
}