// src/lib/media/adaptiveQuality.ts

export interface VideoQualityConfig {
  width: number;
  height: number;
  frameRate: number;
  bitrate: number;
}

export const getOptimalVideoQuality = (
  isMobile: boolean,
  networkQuality: 'excellent' | 'good' | 'moderate' | 'poor',
  batteryLevel?: number
): VideoQualityConfig => {
  // 배터리 절약 모드 감지
  const isLowPower = batteryLevel !== undefined && batteryLevel < 20;
  
  if (isMobile) {
    // 모바일 + 낮은 네트워크 품질
    if (networkQuality === 'poor' || isLowPower) {
      return {
        width: 480,
        height: 640, // 세로 모드 기준
        frameRate: 15,
        bitrate: 500000 // 500 Kbps
      };
    }
    
    // 모바일 + 보통 네트워크
    if (networkQuality === 'moderate') {
      return {
        width: 720,
        height: 960,
        frameRate: 24,
        bitrate: 1000000 // 1 Mbps
      };
    }
    
    // 모바일 + 좋은 네트워크
    return {
      width: 1080,
      height: 1440,
      frameRate: 30,
      bitrate: 2000000 // 2 Mbps
    };
  }
  
  // 데스크톱 설정 (기존 로직)
  return {
    width: 1280,
    height: 720,
    frameRate: 30,
    bitrate: 2500000
  };
};
