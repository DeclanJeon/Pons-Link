import { useChatStore, ChatMessage } from '@/stores/useChatStore';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  File,
  Download,
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  Pause,
  Play,
  Loader2,
  Image as ImageIcon,
  Package,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatFileSize, formatSpeed, formatETA } from '@/lib/fileTransferUtils';

interface FileMessageProps {
  message: ChatMessage;
}

type TransferStatus =
  | 'preparing'
  | 'transferring'
  | 'verifying'
  | 'assembling'
  | 'complete'
  | 'paused'
  | 'cancelled'
  | 'error';

export const FileMessage = ({ message }: FileMessageProps) => {
  const transferKey = message.fileMeta?.transferId ?? message.id;
  const isSender = message.senderId === useSessionStore.getState().getSessionInfo()?.userId;

  const transferProgress = useChatStore((state) => state.fileTransfers.get(transferKey));
  const activeTransfer = usePeerConnectionStore((state) => state.activeTransfers.get(transferKey));
  const { pauseFileTransfer, resumeFileTransfer, cancelFileTransfer } = usePeerConnectionStore.getState();

  const [status, setStatus] = useState<TransferStatus>('preparing');

  useEffect(() => {
    if (!transferProgress || !message.fileMeta) return;
    if (transferProgress.isCancelled) {
      setStatus('cancelled');
      return;
    }
    if (transferProgress.isAssembling) {
      setStatus('assembling');
      return;
    }
    if (transferProgress.isComplete) {
      setStatus('complete');
      return;
    }
    if (isSender) {
      const metrics = activeTransfer?.metrics;
      if (activeTransfer?.isPaused) {
        setStatus('paused');
      } else if (metrics && metrics.sendProgress > metrics.progress + 0.05) {
        setStatus('verifying');
      } else {
        setStatus('transferring');
      }
    } else {
      setStatus('transferring');
    }
  }, [isSender, transferProgress, activeTransfer, message.fileMeta]);

  if (!message.fileMeta || !transferProgress) {
    return (
      <div className="w-full max-w-md">
        <Card className="p-3 bg-secondary/50">
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
            <p className="text-xs">File info loading...</p>
          </div>
        </Card>
      </div>
    );
  }

  const { name, size, type } = message.fileMeta;
  const { progress, isComplete, blobUrl, isCancelled, speed, eta, isAssembling } = transferProgress;
  const { metrics, isPaused } = activeTransfer || {};

  const getStatusIcon = () => {
    switch (status) {
      case 'preparing':
        return <Clock className="w-3.5 h-3.5 animate-pulse text-yellow-500 flex-shrink-0" />;
      case 'transferring':
        return isSender ? (
          <Upload className="w-3.5 h-3.5 animate-pulse text-blue-500 flex-shrink-0" />
        ) : (
          <Download className="w-3.5 h-3.5 animate-pulse text-blue-500 flex-shrink-0" />
        );
      case 'verifying':
        return <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500 flex-shrink-0" />;
      case 'assembling':
        return <Package className="w-3.5 h-3.5 animate-pulse text-orange-500 flex-shrink-0" />;
      case 'paused':
        return <Pause className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />;
      case 'complete':
        return <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />;
      case 'cancelled':
        return <X className="w-3.5 h-3.5 text-destructive flex-shrink-0" />;
      default:
        return <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'preparing':
        return 'Preparing...';
      case 'transferring':
        return isSender ? 'Transferring...' : 'Receiving...';
      case 'verifying':
        return 'Verifying...';
      case 'assembling':
        return 'File Assembling...';
      case 'paused':
        return 'Paused';
      case 'complete':
        return 'Complete';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Error';
    }
  };

  const ackedProgress = (metrics?.progress ?? 0) * 100;
  const sentProgress = (metrics?.sendProgress ?? 0) * 100;
  const receivedProgress = progress * 100;

  const transferredSize = isSender ? (metrics?.ackedSize ?? 0) : (progress * size);
  const currentSpeed = isSender ? (metrics?.speed ?? 0) : speed;
  const currentEta = isSender ? (metrics?.eta ?? Infinity) : eta;

  const isImageFile = type.startsWith('image/');

  return (
    <div className="w-full max-w-md">
      <Card className="p-3 bg-secondary/50 backdrop-blur-sm border-border/50">
        {isImageFile && (message.previewUrl || blobUrl) && (
          <div className="mb-3 bg-secondary/30 rounded-lg p-2 overflow-hidden">
            <img
              src={blobUrl || message.previewUrl}
              alt={name}
              className="w-full max-h-48 rounded-md object-contain"
            />
          </div>
        )}
        <div className="flex items-start gap-2 mb-2">
          <div className="flex-shrink-0 p-1.5 bg-primary/10 rounded-lg">
            {isImageFile ? (
              <ImageIcon className="w-4 h-4 text-primary" />
            ) : (
              <File className="w-4 h-4 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-xs font-medium text-foreground break-all line-clamp-2" title={name}>
              {name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {formatFileSize(size)}
              </span>
              <span className="flex items-center gap-1">
                {getStatusIcon()}
                <span className="text-[10px] text-muted-foreground">{getStatusText()}</span>
              </span>
            </div>
          </div>
          {isSender && !isComplete && !isCancelled && !isAssembling && (
            <div className="flex gap-0.5 flex-shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => (isPaused ? resumeFileTransfer(transferKey) : pauseFileTransfer(transferKey))}
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => cancelFileTransfer(transferKey)}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
        {isAssembling && (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 py-3">
              <Package className="w-5 h-5 text-orange-500 animate-pulse" />
              <div className="text-center">
                <p className="text-xs font-medium text-foreground">File Assembling</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Receiving chunks and assembling into a file...</p>
              </div>
            </div>
            <Progress value={100} className="h-1.5 w-full animate-pulse" />
          </div>
        )}
        {!isComplete && !isCancelled && !isAssembling && (
          <div className="space-y-2">
            {isSender && metrics && sentProgress > ackedProgress + 1 ? (
              <div className="space-y-1">
                <div className="relative h-1.5 w-full">
                  <Progress value={sentProgress} className="h-1.5 absolute inset-0 opacity-30" />
                  <Progress value={ackedProgress} className="h-1.5 absolute inset-0" />
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>: {ackedProgress.toFixed(0)}%</span>
                  <span className="text-muted-foreground/70">: {sentProgress.toFixed(0)}%</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <Progress value={isSender ? ackedProgress : receivedProgress} className="h-1.5 w-full" />
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span className="truncate">
                    {formatFileSize(transferredSize)} / {formatFileSize(size)}
                  </span>
                  <span className="whitespace-nowrap ml-1">
                    {(isSender ? ackedProgress : receivedProgress).toFixed(0)}%
                  </span>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between text-[9px] text-muted-foreground">
              <span className={cn('font-medium', currentSpeed > 0 ? 'text-green-400' : 'text-muted-foreground')}>
                {formatSpeed(currentSpeed)}
              </span>
              <span>ETA: {formatETA(currentEta)}</span>
              {isSender && metrics && (
                <span className="text-[8px]">
                  {metrics.chunksAcked}/{metrics.totalChunks}
                </span>
              )}
            </div>
          </div>
        )}
        {isComplete && (
          <div className="space-y-2">
            {isImageFile && blobUrl && !isSender && (
              <Button asChild size="sm" className="w-full h-7 text-[10px]">
                <a href={blobUrl} download={name}>
                  <Download className="w-3 h-3 mr-1" /> Image Download
                </a>
              </Button>
            )}
            {!isImageFile && blobUrl && !isSender && (
              <Button asChild size="sm" className="w-full h-7 text-[10px]">
                <a href={blobUrl} download={name}>
                  <Download className="w-3 h-3 mr-1" /> File Download
                </a>
              </Button>
            )}
            {isSender && (
              <div className="text-[10px] text-green-500 flex items-center gap-1 justify-center py-1">
                <CheckCircle className="w-3 h-3" /> Send Complete
              </div>
            )}
            {isSender && metrics?.averageSpeed && (
              <div className="flex items-center justify-between text-[9px] text-muted-foreground pt-1 border-t border-border/30">
                <span>Average: {formatSpeed(metrics.averageSpeed)}</span>
                <span>{(metrics.totalTransferTime ?? 0).toFixed(1)}</span>
              </div>
            )}
            {!isSender && transferProgress.averageSpeed > 0 && (
              <div className="flex items-center justify-between text-[9px] text-muted-foreground pt-1 border-t border-border/30">
                <span>Average: {formatSpeed(transferProgress.averageSpeed)}</span>
                <span>{(transferProgress.totalTransferTime / 1000).toFixed(1)}</span>
              </div>
            )}
          </div>
        )}
        {isCancelled && (
          <div className="text-[10px] text-destructive flex items-center gap-1 justify-center py-1">
            <AlertCircle className="w-3 h-3" /> Send Cancelled
          </div>
        )}
      </Card>
      <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground mt-1 px-1">
        <span className="truncate max-w-[120px]">{message.senderNickname}</span>
        <span className="whitespace-nowrap">
          {new Date(message.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
};
