import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { createWriteStream, mkdirSync, existsSync } from "fs";
import { pipeline } from "stream/promises";
import { join } from "path";
import {
  UploadedFile,
  FileUploadOptions,
  FileUploadAdapter,
} from "./file-upload.interface";

@Injectable()
export class FastifyFileUploadAdapter implements FileUploadAdapter {
  async handleFileUpload(
    request: any,
    options: FileUploadOptions
  ): Promise<UploadedFile> {
    const data = await request.file();

    if (!data) {
      throw new BadRequestException("No file uploaded");
    }

    // Create Express-compatible request mock for multer callbacks
    const mockRequest = {
      ...request,
      on: (event: string, handler: any) => mockRequest,
      once: (event: string, handler: any) => mockRequest,
      emit: (event: string, ...args: any[]) => true,
      pipe: (destination: any) => destination,
      unpipe: () => mockRequest,
      addListener: (event: string, handler: any) => mockRequest,
      removeListener: (event: string, handler: any) => mockRequest,
      removeAllListeners: (event?: string) => mockRequest,
      setMaxListeners: (n: number) => mockRequest,
      listeners: (event: string) => [],
      rawListeners: (event: string) => [],
      listenerCount: (event: string) => 0,
      prependListener: (event: string, handler: any) => mockRequest,
      prependOnceListener: (event: string, handler: any) => mockRequest,
      eventNames: () => [],
      file: undefined,
      body: request.body || {},
      headers: request.headers || {},
      method: request.method || "POST",
      url: request.url || request.raw?.url || "",
    };

    // Check file filter if provided
    if (options.fileFilter) {
      const mockFile = {
        originalname: data.filename,
        mimetype: data.mimetype,
      };

      const allowed = await new Promise<boolean>((resolve, reject) => {
        try {
          options.fileFilter!(
            mockRequest,
            mockFile as any,
            (error: any, acceptFile: boolean) => {
              if (error) {
                reject(error);
              } else {
                resolve(acceptFile);
              }
            }
          );
        } catch (err) {
          // If fileFilter throws synchronously, reject
          reject(err);
        }
      });

      if (!allowed) {
        throw new BadRequestException("File type not allowed");
      }
    }

    // Extract storage config (handle both direct options and multer-style storage)
    const destination =
      options.storage?.destination || options.destination || "./uploads";
    const dest =
      typeof destination === "function"
        ? await new Promise<string>((resolve) =>
            destination(mockRequest, data, (err: any, path: string) =>
              resolve(path)
            )
          )
        : destination;

    // Ensure upload directory exists
    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true });
    }

    // Generate filename
    let filename: string;
    if (options.storage?.filename) {
      filename = await new Promise<string>((resolve) => {
        options.storage!.filename!(
          mockRequest,
          {
            originalname: data.filename,
            mimetype: data.mimetype,
          } as any,
          (err: any, name: string) => resolve(name)
        );
      });
    } else if (options.filename) {
      filename = options.filename(data.filename, data.mimetype);
    } else {
      filename = `${Date.now()}-${data.filename}`;
    }

    const filepath = join(dest, filename);

    // Write file
    await pipeline(data.file, createWriteStream(filepath));

    // Return file info in standard format
    return {
      fieldname: data.fieldname || "file",
      originalname: data.filename,
      encoding: data.encoding,
      mimetype: data.mimetype,
      filename,
      path: filepath,
      destination: dest,
      size: data.file.bytesRead,
    };
  }
}

export function FastifyFileInterceptor(
  fieldName: string,
  options: FileUploadOptions
) {
  @Injectable()
  class MixinInterceptor implements NestInterceptor {
    public readonly adapter = new FastifyFileUploadAdapter();

    async intercept(
      context: ExecutionContext,
      next: CallHandler
    ): Promise<Observable<any>> {
      // console.log("🔧 FastifyFileInterceptor.intercept() called");
      const request = context.switchToHttp().getRequest();

      // Handle file upload
      const file = await this.adapter.handleFileUpload(request, options);

      // Attach file to request (compatible with Express pattern)
      request.file = file;

      return next.handle();
    }
  }

  return MixinInterceptor;
}
