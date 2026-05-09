import { describe, expect, it } from 'vitest';
import {
  CAMERA_PRIVACY_OPTIONS,
  getAudioTrackConstraints,
  getOutboundVideoEncodingProfile,
  getVideoTrackConstraints,
} from './mediaQuality';

describe('media quality presets', () => {
  it('builds lower camera constraints for data saver mode', () => {
    expect(getVideoTrackConstraints('data-saver')).toMatchObject({
      width: { ideal: 640, max: 854 },
      height: { ideal: 360, max: 480 },
      frameRate: { ideal: 15, max: 20 },
    });
  });

  it('builds HD camera constraints when requested', () => {
    expect(getVideoTrackConstraints('hd')).toMatchObject({
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30, max: 30 },
    });
  });

  it('disables browser voice processing for original sound', () => {
    expect(getAudioTrackConstraints('original-sound')).toMatchObject({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: { ideal: 2 },
    });
  });

  it('maps video quality presets to outbound sender limits', () => {
    expect(getOutboundVideoEncodingProfile('data-saver')).toMatchObject({
      maxBitrate: 800_000,
      maxFramerate: 20,
      scaleResolutionDownBy: 2,
      degradationPreference: 'maintain-framerate',
    });
    expect(getOutboundVideoEncodingProfile('hd')).toMatchObject({
      maxBitrate: 4_500_000,
      maxFramerate: 30,
      degradationPreference: 'maintain-resolution',
    });
  });

  it('exposes live avatar as a privacy mode', () => {
    expect(CAMERA_PRIVACY_OPTIONS.map((option) => option.value)).toContain('live-avatar');
  });
});
