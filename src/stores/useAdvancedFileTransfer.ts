// src/stores/useAdvancedFileTransfer.ts

import { create } from 'zustand';
import { AdaptiveChunkSizer } from '@/lib/fileTransfer/adaptiveChunking';
import { MultiStreamTransfer } from '@/lib/fileTransfer/multiStreamTransfer';
import { CompressionTransfer } from '@/lib/fileTransfer/compressionTransfer';
import { ReliableTransfer } from '@/lib/fileTransfer/reliableTransfer';
import { TransferPriorityQueue } from '@/lib/fileTransfer/priorityQueue';
import { TransferAnalytics } from '@/lib/fileTransfer/transferAnalytics';

interface AdvancedTransferState {
  chunkSizer: AdaptiveChunkSizer;
  multiStream: MultiStreamTransfer;
  compression: CompressionTransfer;
  reliability: ReliableTransfer;
  queue: TransferPriorityQueue;
  analytics: TransferAnalytics;
}

export const useAdvancedFileTransfer = create<AdvancedTransferState>(() => ({
  chunkSizer: new AdaptiveChunkSizer(),
  multiStream: new MultiStreamTransfer(),
  compression: new CompressionTransfer(),
  reliability: new ReliableTransfer(),
  queue: new TransferPriorityQueue(),
  analytics: new TransferAnalytics(),
}));