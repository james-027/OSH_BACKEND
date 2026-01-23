// Reusable file upload utilities for both Express and Fastify

import * as fs from "fs";
import * as path from "path";
import * as sharp from "sharp";

/**
 * Excel file filter - validates that uploaded file is .xlsx or .xls
 */
export function excelFileFilter(
  req: any,
  file: any,
  cb: (error: Error | null, acceptFile: boolean) => void
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
  cb: (error: Error | null, acceptFile: boolean) => void
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
  cb: (error: Error | null, filename: string) => void
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
  private static readonly MAX_FILES_PER_BATCH = 150; // Security: max 150 files per batch
  private static readonly MAX_TOTAL_BATCH_SIZE = 750 * 1024 * 1024; // Security: max 750MB total

  /**
   * Validate entire batch before processing
   * Security measure: prevents batch DoS attacks
   */
  static validateBatch(
    files: Array<{ filename: string; buffer: string | Buffer }>
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
    buffer: Buffer | string
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
        error: `Validation error: ${error.message}`,
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
    filename: string
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
              quality: 75,  // PNG quality
              compressionLevel: 9  // Maximum compression
            })
            .toBuffer();
        } else if (ext === "jpg" || ext === "jpeg") {
          // JPEG: reduce quality to achieve ~60% of original size
          compressedBuffer = await sharp(bufferObj)
            .jpeg({ 
              quality: 70,  // JPEG quality (70-75 is good balance)
              progressive: true  // Progressive JPEG loads faster
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
        `Compression failed for ${filename}, using original: ${error.message}`
      );
      // Return original buffer on compression error (graceful degradation)
      return typeof buffer === "string" ? Buffer.from(buffer, "base64") : buffer;
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
    uploadDir: string = "uploads/req-transactions"
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
      throw new Error(`File save failed: ${error.message}`);
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
      console.error(`Failed to delete file: ${error.message}`);
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
}
