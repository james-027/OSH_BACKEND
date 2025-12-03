// Reusable file upload utilities for both Express and Fastify

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
