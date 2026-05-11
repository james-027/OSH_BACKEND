import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import logger from "../config/logger";

/**
 * Log Rotation Service
 * Manages automatic rotation of rate-limit.log and other log files
 * - Rotates when file size exceeds threshold
 - Rotates daily
 * - Archives old logs with timestamp
 * - Optionally compresses archived logs
 */
export class LogRotationService {
  private rotationIntervals: NodeJS.Timeout[] = [];

  /**
   * Initialize log rotation
   * Runs checks every 12 hours
   */
  initializeRotation(): void {
    logger.info("📁 [LOG-ROTATION] Initializing log rotation service");

    // Run initial check immediately
    this.checkAndRotateAllLogs();

    // Then run every 12 hours
    const interval = setInterval(
      () => {
        this.checkAndRotateAllLogs();
      },
      12 * 60 * 60 * 1000,
    );

    this.rotationIntervals.push(interval);
    logger.info(
      "✅ [LOG-ROTATION] Log rotation will run every 12 hours (interval ID: " +
        interval +
        ")",
    );
  }

  /**
   * Check and rotate all log files
   */
  private checkAndRotateAllLogs(): void {
    logger.info("🔄 [LOG-ROTATION] Running rotation check...");

    // Check rate-limit.log
    this.rotateLogIfNeeded("logs/rate-limit.log", {
      maxSize: 50 * 1024 * 1024, // 50MB
      compress: true,
    });

    // Add more log files here as needed
    // this.rotateLogIfNeeded("logs/app.log", { maxSize: 100 * 1024 * 1024 });
  }

  /**
   * Rotate a log file if it exceeds size threshold or is old
   * @param filePath - Path to the log file
   * @param options - Rotation options
   */
  private rotateLogIfNeeded(
    filePath: string,
    options: {
      maxSize?: number; // Default: 50MB
      compress?: boolean; // Default: true
    } = {},
  ): void {
    const maxSize = options.maxSize || 50 * 1024 * 1024; // 50MB default
    const shouldCompress = options.compress !== false;

    try {
      if (!fs.existsSync(filePath)) {
        logger.debug(`📁 [LOG-ROTATION] File not found: ${filePath}`);
        return;
      }

      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      const lastModified = stats.mtime;

      // Check if rotation needed
      const needsRotationBySize = fileSize > maxSize;
      const needsRotationByDate = this.isOlderThanOneDay(lastModified);

      if (needsRotationBySize || needsRotationByDate) {
        this.rotateLog(filePath, shouldCompress);
      } else {
        logger.debug(`📁 [LOG-ROTATION] ${filePath} does not need rotation`);
      }
    } catch (error) {
      logger.error(
        `❌ [LOG-ROTATION] Error checking rotation for ${filePath}:`,
        error,
      );
    }
  }

  /**
   * Perform log rotation
   */
  private rotateLog(filePath: string, compress: boolean = true): void {
    try {
      const dir = path.dirname(filePath);
      const ext = path.extname(filePath);
      const name = path.basename(filePath, ext);

      // Generate archive filename with timestamp
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, -5); // YYYY-MM-DDTHH-mm-ss format
      const archiveName = `${name}-${timestamp}${ext}`;
      const archivePath = path.join(dir, archiveName);

      // Rename current log to archive
      fs.renameSync(filePath, archivePath);
      logger.info(`✅ [LOG-ROTATION] Rotated: ${filePath} → ${archiveName}`);

      // Optionally compress the archived log
      if (compress) {
        this.compressLog(archivePath);
      }

      // Clean up old logs (keep last 10 archives)
      this.cleanupOldLogs(dir, name, ext);
    } catch (error) {
      logger.error(`❌ [LOG-ROTATION] Error rotating ${filePath}:`, error);
    }
  }

  /**
   * Compress a log file using gzip
   */
  private compressLog(filePath: string): void {
    try {
      const gzipPath = `${filePath}.gz`;

      const readStream = fs.createReadStream(filePath);
      const writeStream = fs.createWriteStream(gzipPath);
      const gzip = zlib.createGzip();

      readStream
        .pipe(gzip)
        .pipe(writeStream)
        .on("finish", () => {
          // Delete original after compression
          fs.unlinkSync(filePath);
          logger.info(
            `✅ [LOG-ROTATION] Compressed: ${filePath} → ${gzipPath}`,
          );
        })
        .on("error", (error) => {
          logger.error(
            `❌ [LOG-ROTATION] Error compressing ${filePath}:`,
            error,
          );
        });
    } catch (error) {
      logger.error(`❌ [LOG-ROTATION] Error compressing ${filePath}:`, error);
    }
  }

  /**
   * Remove old log archives, keeping only the most recent
   */
  private cleanupOldLogs(
    dir: string,
    baseName: string,
    ext: string,
    keepCount: number = 10,
  ): void {
    try {
      const files = fs.readdirSync(dir);

      // Find all archive files matching pattern: basename-YYYY-MM-DDTHH-mm-ss.log or .log.gz
      const archiveFiles = files
        .filter(
          (file) =>
            file.startsWith(baseName + "-") &&
            (file.endsWith(ext) || file.endsWith(ext + ".gz")),
        )
        .sort()
        .reverse(); // Most recent first

      // Remove if more than keepCount archives exist
      if (archiveFiles.length > keepCount) {
        const filesToDelete = archiveFiles.slice(keepCount);

        filesToDelete.forEach((file) => {
          const filePath = path.join(dir, file);
          try {
            fs.unlinkSync(filePath);
            logger.info(
              `🗑️ [LOG-ROTATION] Deleted old archive: ${file} (kept last ${keepCount})`,
            );
          } catch (error) {
            logger.error(`❌ [LOG-ROTATION] Failed to delete ${file}:`, error);
          }
        });
      }
    } catch (error) {
      logger.error(
        `❌ [LOG-ROTATION] Error cleaning up old logs in ${dir}:`,
        error,
      );
    }
  }

  /**
   * Check if a date is older than 1 day
   */
  private isOlderThanOneDay(date: Date): boolean {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return date < oneDayAgo;
  }

  /**
   * Gracefully shutdown log rotation
   */
  shutdown(): void {
    logger.info("🛑 [LOG-ROTATION] Shutting down log rotation service");

    this.rotationIntervals.forEach((interval) => {
      clearInterval(interval);
    });

    this.rotationIntervals = [];
    logger.info("✅ [LOG-ROTATION] Log rotation service stopped");
  }

  /**
   * Manually trigger rotation (for testing)
   */
  forceRotation(filePath: string = "logs/rate-limit.log"): void {
    logger.info(`⚡ [LOG-ROTATION] Force rotating: ${filePath}`);
    this.rotateLog(filePath, true);
  }
}

/**
 * Global instance - initialize once per application
 */
let logRotationServiceInstance: LogRotationService | null = null;

export function getLogRotationService(): LogRotationService {
  if (!logRotationServiceInstance) {
    logRotationServiceInstance = new LogRotationService();
  }
  return logRotationServiceInstance;
}

export function initializeLogRotation(): void {
  const service = getLogRotationService();
  service.initializeRotation();
}

export function shutdownLogRotation(): void {
  if (logRotationServiceInstance) {
    logRotationServiceInstance.shutdown();
    logRotationServiceInstance = null;
  }
}
