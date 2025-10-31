import * as React from "react";

export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'large-desktop';

export interface DeviceInfo {
  type: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
}

const MOBILE_BREAKPOINT = 414; // iPhone XR/11 크기까지
const TABLET_BREAKPOINT = 1024; // iPad Landscape 크기까지
const DESKTOP_BREAKPOINT = 1920; // FHD 크기까지

export function useDeviceType(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = React.useState<DeviceInfo | undefined>(undefined);

  React.useEffect(() => {
    const updateDeviceInfo = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const orientation = width > height ? 'landscape' : 'portrait';
      
      let type: DeviceType;
      if (width <= MOBILE_BREAKPOINT) {
        type = 'mobile';
      } else if (width <= TABLET_BREAKPOINT) {
        type = 'tablet';
      } else if (width <= DESKTOP_BREAKPOINT) {
        type = 'desktop';
      } else {
        type = 'large-desktop';
      }

      setDeviceInfo({
        type,
        isMobile: type === 'mobile',
        isTablet: type === 'tablet',
        isDesktop: type === 'desktop',
        isLargeDesktop: type === 'large-desktop',
        width,
        height,
        orientation
      });
    };

    // 초기 설정
    updateDeviceInfo();

    // 이벤트 리스너 등록
    const handleResize = () => updateDeviceInfo();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // 로딩 중 기본값 반환
  return deviceInfo || {
    type: 'desktop',
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isLargeDesktop: false,
    width: 1920,
    height: 1080,
    orientation: 'landscape'
  };
}

// 특정 디바이스 타입에 대한 Tailwind 클래스를 반환하는 유틸리티 함수
export function getResponsiveClasses(deviceInfo: DeviceInfo, classes: {
  mobile?: string;
  tablet?: string;
  desktop?: string;
  largeDesktop?: string;
}): string {
  const { type } = deviceInfo;
  
  switch (type) {
    case 'mobile':
      return classes.mobile || classes.tablet || classes.desktop || classes.largeDesktop || '';
    case 'tablet':
      return classes.tablet || classes.desktop || classes.largeDesktop || '';
    case 'desktop':
      return classes.desktop || classes.largeDesktop || '';
    case 'large-desktop':
      return classes.largeDesktop || '';
    default:
      return '';
  }
}