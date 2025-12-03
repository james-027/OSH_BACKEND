export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  filename: string;
  path: string;
  destination: string;
  size?: number;
}

export interface FileUploadOptions {
  destination?: string;
  filename?: (originalName: string, mimetype: string) => string;
  maxFileSize?: number;
  fileFilter?: (
    req: any,
    file: any,
    callback: (error: Error | null, acceptFile: boolean) => void
  ) => void;
  limits?: {
    fileSize?: number;
  };
  storage?: {
    destination?:
      | string
      | ((
          req: any,
          file: any,
          callback: (error: any, destination: string) => void
        ) => void);
    filename?: (
      req: any,
      file: any,
      callback: (error: any, filename: string) => void
    ) => void;
  };
}

export interface FileUploadAdapter {
  handleFileUpload(
    request: any,
    options: FileUploadOptions
  ): Promise<UploadedFile>;
}
