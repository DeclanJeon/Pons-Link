import { useChatStore, ChatMessage } from '@/stores/useChatStore';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useChatStore as useChatStoreHook } from '@/stores/useChatStore';
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
  Folder,
  FolderOpen,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatFileSize, formatSpeed, formatETA } from '@/lib/fileTransfer/fileTransferUtils';
import { motion } from 'framer-motion';

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
  const prepareFileHandle = useChatStoreHook(state => (state as any).prepareFileHandle);

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

  const { name, size, type, isFolder, filesCount } = message.fileMeta || {};
  const { progress, isComplete, blobUrl, isCancelled, speed, eta, isAssembling, awaitingHandle, assembleProgress, assemblePhase, finalizeActive, finalizeProgress } = transferProgress;
  const { metrics, isPaused } = activeTransfer || {};

  // Finalizing 관련 상태 계산
  const assembleProgressValue = assembleProgress ?? 0;
  const assemblePhaseValue = assemblePhase ?? 'idle';
  const finalizeActiveValue = finalizeActive ?? false;
  const finalizeProgressValue = finalizeProgress ?? 0;

  // Check if file handle is needed (2GB+ files)
  const needsHandle = Boolean(awaitingHandle && message.fileMeta && message.fileMeta.size >= 2 * 1024 * 1024 * 1024);

  const isFolderMessage = isFolder || type === 'directory';
  const isImageFile = type && type.startsWith('image/') && !isFolderMessage;

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

  return (
    <div className="w-full max-w-md">
      <Card className="p-3 bg-secondary/50 backdrop-blur-sm border-border/50">
        {isImageFile && !isFolderMessage && (message.previewUrl || blobUrl) && (
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
            {isFolderMessage ? (
              <FolderOpen className="w-4 h-4 text-primary" />
            ) : isImageFile ? (
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
              {isFolderMessage ? (
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {filesCount ? `${filesCount} files` : 'Folder'}
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {formatFileSize(size)}
                </span>
              )}
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
        {needsHandle && (
          <div className="mt-2">
            <Button
              size="sm"
              className="w-full h-7 text-[10px]"
              onClick={() => prepareFileHandle(transferKey)}
            >
              Save to disk
            </Button>
          </div>
        )}
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
            
            {/* 어셈블링 진행바 추가 */}
            {(isAssembling || assembleProgressValue > 0) && (
              <div className="space-y-1 mt-1">
                <div className="relative h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.round(assembleProgressValue * 100)}%`, backgroundColor: '#10b981' }} />
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>Assembling ({assemblePhaseValue === 'disk' ? 'Disk' : 'Memory'})</span>
                  <span>{Math.round(assembleProgressValue * 100)}%</span>
                </div>
              </div>
            )}
            
            {/* Finalizing 진행바 추가 */}
            {finalizeActiveValue && (
              <div className="space-y-1 mt-1">
                <div className="relative h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div className="absolute inset-y-0 left-0 rounded-full animate-pulse" style={{ width: `${Math.round(finalizeProgressValue * 100)}%`, backgroundColor: '#a855f7' }} />
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>Finalizing</span>
                  <span>{Math.round(finalizeProgressValue * 100)}%</span>
                </div>
              </div>
            )}
          </div>
        )}
        {!isComplete && !isCancelled && !isAssembling && (
          <div className="space-y-2">
            {isSender && metrics ? (
              <div className="space-y-1">
                {/* ✅ 메인 진행바: 스무딩된 진행률 */}
                <div className="relative h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${ackedProgress}%` }}
                    transition={{
                      type: "spring",
                      stiffness: 100,
                      damping: 20,
                      mass: 0.5
                    }}
                  />
                  
                  {/* ✅ 전송 중인 데이터 표시 (반투명) */}
                  {sentProgress > ackedProgress + 1 && (
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-primary/30"
                      initial={{ width: 0 }}
                      animate={{ width: `${sentProgress}%` }}
                      transition={{
                        type: "spring",
                        stiffness: 80,
                        damping: 15
                      }}
                    />
                  )}
                </div>

                {/* ✅ 상세 정보 */}
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="truncate">
                      {formatFileSize(transferredSize)} / {formatFileSize(size)}
                    </span>
                    <span className="text-[8px] text-muted-foreground/70">
                      ({ackedProgress.toFixed(1)}%)
                    </span>
                  </div>
                  
                  {/* ✅ 대기 중인 청크 표시 */}
                  {metrics.chunksSent > metrics.chunksAcked && (
                    <span className="text-orange-400 text-[8px]">
                      ⏳ {metrics.chunksSent - metrics.chunksAcked} pending
                    </span>
                  )}
                </div>
              </div>
            ) : (
              // 수신자 진행바 (기존과 동일)
              <div className="space-y-1">
                <Progress value={receivedProgress} className="h-2 w-full" />
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span className="truncate">
                    {formatFileSize(transferredSize)} / {formatFileSize(size)}
                  </span>
                  <span className="whitespace-nowrap ml-1">
                    {receivedProgress.toFixed(0)}%
                  </span>
                </div>
              </div>
            )}

            {/* ✅ 속도 및 ETA 표시 (개선) */}
            <div className="flex items-center justify-between text-[9px] text-muted-foreground">
              <div className="flex items-center gap-1">
                {currentSpeed > 0 ? (
                  <>
                    <motion.div
                      className="w-1 h-1 rounded-full bg-green-400"
                      animate={{ scale: [1, 1.5, 1] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                    />
                    <span className="font-medium text-green-400">
                      {formatSpeed(currentSpeed)}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                    <span>Waiting...</span>
                  </>
                )}
              </div>
              
              <span>
                {isFinite(currentEta) && currentEta > 0
                  ? `ETA: ${formatETA(currentEta)}`
                  : 'Calculating...'}
              </span>
              
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
            {isImageFile && !isFolderMessage && blobUrl && !isSender && (
              <Button asChild size="sm" className="w-full h-7 text-[10px]">
                <a href={blobUrl} download={name}>
                  <Download className="w-3 h-3 mr-1" /> Image Download
                </a>
              </Button>
            )}
            {!isImageFile && !isFolderMessage && blobUrl && !isSender && (
              <Button asChild size="sm" className="w-full h-7 text-[10px]">
                <a href={blobUrl} download={name}>
                  <Download className="w-3 h-3 mr-1" /> File Download
                </a>
              </Button>
            )}
            {isFolderMessage && blobUrl && !isSender && (
              <Button asChild size="sm" className="w-full h-7 text-[10px]">
                <a href={blobUrl} download={`${name}.zip`}>
                  <Download className="w-3 h-3 mr-1" /> Folder Download
                </a>
              </Button>
            )}
            {isSender && (
              <div className="text-[10px] text-green-500 flex items-center gap-1 justify-center py-1">
                <CheckCircle className="w-3 h-3" />
                {isFolderMessage ? 'Folder Sent' : 'Send Complete'}
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
