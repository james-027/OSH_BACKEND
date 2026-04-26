import { Injectable } from "@nestjs/common";
import logger from "src/config/logger";
import { GlobalFileProcessingQueueService } from "./global-file-processing-queue.service";

interface UploadSession {
  uploadId: string;
  transNumber: string;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  startTime: number;
  lastCheckTime: number;
}

/**
 * Enhanced logging service for upload progress
 * Provides clear, concise, hierarchical logging without DEBUG spam
 */
@Injectable()
export class UploadProgressLoggerService {
  private activeSessions = new Map<string, UploadSession>();

  /**
   * Log when user upload begins
   * Shows: User ID, total files, initial memory, queue status
   */
  logUploadStarted(
    uploadId: string,
    totalFiles: number,
    userId: number,
    initialMemory?: { heap: string; rss: string },
  ): void {
    const queueMetrics = GlobalFileProcessingQueueService.getQueueMetrics();
    const memStats = this.formatMemory(queueMetrics.memory);
    const systemRam = this.formatSystemRam(queueMetrics.system);
    const concurrentUploads = queueMetrics.filesProcessing; // Approximation

    const sessionInfo = {
      uploadId,
      userId,
      totalFiles,
      queueSize: queueMetrics.queueSize,
      queuePending: queueMetrics.queuePending,
      activeCompressions: queueMetrics.filesProcessing,
      systemRAM: systemRam,
      memory: memStats,
    };

    logger.info(`
╔═══════════════════════════════════════════════════════════════════════════╗
║ 🚀 UPLOAD STARTED                                                         ║
╠═══════════════════════════════════════════════════════════════════════════╣
║ User ID        : ${this.padRight(`User #${userId}`, 60)}
║ Upload ID      : ${this.padRight(uploadId, 60)}
║ Total Files    : ${this.padRight(totalFiles.toString(), 60)}
║                                                                           
║ INITIAL MEMORY STATE                                                      
║ ├─ Heap Used       : ${this.padRight(initialMemory?.heap || "N/A", 57)}
║ ├─ RSS             : ${this.padRight(initialMemory?.rss || "N/A", 57)}
║                                                                           
║ GLOBAL QUEUE STATUS                                                       
║ ├─ Queue Size      : ${this.padRight(queueMetrics.queueSize.toString(), 57)}
║ ├─ Pending Tasks   : ${this.padRight(queueMetrics.queuePending.toString(), 57)}
║ ├─ Active Files    : ${this.padRight(queueMetrics.filesProcessing.toString(), 57)}
║ └─ Max Concurrent  : 2                                                    
║                                                                           
║ SYSTEM MEMORY                                                             
║ └─ System RAM      : ${this.padRight(systemRam.used, 57)}
╚═══════════════════════════════════════════════════════════════════════════╝
    `);

    // Track session
    this.activeSessions.set(uploadId, {
      uploadId,
      transNumber: "",
      totalFiles,
      processedFiles: 0,
      failedFiles: 0,
      startTime: Date.now(),
      lastCheckTime: Date.now(),
    });
  }

  /**
   * Log batch processing begun with requirement details
   * Shows: Trans number, stores, database prep
   */
  logBatchStarted(
    uploadId: string,
    transNumber: string,
    totalStores: number,
    filesCount: number,
    memoryStats?: { heapUsed: string; rss: string },
  ): void {
    logger.info(`
╭─────────────────────────────────────────────────────────────────────────╮
│ 📋 BATCH STARTED                                                        │
├──────────────────────────────────────────────────────────────────────────┤
│ Transaction    : ${this.padRight(transNumber, 56)}
│ Upload ID      : ${this.padRight(uploadId, 56)}
│ Files to Upload: ${this.padRight(`${filesCount}`, 56)}
│ Stores Needed  : ${this.padRight(`${totalStores}`, 56)}
│ Heap: ${memoryStats?.heapUsed || "N/A"} | RSS: ${memoryStats?.rss || "N/A"}
╰─────────────────────────────────────────────────────────────────────────╯
    `);

    // Update session
    const session = this.activeSessions.get(uploadId);
    if (session) {
      session.transNumber = transNumber;
    }
  }

  /**
   * Log progress checkpoint every 5 files
   * Shows: Progress %, memory snapshot, queue backlog, estimated time
   */
  logProgressCheckpoint(
    uploadId: string,
    filesProcessed: number,
    totalFiles: number,
    successCount: number,
    failedCount: number,
    avgWaitTimeMs?: number,
    memoryStats?: { heapUsed: string; rss: string },
  ): void {
    const queueMetrics = GlobalFileProcessingQueueService.getQueueMetrics();
    const percentComplete = Math.round((filesProcessed / totalFiles) * 100);
    const estimatedRemaining = this.estimateTimeRemaining(
      filesProcessed,
      totalFiles,
      uploadId,
    );

    const progressBar = this.createProgressBar(percentComplete);
    const queueStatus = this.getQueueCongestionStatus(
      queueMetrics.queuePending,
    );

    logger.info(`
    ┌─ PROGRESS: ${progressBar} ${percentComplete}% (${filesProcessed}/${totalFiles})
    │ Upload ID  : ${this.padRight(uploadId, 56)}
    │ Heap: ${memoryStats?.heapUsed || "N/A"} | RSS: ${memoryStats?.rss || "N/A"} | Success: ${successCount} | Failed: ${failedCount}
    │ Status     : ${queueStatus}
    │ Queue Wait : ${avgWaitTimeMs?.toFixed(0) || "N/A"}ms avg
    │ Est. Time  : ${estimatedRemaining}
    └─ Global Queue: Size=${queueMetrics.queueSize}, Pending=${queueMetrics.queuePending}, Active=${queueMetrics.filesProcessing}
    `);

    // Update session
    const session = this.activeSessions.get(uploadId);
    if (session) {
      session.processedFiles = filesProcessed;
      session.failedFiles = failedCount;
      session.lastCheckTime = Date.now();
    }
  }

  /**
   * Log batch completion with summary
   * Shows: Total files, success rate, duration, memory details
   */
  logBatchCompleted(
    uploadId: string,
    transNumber: string,
    totalFiles: number,
    successCount: number,
    failedCount: number,
    durationMs: number,
    heapDelta: number,
    rssDelta: number,
    memoryStats?: { heapUsed: string; rss: string },
  ): void {
    const queueMetrics = GlobalFileProcessingQueueService.getQueueMetrics();
    const successRate = ((successCount / totalFiles) * 100).toFixed(1);
    const durationSec = (durationMs / 1000).toFixed(2);
    const avgTimePerFile = (durationMs / totalFiles).toFixed(0);
    const memStats = this.formatMemory(queueMetrics.memory);
    const systemRam = this.formatSystemRam(queueMetrics.system);

    const statusIcon = failedCount === 0 ? "✅" : "⚠️";

    logger.info(`
╔═══════════════════════════════════════════════════════════════════════════╗
║ ${statusIcon} BATCH COMPLETED                                             ║
╠═══════════════════════════════════════════════════════════════════════════╣
║ Upload ID      : ${this.padRight(uploadId, 60)}
║ Transaction    : ${this.padRight(transNumber, 60)}
║ Files          : ${this.padRight(`${successCount}/${totalFiles} (${successRate}% success)`, 60)}
║ Duration       : ${this.padRight(`${durationSec}s (${avgTimePerFile}ms per file)`, 60)}
║
║ MEMORY STATE                                                      
║ ├─ Heap Used       : ${this.padRight(memoryStats?.heapUsed || "N/A", 57)}
║ ├─ RSS             : ${this.padRight(memoryStats?.rss || "N/A", 57)}
║                                                                           
║ MEMORY DELTA (before → after)                                             
║ ├─ Heap  : ${this.padRight(`${heapDelta > 0 ? "+" : ""}${heapDelta.toFixed(2)}MB`, 58)}
║ ├─ RSS   : ${this.padRight(`${rssDelta > 0 ? "+" : ""}${rssDelta.toFixed(2)}MB`, 58)}
║ └─ Sys   : ${this.padRight(systemRam.used, 58)}
║                                                                           
║ GLOBAL QUEUE AFTER BATCH                                                  
║ ├─ Queued    : ${this.padRight(queueMetrics.queueSize.toString(), 57)}
║ ├─ Pending   : ${this.padRight(queueMetrics.queuePending.toString(), 57)}
║ └─ Processing: ${this.padRight(queueMetrics.filesProcessing.toString(), 57)}
╚═══════════════════════════════════════════════════════════════════════════╝
    `);
  }

  /**
   * Log when entire upload completes
   * Shows: Final stats, total duration, overall health
   */
  logUploadCompleted(
    uploadId: string,
    transNumber: string,
    totalFiles: number,
    successCount: number,
    failedCount: number,
    totalDurationMs: string,
    memoryStats?: { heapUsed: string; rss: string },
  ): void {
    const session = this.activeSessions.get(uploadId);
    // const totalDurationSec = (totalDurationMs / 1000).toFixed(2);
    const successRate = ((successCount / totalFiles) * 100).toFixed(1);
    const queueMetrics = GlobalFileProcessingQueueService.getQueueMetrics();

    const statusEmoji = failedCount === 0 ? "🎉" : "⚠️";

    logger.info(`
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ${statusEmoji} UPLOAD COMPLETED                                                                                               ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                        
┃ Upload    : ${this.padRight(uploadId, 58)}
┃ Trans     : ${this.padRight(transNumber, 58)}
┃ Result    : ${this.padRight(`${successCount}/${totalFiles} files (${successRate}% success)`, 58)}
┃ Total Time: ${this.padRight(`${totalDurationMs}s`, 58)}
┃
┃ Heap      : ${this.padRight(memoryStats?.heapUsed || "N/A", 57)}
┃ RSS       : ${this.padRight(memoryStats?.rss || "N/A", 57)}
┃                                                                       
┃ Queue Status: Size=${queueMetrics.queueSize}, Pending=${queueMetrics.queuePending}
┃ Your upload freed resources. Queue processing other uploads...      
┃                                                                       
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    `);

    // Remove session
    this.activeSessions.delete(uploadId);
  }

  /**
   * Log summary of all active uploads
   * Call periodically or on demand
   */
  logActiveSummary(): void {
    if (this.activeSessions.size === 0) {
      logger.info("📊 No active uploads");
      return;
    }

    const queueMetrics = GlobalFileProcessingQueueService.getQueueMetrics();

    let summary = "\n📊 ACTIVE UPLOADS SUMMARY\n";
    summary += "┌" + "─".repeat(75) + "┐\n";

    this.activeSessions.forEach((session) => {
      const progress = (
        (session.processedFiles / session.totalFiles) *
        100
      ).toFixed(0);
      const elapsed = ((Date.now() - session.startTime) / 1000).toFixed(1);
      summary += `│ ${session.transNumber.padEnd(15)} │ Progress: ${progress}% (${session.processedFiles}/${session.totalFiles}) │ ${elapsed}s\n`;
    });

    summary += "├" + "─".repeat(75) + "┤\n";
    summary += `│ Global Queue: ${queueMetrics.queueSize} queued | ${queueMetrics.queuePending} pending | ${queueMetrics.filesProcessing} processing       ${" ".repeat(Math.max(0, 35 - queueMetrics.queueSize.toString().length))} │\n`;
    summary += "└" + "─".repeat(75) + "┘\n";

    logger.info(summary);
  }

  /**
   * Create visual progress bar
   */
  private createProgressBar(percentage: number, width = 20): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return `[${`█`.repeat(filled)}${`░`.repeat(empty)}]`;
  }

  /**
   * Get queue congestion status
   */
  private getQueueCongestionStatus(queuePending: number): string {
    if (queuePending === 0) return "✅ Queue idle - fast processing";
    if (queuePending <= 5) return "🟢 Queue normal - slight backing";
    if (queuePending <= 15) return "🟡 Queue building - moderate queue";
    if (queuePending <= 30) return "🟠 Queue backlog - significant wait";
    return "🔴 Queue congested - high wait times";
  }

  /**
   * Estimate time remaining
   */
  private estimateTimeRemaining(
    processed: number,
    total: number,
    uploadId: string,
  ): string {
    const session = this.activeSessions.get(uploadId);
    if (!session || processed === 0) return "calculating...";

    const elapsedMs = Date.now() - session.startTime;
    const avgTimePerFile = elapsedMs / processed;
    const remainingFiles = total - processed;
    const estimatedMs = avgTimePerFile * remainingFiles;

    return this.formatDuration(estimatedMs);
  }

  /**
   * Format duration to human readable
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  /**
   * Format memory stats
   */
  private formatMemory(memory: any): {
    heapUsed: string;
    rss: string;
    external: string;
  } {
    return {
      heapUsed: `${(memory.heapUsed / 1024 / 1024).toFixed(1)}MB`,
      rss: `${(memory.rss / 1024 / 1024).toFixed(1)}MB`,
      external: `${(memory.external / 1024 / 1024).toFixed(1)}MB`,
    };
  }

  /**
   * Format system RAM
   */
  private formatSystemRam(system: any): {
    total: string;
    free: string;
    used: string;
  } {
    return {
      total: `${system.totalGB}GB`,
      free: `${system.freeGB}GB`,
      used: `${system.usedGB}/${system.totalGB}GB (${system.usagePercent}%)`,
    };
  }

  /**
   * Pad string for table formatting
   */
  private padRight(text: string, width: number): string {
    return text.length > width
      ? text.substring(0, width - 3) + "..."
      : text.padEnd(width - 1);
  }

  /**
   * Get active upload count
   */
  getActiveUploadCount(): number {
    return this.activeSessions.size;
  }

  /**
   * Get active upload IDs
   */
  getActiveUploadIds(): string[] {
    return Array.from(this.activeSessions.keys());
  }
}
