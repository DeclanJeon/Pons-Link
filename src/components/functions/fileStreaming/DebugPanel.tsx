import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, XCircle, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DebugInfo {
  canvasReady: boolean;
  streamCreated: boolean;
  streamActive: boolean;
  trackCount: number;
  peersConnected: number;
  videoState: string;
  videoTime: number;
  fps: number;
  frameDrops: number;
  audioEnabled: boolean;
  errors: string[];
  // iOS 관련
  isIOS: boolean;
  streamingStrategy: string;
  deviceInfo: string;
  // 네트워크 및 혼잡 제어 정보
  networkQuality?: 'excellent' | 'good' | 'fair' | 'poor';
  averageRTT?: number;
  rttVariance?: number;
  congestionWindow?: number;
  inSlowStart?: boolean;
  bufferedAmount?: number;
  transferSpeed?: number;
}

interface DebugPanelProps {
  debugInfo: DebugInfo;
}

export const DebugPanel = ({ debugInfo }: DebugPanelProps) => {
  const getStatusIcon = (status: boolean) => {
    return status ? 
      <CheckCircle className="w-3 h-3 text-green-500" /> : 
      <XCircle className="w-3 h-3 text-red-500" />;
  };
  
  const getStatusBadge = (label: string, value: any, type: 'success' | 'error' | 'warning' | 'default' = 'default') => {
    return (
      <Badge variant={type === 'success' ? 'default' : type === 'error' ? 'destructive' : 'secondary'} className="text-xs">
        {label}: {value}
      </Badge>
    );
  };
  
  return (
    <Alert className="m-4">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        <div className="space-y-3">
          {/* iOS 정보 */}
          {debugInfo.isIOS && (
            <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950 rounded">
              <Smartphone className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                iOS Device Detected
              </span>
              <Badge variant="outline" className="text-xs">
                Strategy: {debugInfo.streamingStrategy}
              </Badge>
            </div>
          )}
          
          {/* Stream Status Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="flex items-center gap-2">
              {getStatusIcon(debugInfo.canvasReady)}
              <span>Canvas Ready</span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(debugInfo.streamCreated)}
              <span>Stream Created</span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(debugInfo.streamActive)}
              <span>Stream Active</span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(debugInfo.audioEnabled)}
              <span>Audio Enabled</span>
            </div>
          </div>
          
          {/* Metrics */}
          <div className="flex flex-wrap gap-2">
            {getStatusBadge('Tracks', debugInfo.trackCount)}
            {getStatusBadge('Peers', debugInfo.peersConnected,
              debugInfo.peersConnected > 0 ? 'success' : 'warning')}
            {getStatusBadge('FPS', debugInfo.fps,
              debugInfo.fps > 20 ? 'success' : debugInfo.fps > 10 ? 'warning' : 'error')}
            {getStatusBadge('Drops', debugInfo.frameDrops,
              debugInfo.frameDrops > 100 ? 'error' : 'default')}
            {debugInfo.isIOS && getStatusBadge('iOS', 'Optimized', 'success')}
          </div>
          
          {/* 네트워크 상태 */}
          {(debugInfo.networkQuality || debugInfo.averageRTT !== undefined) && (
            <div className="space-y-2">
              <div className="font-semibold text-xs">Network Status</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {debugInfo.networkQuality && (
                  <div className="flex items-center gap-2">
                    <span>Quality:</span>
                    <Badge variant={
                      debugInfo.networkQuality === 'excellent' ? 'default' :
                      debugInfo.networkQuality === 'good' ? 'default' :
                      debugInfo.networkQuality === 'fair' ? 'secondary' : 'destructive'
                    } className="text-xs">
                      {debugInfo.networkQuality}
                    </Badge>
                  </div>
                )}
                {debugInfo.averageRTT !== undefined && (
                  <div className="flex items-center gap-2">
                    <span>RTT:</span>
                    <Badge variant={
                      debugInfo.averageRTT < 50 ? 'default' :
                      debugInfo.averageRTT < 150 ? 'default' :
                      debugInfo.averageRTT < 300 ? 'secondary' : 'destructive'
                    } className="text-xs">
                      {debugInfo.averageRTT.toFixed(0)}ms
                    </Badge>
                  </div>
                )}
                {debugInfo.rttVariance !== undefined && (
                  <div className="flex items-center gap-2">
                    <span>Stability:</span>
                    <Badge variant={
                      debugInfo.rttVariance < 10 ? 'default' :
                      debugInfo.rttVariance < 50 ? 'default' :
                      debugInfo.rttVariance < 100 ? 'secondary' : 'destructive'
                    } className="text-xs">
                      {debugInfo.rttVariance < 10 ? 'Excellent' :
                       debugInfo.rttVariance < 50 ? 'Good' :
                       debugInfo.rttVariance < 100 ? 'Fair' : 'Poor'}
                    </Badge>
                  </div>
                )}
                {debugInfo.congestionWindow !== undefined && (
                  <div className="flex items-center gap-2">
                    <span>Window:</span>
                    <Badge variant={
                      debugInfo.congestionWindow > 32 ? 'default' :
                      debugInfo.congestionWindow > 16 ? 'default' :
                      debugInfo.congestionWindow > 8 ? 'secondary' : 'destructive'
                    } className="text-xs">
                      {debugInfo.congestionWindow}
                    </Badge>
                  </div>
                )}
                {debugInfo.inSlowStart !== undefined && (
                  <div className="flex items-center gap-2">
                    <span>Phase:</span>
                    <Badge variant={debugInfo.inSlowStart ? 'default' : 'secondary'} className="text-xs">
                      {debugInfo.inSlowStart ? 'Slow Start' : 'Congestion Avoidance'}
                    </Badge>
                  </div>
                )}
                {debugInfo.bufferedAmount !== undefined && (
                  <div className="flex items-center gap-2">
                    <span>Buffer:</span>
                    <Badge variant={
                      debugInfo.bufferedAmount < 128 * 1024 ? 'default' :
                      debugInfo.bufferedAmount < 256 * 1024 ? 'default' :
                      debugInfo.bufferedAmount < 512 * 1024 ? 'secondary' : 'destructive'
                    } className="text-xs">
                      {(debugInfo.bufferedAmount / 1024).toFixed(0)}KB
                    </Badge>
                  </div>
                )}
                {debugInfo.transferSpeed !== undefined && (
                  <div className="flex items-center gap-2">
                    <span>Speed:</span>
                    <Badge variant={
                      debugInfo.transferSpeed > 10 * 1024 * 1024 ? 'default' :
                      debugInfo.transferSpeed > 5 * 1024 * 1024 ? 'default' :
                      debugInfo.transferSpeed > 1024 * 1024 ? 'secondary' : 'destructive'
                    } className="text-xs">
                      {(debugInfo.transferSpeed / 1024 / 1024).toFixed(1)}MB/s
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Video State */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs">Video:</span>
              <Badge variant="outline" className="text-xs">
                {debugInfo.videoState}
              </Badge>
              <span className="text-xs text-muted-foreground">
                @ {debugInfo.videoTime.toFixed(2)}s
              </span>
            </div>
          </div>
          
          {/* Strategy Info */}
          {debugInfo.streamingStrategy && (
            <div className="text-xs">
              <span className="font-semibold">Strategy:</span> {debugInfo.streamingStrategy}
            </div>
          )}
          
          {/* Recent Errors */}
          {debugInfo.errors.length > 0 && (
            <div className="space-y-1">
              <div className="font-semibold text-xs text-red-500">Recent Errors:</div>
              <div className="space-y-0.5">
                {debugInfo.errors.map((err, i) => (
                  <div key={i} className="text-xs text-red-500 font-mono bg-red-50 dark:bg-red-950/20 px-2 py-1 rounded">
                    {err}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};
