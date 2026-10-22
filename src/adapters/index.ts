// Platform-agnostic file upload exports
// Automatically switches based on USE_FASTIFY environment variable

import { FastifyFileInterceptor } from "./fastify-file-upload.adapter";
import { ExpressFileInterceptor } from "./express-file-upload.adapter";

// Dynamic export based on environment (evaluated when interceptor is instantiated)
export const FileInterceptor = (fieldName: string, options?: any) => {
  return process.env.USE_FASTIFY === "true"
    ? FastifyFileInterceptor(fieldName, options)
    : ExpressFileInterceptor(fieldName, options);
};

// Lazy-loaded diskStorage to avoid loading multer when using Fastify
export const diskStorage = (options: any) => {
  if (process.env.USE_FASTIFY === "true") {
    // Fastify mode - just return options as-is (don't call multer)
    return options;
  } else {
    // Express mode - use multer's diskStorage
    return require("multer").diskStorage(options);
  }
};

// Common exports
export * from "./file-upload.interface";
export type { UploadedFile } from "./file-upload.interface";