import { PipeTransform, Injectable } from "@nestjs/common";
import { plainToClass } from "class-transformer";
import { sanitizeInput } from "../utils/sanitizer";

/**
 * Global Sanitization Pipe
 * Automatically sanitizes all string fields in any DTO
 * Applies to all @Body() parameters without needing per-DTO changes
 */
@Injectable()
export class SanitizationPipe implements PipeTransform {
  constructor(private readonly metatype?: any) {}

  transform(value: any) {
    if (!value || typeof value !== "object") {
      return value;
    }

    return this.sanitizeRecursive(value);
  }

  private sanitizeRecursive(obj: any): any {
    if (typeof obj !== "object" || obj === null || obj instanceof Date) {
      if (typeof obj === "string") {
        return sanitizeInput(obj);
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeRecursive(item));
    }

    // Recursively sanitize object properties
    const sanitized: any = {};
    for (const key in obj) {
      // Use Object.prototype.hasOwnProperty.call() for objects without prototype (Fastify, etc)
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (typeof value === "string") {
          sanitized[key] = sanitizeInput(value);
        } else if (typeof value === "object" && value !== null) {
          sanitized[key] = this.sanitizeRecursive(value);
        } else {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  }
}
