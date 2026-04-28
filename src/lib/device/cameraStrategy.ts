import { toast } from 'sonner';

export type CameraFacing = 'user' | 'environment';

export interface CameraInfo {
  deviceId: string;
  label: string;
  facing?: CameraFacing;
}

export class CameraManager {
  private static instance: CameraManager;
  private currentFacing: CameraFacing = 'user';
  private availableCameras: CameraInfo[] = [];
  
  private constructor() {}

  public static getInstance(): CameraManager {
    if (!CameraManager.instance) {
      CameraManager.instance = new CameraManager();
    }
    return CameraManager.instance;
  }

  /**
   * 현재 facing mode 설정 (외부에서 호출 가능)
   */
  public setCurrentFacing(facing: CameraFacing): void {
    this.currentFacing = facing;
  }

 public isMobileDevice(): boolean {
    // 다양한 방법으로 모바일 감지
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = ['android', 'webos', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
    const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
    
    // 터치 지원 확인
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // 화면 크기 확인
    const isSmallScreen = window.innerWidth <= 768;
    
    // 가속도계 등 모바일 센서 확인
    const hasMobileSensors = 'DeviceOrientationEvent' in window;
    
    return isMobileUA || (hasTouch && isSmallScreen) || hasMobileSensors;
  }

  public async detectCameras(): Promise<CameraInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      
      this.availableCameras = cameras.map(camera => {
        const label = camera.label.toLowerCase();
        let facing: CameraFacing | undefined;
        
        if (label.includes('front') || label.includes('user')) {
          facing = 'user';
        } else if (label.includes('back') || label.includes('rear') || label.includes('environment')) {
          facing = 'environment';
        }
        
        return {
          deviceId: camera.deviceId,
          label: camera.label || `Camera ${camera.deviceId.substr(0, 8)}`,
          facing
        };
      });
      
      return this.availableCameras;
    } catch (error) {
      console.error('[CameraManager] Failed to detect cameras:', error);
      return [];
    }
  }

  /**
   * iOS/Safari 호환 카메라 전환
   */
  public async switchCamera(currentStream: MediaStream | null): Promise<MediaStream | null> {
    if (!this.isMobileDevice()) {
      toast.warning('Camera switch is only available on mobile devices');
      return currentStream;
    }

    const newFacing: CameraFacing = this.currentFacing === 'user' ? 'environment' : 'user';
    
    try {
      // 🔑 iOS 호환: ideal constraint 사용
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: newFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };
      
      let newStream: MediaStream;
      
      try {
        newStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (facingError) {
        // Fallback: deviceId로 선택
        console.warn('[CameraManager] facingMode failed, using deviceId');
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(d => d.kind === 'videoinput');
        
        if (cameras.length < 2) {
          throw new Error('Only one camera was detected');
        }
        
        // 현재 카메라 제외
        const currentDeviceId = currentStream?.getVideoTracks()[0]?.getSettings().deviceId;
        const nextCamera = cameras.find(cam => cam.deviceId !== currentDeviceId) || cameras[1];
        
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: nextCamera.deviceId } },
          audio: false
        });
      }
      
      // 오디오 트랙 보존
      const audioTrack = currentStream?.getAudioTracks()[0];
      if (audioTrack && audioTrack.readyState === 'live') {
        newStream.addTrack(audioTrack.clone());
      }
      
      // 이전 비디오 트랙 정리
      currentStream?.getVideoTracks().forEach(track => {
        track.stop();
      });
      
      this.currentFacing = newFacing;
      
      return newStream;
      
    } catch (error: any) {
      console.error('[CameraManager] Switch failed:', error);
      
      if (error.name === 'NotFoundError') {
        toast.error('Camera not found');
      } else if (error.name === 'NotAllowedError') {
        toast.error('Camera permission denied');
      } else {
        toast.error('Camera switch failed');
      }
      
      return currentStream;
    }
  }

  public getCurrentFacing(): CameraFacing {
    return this.currentFacing;
  }

  public getAvailableCameras(): CameraInfo[] {
    return this.availableCameras;
  }

  public hasMultipleCameras(): boolean {
    return this.availableCameras.length > 1;
  }
}

export const cameraManager = CameraManager.getInstance();