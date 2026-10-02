import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import {
  FileInterceptor,
  diskStorage,
  UploadedFile as FileType,
} from "../../../adapters";
import {
  imageFileFilter,
  excelFileFilter,
  FILE_SIZE_LIMITS,
  generateTimestampFilename,
} from "../../../utils/file-upload.utils";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { StaffVendorSalariesService } from "src/modules/staff-vendor-salaries/services/staff-vendor-salaries.service";
import { CreateStaffVendorSalaryDto } from "src/modules/staff-vendor-salaries/dto/CreateStaffVendorSalaryDto";
import { UpdateStaffVendorSalaryDto } from "src/modules/staff-vendor-salaries/dto/UpdateStaffVendorSalaryDto";

@Controller("staff-vendor-salaries")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StaffVendorSalariesController {
  constructor(
    private readonly staffVendorSalariesService: StaffVendorSalariesService,
  ) {}

  @Get()
  @RequirePermissions({ module: "STAFF VENDOR SALARIES", action: "VIEW" })
  async findAll(@Request() req) {
    const accessKeyId = req.user.current_access_key;

    return this.staffVendorSalariesService.findAll(accessKeyId);
  }

  @Get(":id")
  @RequirePermissions({ module: "STAFF VENDOR SALARIES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.staffVendorSalariesService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "STAFF VENDOR SALARIES", action: "ADD" })
  async create(
    @Body() createStaffVendorSalaryDto: CreateStaffVendorSalaryDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    const accessKeyId = req.user.current_access_key;
    return this.staffVendorSalariesService.create(
      createStaffVendorSalaryDto,
      userId,
      accessKeyId
    );
  }

  @Put(":id")
  @RequirePermissions({ module: "STAFF VENDOR SALARIES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateStaffVendorSalaryDto: UpdateStaffVendorSalaryDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    const accessKeyId = req.user.current_access_key;
    return this.staffVendorSalariesService.update(
      id,
      updateStaffVendorSalaryDto,
      userId,
      accessKeyId
    );
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "STAFF VENDOR SALARIES", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffVendorSalariesService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "STAFF VENDOR SALARIES", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffVendorSalariesService.toggleStatus(id, userId);
  }
  
  @Get("history/:id")
  @RequirePermissions({ module: "STAFF VENDOR SALARIES", action: "VIEW" })
  async findOneHistory(@Param("id", ParseIntPipe) id: number) {
    return this.staffVendorSalariesService.findOneHistory(id);
  }

    @Post("/upload-excel")
    @UseInterceptors(
      FileInterceptor("file", {
        storage: diskStorage({
          destination: "./uploads/staff-vendor-salaries",
          filename: generateTimestampFilename,
        }),
        fileFilter: excelFileFilter,
        limits: { fileSize: FILE_SIZE_LIMITS.EXCEL_8MB },
      }),
    )
    async uploadStaffVendorSalaries(
      @UploadedFile() file: Express.Multer.File,
      @Request() req,
    ) {
      return this.staffVendorSalariesService.uploadStaffVendorSalaries(
        file,
        req.user.id,
        req.user.current_access_key,
      );
    }

}
