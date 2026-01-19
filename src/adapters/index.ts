// Platform-agnostic file upload exports
// Automatically switches based on USE_FASTIFY environment variable

import { FastifyFileInterceptor } from "./fastify-file-upload.adapter";
import { ExpressFileInterceptor } from "./express-file-upload.adapter";

// console.log(`📦 Adapters loading... USE_FASTIFY=${process.env.USE_FASTIFY}`);

// Dynamic export based on environment (evaluated at import time)
export const FileInterceptor =
  process.env.USE_FASTIFY === "true"
    ? FastifyFileInterceptor
    : ExpressFileInterceptor;

// console.log(
//   `📦 FileInterceptor set to: ${process.env.USE_FASTIFY === "true" ? "Fastify" : "Express"}`
// );

// Lazy-loaded diskStorage to avoid loading multer when using Fastify
export const diskStorage = (options: any) => {
  // console.log("diskStorage called, USE_FASTIFY:", process.env.USE_FASTIFY);
  if (process.env.USE_FASTIFY === "true") {
    // Fastify mode - just return options as-is (don't call multer)
    // console.log("Returning Fastify-compatible options");
    return options;
  } else {
    // Express mode - use multer's diskStorage
    // console.log("Calling multer.diskStorage");
    return require("multer").diskStorage(options);
  }
};

// Common exports
export * from "./file-upload.interface";
export type { UploadedFile } from "./file-upload.interface";
