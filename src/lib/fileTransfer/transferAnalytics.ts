// src/lib/transferAnalytics.ts

interface TransferStats {
  totalBytes: number;
  transferredBytes: number;
  startTime: number;
  endTime?: number;
  averageSpeed: number;
  peakSpeed: number;
  retransmissions: number;
  errors: number;
}

export class TransferAnalytics {
  private stats = new Map<string, TransferStats>();

  startTracking(transferId: string, totalBytes: number) {
    this.stats.set(transferId, {
      totalBytes,
      transferredBytes: 0,
      startTime: Date.now(),
      averageSpeed: 0,
      peakSpeed: 0,
      retransmissions: 0,
      errors: 0,
    });
  }

  updateProgress(transferId: string, bytes: number, speed: number) {
    const stat = this.stats.get(transferId);
    if (!stat) return;

    stat.transferredBytes += bytes;
    stat.peakSpeed = Math.max(stat.peakSpeed, speed);
    
    const elapsed = (Date.now() - stat.startTime) / 1000;
    stat.averageSpeed = stat.transferredBytes / elapsed;
  }

  complete(transferId: string) {
    const stat = this.stats.get(transferId);
    if (!stat) return;

    stat.endTime = Date.now();
  }

  getReport(transferId: string): string {
    const stat = this.stats.get(transferId);
    if (!stat) return 'No data';

    const duration = ((stat.endTime || Date.now()) - stat.startTime) / 1000;

    return `
Transfer Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Duration: ${duration.toFixed(2)}s
Average Speed: ${(stat.averageSpeed / 1024 / 1024).toFixed(2)} MB/s
Peak Speed: ${(stat.peakSpeed / 1024 / 1024).toFixed(2)} MB/s
Retransmissions: ${stat.retransmissions}
Errors: ${stat.errors}
Efficiency: ${((stat.totalBytes / (stat.totalBytes + stat.retransmissions * 1024)) * 100).toFixed(2)}%
    `.trim();
  }
}