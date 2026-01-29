import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  UploadedFile,
  BadRequestException,
  UseInterceptors,
} from "@nestjs/common";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RequirePermissions } from "../decorators/permissions.decorator";
import { SystemDocumentationsService } from "../services/system-documentations.service";
import { CreateSystemDocumentationDto } from "../dto/CreateSystemDocumentationDto";
import { UpdateSystemDocumentationDto } from "../dto/UpdateSystemDocumentationDto";
import {
  FileInterceptor,
  diskStorage,
  UploadedFile as FileType,
} from "../adapters";
import { FILE_SIZE_LIMITS } from "../utils/file-upload.utils";
import { UserAuditTrailCreateService } from "../services/user-audit-trail-create.service";
import * as path from "path";

const allowedMimes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
];

const fileFilter = (req: any, file: any, cb: any) => {
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new BadRequestException(
        "Only image files (JPEG, PNG, GIF) and PDF are allowed",
      ),
      false,
    );
  }
};

@Controller("system-documentations")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SystemDocumentationsController {
  constructor(
    private readonly systemDocumentationsService: SystemDocumentationsService,
    private readonly auditTrailService: UserAuditTrailCreateService,
  ) {}

  @Get()
  @RequirePermissions({ module: "SYSTEMS", action: "VIEW" })
  async findAll() {
    return this.systemDocumentationsService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "SYSTEMS", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.systemDocumentationsService.findOne(id);
  }

  @Get(":system_id/by-system")
  @RequirePermissions({ module: "SYSTEMS", action: "VIEW" })
  async findAllBySystemId(@Param("system_id", ParseIntPipe) system_id: number) {
    return this.systemDocumentationsService.findAllBySystemId(system_id);
  }

  @Post()
  @RequirePermissions({ module: "SYSTEMS", action: "ADD" })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads/system-documentations",
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          const ext = path.extname(file.originalname);
          cb(null, `${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter,
      limits: { fileSize: FILE_SIZE_LIMITS.EXCEL_8MB },
    }),
  )
  async create(@UploadedFile() file: FileType, @Request() req: any) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    const userId = req.user.id;

    // Extract system_abbr from filename
    // Naming convention: "ARC - User Guide.pdf"
    // Split by "-" and take first part, then trim whitespace
    const filenameParts = file.originalname.split("-");
    if (filenameParts.length === 0) {
      throw new BadRequestException(
        "Invalid filename format. Expected format: 'SYSTEM_ABBR - Description.pdf'",
      );
    }

    const system_abbr = filenameParts[0].trim().toUpperCase();

    if (!system_abbr) {
      throw new BadRequestException(
        "Could not extract system abbreviation from filename",
      );
    }

    // Look up system by abbreviation
    const system =
      await this.systemDocumentationsService.findSystemByAbbr(system_abbr);
    if (!system) {
      throw new BadRequestException(
        `System with abbreviation '${system_abbr}' not found`,
      );
    }

    const system_id = system.id;
    const status_id = 1; // Always 1 as per requirement

    // Prepare DTO with file path
    const dto: CreateSystemDocumentationDto = {
      system_id,
      status_id,
      file_path: file.path.replace(/\\/g, "/"),
      file_name: file.originalname,
    };

    // Audit trail
    await this.auditTrailService.create(
      {
        service: "SystemDocumentationsController",
        method: "create",
        raw_data: JSON.stringify(dto),
        description: `Created system documentation: ${file.originalname}`,
        status_id: 1,
      },
      userId,
    );

    return this.systemDocumentationsService.create(dto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "SYSTEMS", action: "EDIT" })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads/system-documentations",
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          const ext = path.extname(file.originalname);
          cb(null, `${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter,
      limits: { fileSize: FILE_SIZE_LIMITS.EXCEL_8MB },
    }),
  )
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateSystemDocumentationDto,
    @UploadedFile() file: FileType,
    @Request() req,
  ) {
    const userId = req.user.id;

    // Prepare DTO with file path if file is provided
    const dto: UpdateSystemDocumentationDto = { ...updateDto };
    if (file) {
      dto.file_path = file.path.replace(/\\/g, "/");
      dto.file_name = file.originalname;
    }

    // Audit trail
    await this.auditTrailService.create(
      {
        service: "SystemDocumentationsController",
        method: "update",
        raw_data: JSON.stringify(updateDto),
        description: `Updated system documentation ID: ${id}`,
        status_id: 1,
      },
      userId,
    );

    return this.systemDocumentationsService.update(id, dto, userId);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "SYSTEMS", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    const status_id = 1; // Active status
    return this.systemDocumentationsService.toggleStatus(id, userId, status_id);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "SYSTEMS", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    const status_id = 2; // Inactive status
    return this.systemDocumentationsService.toggleStatus(id, userId, status_id);
  }
}
