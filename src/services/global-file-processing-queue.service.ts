import { Injectable, OnModuleInit } from "@nestjs/common";
import type PQueue from "p-queue"; // Type-only import avoids CommonJS require() at build
import logger from "src/config/logger";

/**
 * Global File Processing Queue Service
 *
 * CRITICAL: Prevents memory explosion with concurrent uploads
 *
 * Problem: Without this, having 20 concurrent users uploading = 20 parallel Sharp instances
 * - Each Sharp allocation: 150MB
 * - 20 × 150MB = 3GB just for compression!
 *
 * Solution: Single global queue limits concurrent file processing to 2
 * - All users' files queue up
 * - Only 2 files compress at a time (300MB max Sharp)
 * - Server stays stable even with 20+ concurrent users
 *
 * Memory per concurrent file: 150MB (Sharp) + overhead = ~200MB per slot
 * Safe concurrency with 4GB: 2 files = 400MB native + 3.6GB heap = safe
 */
@Injectable()
export class GlobalFileProcessingQueueService implements OnModuleInit {
  private static instance: PQueue | null = null;
  private static filesProcessingCount = 0;
  private static totalFilesQueued = 0;
  private static queueWaitTimeMs = 0;

  /**
   * Initializes p-queue asynchronously once during module startup
   */
  async onModuleInit() {
    await GlobalFileProcessingQueueService.initQueue();
  }

  /**
   * Internal queue loader using dynamic import
   */
  static async initQueue(): Promise<PQueue> {
    if (!this.instance) {
      const { default: PQueueClass } = await import("p-queue");
      this.instance = new PQueueClass({
        concurrency: 2,
        timeout: 30000,
      });

      logger.info(
        `[GLOBAL QUEUE] Initialized - Concurrency: 2 | Max concurrent file processing: 2 (300MB native Sharp allocation)`,
      );
    }
    return this.instance;
  }

  /**
   * Synchronously get the initialized global file processing queue
   */
  static getInstance(): PQueue {
    if (!this.instance) {
      throw new Error(
        "[GLOBAL QUEUE] Queue not initialized yet. Ensure GlobalFileProcessingQueueService onModuleInit has executed.",
      );
    }
    return this.instance;
  }

  /**
   * Get current queue metrics synchronously
   */
  static getQueueMetrics() {
    const instance = this.getInstance();
    const systemInfo = process.memoryUsage();
    const totalMem = require("os").totalmem();
    const freeMem = require("os").freemem();

    return {
      queueSize: instance.size,
      queuePending: instance.pending,
      filesProcessing: this.filesProcessingCount,
      totalFilesQueued: this.totalFilesQueued,
      avgWaitTimeMs: this.queueWaitTimeMs,
      memory: {
        heapUsed: (systemInfo.heapUsed / 1024 / 1024).toFixed(2),
        heapTotal: (systemInfo.heapTotal / 1024 / 1024).toFixed(2),
        rss: (systemInfo.rss / 1024 / 1024).toFixed(2),
        external: (systemInfo.external / 1024 / 1024).toFixed(2),
      },
      system: {
        totalGB: (totalMem / 1024 / 1024 / 1024).toFixed(2),
        freeGB: (freeMem / 1024 / 1024 / 1024).toFixed(2),
        usedGB: ((totalMem - freeMem) / 1024 / 1024 / 1024).toFixed(2),
        usagePercent: (((totalMem - freeMem) / totalMem) * 100).toFixed(1),
      },
    };
  }

  /**
   * Track file being added to queue
   */
  static onFileQueued(uploadId: string, fileIndex: number, totalFiles: number) {
    this.totalFilesQueued++;
    const queue = this.getInstance();
    // Debug flag: UPLOAD_DEBUG=true in .env to enable detailed file-level logging
    if (process.env.UPLOAD_DEBUG === "true") {
      logger.debug(
        `[FILE QUEUED] Upload: ${uploadId} | File: ${fileIndex + 1}/${totalFiles} | Queue size: ${queue.size} | Pending: ${queue.pending}`,
      );
    }
  }

  /**
   * Track file starting processing
   */
  static onFileProcessingStart(uploadId: string, fileIndex: number) {
    this.filesProcessingCount++;
    // Debug flag: UPLOAD_DEBUG=true in .env to enable detailed file-level logging
    if (process.env.UPLOAD_DEBUG === "true") {
      logger.debug(
        `[FILE PROCESSING START] Upload: ${uploadId} | File: ${fileIndex + 1} | Concurrent files: ${this.filesProcessingCount}`,
      );
    }
  }

  /**
   * Track file completed processing
   */
  static onFileProcessingComplete(
    uploadId: string,
    fileIndex: number,
    processingTimeMs: number,
  ) {
    this.filesProcessingCount--;
    this.queueWaitTimeMs = (this.queueWaitTimeMs + processingTimeMs) / 2; // Rolling average
    const queue = this.getInstance();
    // Debug flag: UPLOAD_DEBUG=true in .env to enable detailed file-level logging
    if (process.env.UPLOAD_DEBUG === "true") {
      logger.debug(
        `[FILE PROCESSING COMPLETE] Upload: ${uploadId} | File: ${fileIndex + 1} | Time: ${processingTimeMs}ms | Queue pending: ${queue.pending} | Concurrent: ${this.filesProcessingCount}`,
      );
    }
  }

  /**
   * Get queue status for logging
   */
  static getQueueStatus(): string {
    const queue = this.getInstance();
    return `Queue: [Size: ${queue.size} | Pending: ${queue.pending} | Processing: ${this.filesProcessingCount}]`;
  }
}
