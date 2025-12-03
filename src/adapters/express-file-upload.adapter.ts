import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import {
  UploadedFile,
  FileUploadOptions,
  FileUploadAdapter,
} from "./file-upload.interface";

@Injectable()
export class ExpressFileUploadAdapter implements FileUploadAdapter {
  async handleFileUpload(
    request: any,
    options: FileUploadOptions
  ): Promise<UploadedFile> {
    // For Express with multer, file is already attached by FileInterceptor
    // This adapter is for consistency, actual upload handled by multer
    const file = request.file as Express.Multer.File;

    if (!file) {
      throw new Error("No file uploaded");
    }

    return {
      fieldname: file.fieldname,
      originalname: file.originalname,
      encoding: file.encoding,
      mimetype: file.mimetype,
      filename: file.filename,
      path: file.path,
      destination: file.destination,
      size: file.size,
    };
  }
}

// Re-export Express FileInterceptor for consistency
export { FileInterceptor as ExpressFileInterceptor } from "@nestjs/platform-express";
