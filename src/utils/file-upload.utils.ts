// Reusable file upload utilities for both Express and Fastify

import * as fs from "fs";
import * as path from "path";
import sharp = require("sharp");
import logger from "src/config/logger";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

/**
 * Excel file filter - validates that uploaded file is .xlsx or .xls
 */
export function excelFileFilter(
  req: any,
  file: any,
  cb: (error: Error | null, acceptFile: boolean) => void,
): void {
  if (!file.originalname.match(/\.(xlsx|xls)$/)) {
    return cb(new Error("Only Excel files are allowed!"), false);
  }
  cb(null, true);
}

/**
 * Image file filter - validates common image formats
 */
export function imageFileFilter(
  req: any,
  file: any,
  cb: (error: Error | null, acceptFile: boolean) => void,
): void {
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
    return cb(new Error("Only image files are allowed!"), false);
  }
  cb(null, true);
}

/**
 * Generates timestamped filename
 */
export function generateTimestampFilename(
  req: any,
  file: any,
  cb: (error: Error | null, filename: string) => void,
): void {
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  // const ext = file.originalname.split(".").pop();
  const ext = path.extname(file.originalname);
  cb(null, `${unique}${ext}`);
}

/**
 * Generates timestamped filename
 */
export function generateTimestampFilename2(
  req: any,
  file: any,
  cb: (error: Error | null, filename: string) => void,
): void {
  cb(null, `${Date.now()}-${file.originalname}`);
}

/**
 * File size limits presets
 */
export const FILE_SIZE_LIMITS = {
  IMAGE_5MB: 5 * 1024 * 1024,
  EXCEL_8MB: 8 * 1024 * 1024,
  DOCUMENT_10MB: 10 * 1024 * 1024,
};

/**
 * File validation and save utilities for transaction files
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export interface SavedFileInfo {
  relativePath: string;
  filename: string;
  size: number;
}

export class FileUploadHandler {
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private static readonly ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "pdf"];
  private static readonly ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "application/pdf",
  ];
  private static readonly MAX_FILES_PER_BATCH = 50; // Security: max 50 files per batch
  private static readonly MAX_TOTAL_BATCH_SIZE = 270 * 1024 * 1024; // Security: max 270MB total

  private static getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Validate entire batch before processing
   * Security measure: prevents batch DoS attacks
   */
  static validateBatch(
    files: Array<{ filename: string; buffer: string | Buffer }>,
  ): FileValidationResult {
    // Check batch size
    if (files.length > this.MAX_FILES_PER_BATCH) {
      return {
        valid: false,
        error: `Batch size ${files.length} exceeds maximum ${this.MAX_FILES_PER_BATCH} files`,
      };
    }

    // Check total batch size
    let totalSize = 0;
    for (const file of files) {
      const bufferObj =
        typeof file.buffer === "string"
          ? Buffer.from(file.buffer, "base64")
          : file.buffer;
      totalSize += bufferObj.length;
    }

    if (totalSize > this.MAX_TOTAL_BATCH_SIZE) {
      return {
        valid: false,
        error: `Total batch size ${(totalSize / 1024 / 1024).toFixed(2)}MB exceeds maximum ${this.MAX_TOTAL_BATCH_SIZE / 1024 / 1024}MB`,
      };
    }

    return { valid: true };
  }

  /**
   * Get MIME type from file extension (optimized for performance)
   */
  static getMimeTypeFromExtension(extension: string): string {
    const ext = extension.toLowerCase();
    const mimeMap: { [key: string]: string } = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      pdf: "application/pdf",
    };
    return mimeMap[ext] || "application/octet-stream";
  }

  /**
   * Validate file (size, extension, mime type)
   * High-performance: O(1) lookups with Set instead of Array.includes()
   */
  static validateFile(
    filename: string,
    buffer: Buffer | string,
  ): FileValidationResult {
    try {
      // Get file extension
      const ext = path.extname(filename).toLowerCase().slice(1);

      // Validate extension (O(1) lookup)
      const allowedExtSet = new Set(this.ALLOWED_EXTENSIONS);
      if (!allowedExtSet.has(ext)) {
        return {
          valid: false,
          error: `Invalid file extension: ${ext}. Allowed: jpg, jpeg, png, pdf`,
        };
      }

      // Get buffer size
      const bufferObj =
        typeof buffer === "string" ? Buffer.from(buffer, "base64") : buffer;
      const fileSize = bufferObj.length;

      // Validate size
      if (fileSize > this.MAX_FILE_SIZE) {
        return {
          valid: false,
          error: `File size ${(fileSize / 1024 / 1024).toFixed(2)}MB exceeds max 5MB`,
        };
      }

      // Validate MIME type (O(1) lookup)
      const mimeType = this.getMimeTypeFromExtension(ext);
      const allowedMimeSet = new Set(this.ALLOWED_MIME_TYPES);
      if (!allowedMimeSet.has(mimeType)) {
        return {
          valid: false,
          error: `Invalid MIME type: ${mimeType}`,
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Validation error: ${this.getErrorMessage(error)}`,
      };
    }
  }

  /**
   * Compress file based on type to achieve ~60% of original size
   * Images: reduce quality and optimize resolution using sharp
   * PDFs: pass through without compression
   * @param buffer - File buffer to compress
   * @param filename - Original filename (used to determine file type)
   * @returns Compressed buffer
   */
  static async compressFile(
    buffer: Buffer | string,
    filename: string,
  ): Promise<Buffer> {
    try {
      const bufferObj =
        typeof buffer === "string" ? Buffer.from(buffer, "base64") : buffer;
      const ext = path.extname(filename).toLowerCase().slice(1);
      const mimeType = this.getMimeTypeFromExtension(ext);

      // PDF: no compression, return as-is
      if (mimeType === "application/pdf") {
        return bufferObj;
      }

      // Images: compress using sharp
      if (mimeType.startsWith("image/")) {
        let compressedBuffer = bufferObj;

        if (ext === "png") {
          // PNG: reduce colors and quality to achieve ~60% of original size
          compressedBuffer = await sharp(bufferObj)
            .png({
              quality: 75, // PNG quality
              compressionLevel: 9, // Maximum compression
            })
            .toBuffer();
        } else if (ext === "jpg" || ext === "jpeg") {
          // JPEG: reduce quality to achieve ~60% of original size
          compressedBuffer = await sharp(bufferObj)
            .jpeg({
              quality: 70, // JPEG quality (70-75 is good balance)
              progressive: true, // Progressive JPEG loads faster
            })
            .toBuffer();
        } else if (ext === "gif" || ext === "webp") {
          // GIF/WebP: convert to optimized format
          compressedBuffer = await sharp(bufferObj)
            .toFormat("webp", { quality: 75 })
            .toBuffer();
        }

        return compressedBuffer;
      }

      // Unknown format: return original
      return bufferObj;
    } catch (error) {
      console.warn(
        `Compression failed for ${filename}, using original: ${this.getErrorMessage(error)}`,
      );
      // Return original buffer on compression error (graceful degradation)
      return typeof buffer === "string"
        ? Buffer.from(buffer, "base64")
        : buffer;
    }
  }

  /**
   * Save file to disk with generated unique filename
   * Format: header-{headerId}-{timestamp}-{originalName}
   * Returns relative path from project root
   * High-performance for bulk operations (2000+ files)
   */
  static async saveFile(
    buffer: Buffer | string,
    filename: string,
    headerId: number,
    uploadDir: string = "uploads/req-transactions",
  ): Promise<SavedFileInfo> {
    try {
      // Validate file first (quick fail for invalid files)
      const validation = this.validateFile(filename, buffer);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Ensure upload directory exists (lazy creation)
      const uploadPath = path.join(process.cwd(), uploadDir);
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      // Generate unique filename: header-{headerId}-{timestamp}-{originalName}
      const ext = path.extname(filename);
      const nameWithoutExt = path.basename(filename, ext);
      const timestamp = Date.now();
      const uniqueFilename = `header-${headerId}-${timestamp}-${nameWithoutExt}${ext}`;
      const fullPath = path.join(uploadPath, uniqueFilename);

      // Convert buffer if needed (base64 → Buffer)
      const bufferToSave =
        typeof buffer === "string" ? Buffer.from(buffer, "base64") : buffer;

      // Save file synchronously for performance
      // Synchronous is faster for bulk operations than Promise-based writeFile
      fs.writeFileSync(fullPath, bufferToSave);

      // Return relative path from project root (normalized to forward slashes for frontend)
      const relativePath = path
        .relative(process.cwd(), fullPath)
        .replace(/\\/g, "/");

      return {
        relativePath,
        filename: uniqueFilename,
        size: bufferToSave.length,
      };
    } catch (error) {
      throw new Error(`File save failed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * NEW STREAMING APPROACH: Compress and save file directly to disk
   * Memory-efficient: NO intermediate compressed buffer stored in RAM
   *
   * OPTIMIZATION BENEFIT:
   * - Old approach: buffer (5MB) + compressedBuffer (3MB) = 8MB per file × 5 files = 40MB
   * - New approach: buffer (5MB) only = 5MB per file × 5 files = 25MB
   * - Result: 37.5% additional memory savings
   *
   * HOW IT WORKS:
   * 1. Images (JPG/PNG/GIF/WebP): sharp.toFile() streams compression directly to disk
   * 2. PDFs: fs.createWriteStream pipes buffer to disk (no compression needed)
   * 3. Both: Compressed data written to disk as stream (never held in memory)
   *
   * @param buffer - Original file buffer from HTTP request
   * @param filename - Original filename (used to detect file type)
   * @param headerId - Header ID for filename generation
   * @param uploadDir - Upload directory path
   * @returns SavedFileInfo with relative path and filename (same structure as saveFile)
   */
  static async compressAndSaveStreamDirect(
    buffer: Buffer | string,
    filename: string,
    headerId: number,
    uploadDir: string = "uploads/req-transactions",
  ): Promise<SavedFileInfo> {
    try {
      // Validate file first (quick fail for invalid files)
      const validation = this.validateFile(filename, buffer);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const bufferObj =
        typeof buffer === "string" ? Buffer.from(buffer, "base64") : buffer;
      const ext = path.extname(filename).toLowerCase().slice(1);
      const mimeType = this.getMimeTypeFromExtension(ext);

      // Ensure upload directory exists (lazy creation)
      const uploadPath = path.join(process.cwd(), uploadDir);
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      // Generate unique filename: header-{headerId}-{timestamp}-{originalName}
      const nameWithoutExt = path.basename(filename, path.extname(filename));
      const timestamp = Date.now();
      const uniqueFilename = `header-${headerId}-${timestamp}-${nameWithoutExt}${path.extname(filename)}`;
      const fullPath = path.join(uploadPath, uniqueFilename);

      let finalSize = 0;

      // PDF: no compression, stream buffer directly to disk
      // Use Readable.from() to create a readable stream from buffer,
      // then pipeline to writeStream for proper async streaming
      // This avoids buffering and works with global queue (concurrency: 2)
      if (mimeType === "application/pdf") {
        // Create readable stream from buffer (zero-copy, streams chunks)
        const readableStream = Readable.from([bufferObj]);

        // Pipeline: buffer → readable stream → write stream → disk
        // Properly handles backpressure and errors
        await pipeline(readableStream, fs.createWriteStream(fullPath));

        // Get file size for return value
        finalSize = fs.statSync(fullPath).size;
      } else if (mimeType.startsWith("image/")) {
        // Images: use sharp's toFile() for streaming compression to disk
        let sharpTransform = sharp(bufferObj);

        if (ext === "png") {
          // PNG: reduce quality and colors, write directly to disk
          sharpTransform = sharpTransform.png({
            quality: 75,
            compressionLevel: 9,
          });
        } else if (ext === "jpg" || ext === "jpeg") {
          // JPEG: reduce quality, write directly to disk
          sharpTransform = sharpTransform.jpeg({
            quality: 70,
            progressive: true,
          });
        } else if (ext === "gif" || ext === "webp") {
          // GIF/WebP: convert to webp, write directly to disk
          sharpTransform = sharpTransform.toFormat("webp", { quality: 75 });
        }

        // Stream compression directly to disk (NO intermediate buffer)
        await sharpTransform.toFile(fullPath);

        // Get file size for return value
        finalSize = fs.statSync(fullPath).size;
      } else {
        // Unknown format: save as-is
        fs.writeFileSync(fullPath, bufferObj);
        finalSize = bufferObj.length;
      }

      // Return relative path from project root (normalized to forward slashes for frontend)
      const relativePath = path
        .relative(process.cwd(), fullPath)
        .replace(/\\/g, "/");

      return {
        relativePath,
        filename: uniqueFilename,
        size: finalSize,
      };
    } catch (error) {
      throw new Error(
        `Streaming file save failed: ${this.getErrorMessage(error)}`,
      );
    }
  }

  /**
   * Helper: Normalize filename for disk storage
   * Removes spaces around dashes and replaces spaces inside parentheses with underscores
   * @param filename Original filename (e.g., "50001032 - SRLC - 2026-01-01_2026-11-30 (2nd copy).pdf")
   * @returns Normalized filename (e.g., "50001032-SRLC-2026-01-01_2026-11-30(2nd_copy).pdf")
   *
   * Transformations:
   * 1. Remove spaces around dashes: " - " → "-"
   * 2. Remove space before parenthesis: " (" → "("
   * 3. Replace remaining spaces with underscores: " " → "_"
   * 4. Remove space after parenthesis: ") " → ")"
   */
  static normalizeFilenameForSave(filename: string): string {
    try {
      // Extract extension
      const ext = filename.match(/\.[^/.]+$/)?.[0] || "";
      const withoutExt = filename.replace(/\.[^/.]+$/, "");

      // Step 1: Remove spaces around dashes: " - " → "-"
      let normalized = withoutExt.replace(/\s*-\s*/g, "-");

      // Step 2: Remove space before opening parenthesis: " (" → "("
      normalized = normalized.replace(/\s*\(/g, "(");

      // Step 3: Replace remaining spaces with underscores
      normalized = normalized.replace(/\s+/g, "_");

      // Step 4: Remove space after closing parenthesis (if any): ") " → ")"
      normalized = normalized.replace(/\)\s*/g, ")");

      return normalized + ext;
    } catch (error) {
      // If normalization fails, return original filename
      logger.warn(
        `Failed to normalize filename "${filename}": ${(error as Error).message}`,
      );
      return filename;
    }
  }

  /**
   * Delete file from disk (cleanup on error)
   */
  static deleteFile(relativePath: string): void {
    try {
      const fullPath = path.join(process.cwd(), relativePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (error) {
      console.error(`Failed to delete file: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Check if file exists
   */
  static fileExists(relativePath: string): boolean {
    try {
      const fullPath = path.join(process.cwd(), relativePath);
      return fs.existsSync(fullPath);
    } catch {
      return false;
    }
  }

  /**
   * Generate a Type 2 (Rental) filename following the convention:
   * {warehouse_ifs}-{requirement_abbr}-{start_date}_{end_date}({originalName_truncated}).{ext}
   *
   * If original filename exceeds 50 characters, trimmed to 50 chars with "...".
   */
  static generateType2Filename(
    warehouseIfs: string,
    requirementAbbr: string,
    startDate: string,
    endDate: string,
    originalFilename: string,
  ): string {
    const ext = path.extname(originalFilename);
    const nameWithoutExt = path.basename(originalFilename, ext);

    const MAX_ORIGINAL_LENGTH = 50;
    let truncatedOriginal = nameWithoutExt;
    if (truncatedOriginal.length > MAX_ORIGINAL_LENGTH) {
      truncatedOriginal =
        truncatedOriginal.substring(0, MAX_ORIGINAL_LENGTH) + "...";
    }

    return `${warehouseIfs}-${requirementAbbr}-${startDate}_${endDate}(${truncatedOriginal})${ext}`;
  }

  /**
   * Generate a Type 1 (Recurring) filename following the convention:
   * {warehouse_ifs}-{requirement_abbr}({originalName_truncated}).{ext}
   *
   * If original filename exceeds 50 characters, trimmed to 50 chars with "...".
   */
  static generateType1Filename(
    warehouseIfs: string,
    requirementAbbr: string,
    originalFilename: string,
  ): string {
    const ext = path.extname(originalFilename);
    const nameWithoutExt = path.basename(originalFilename, ext);

    const MAX_ORIGINAL_LENGTH = 50;
    let truncatedOriginal = nameWithoutExt;
    if (truncatedOriginal.length > MAX_ORIGINAL_LENGTH) {
      truncatedOriginal =
        truncatedOriginal.substring(0, MAX_ORIGINAL_LENGTH) + "...";
    }

    return `${warehouseIfs}-${requirementAbbr}(${truncatedOriginal})${ext}`;
  }
}
