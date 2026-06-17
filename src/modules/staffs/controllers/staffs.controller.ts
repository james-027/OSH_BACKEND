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
import { StaffsService } from "src/modules/staffs/services/staffs.service";
import { CheckStaffDto, CreateStaffDto } from "src/modules/staffs/dto/CreateStaffDto";
import { UpdateStaffDto } from "src/modules/staffs/dto/UpdateStaffDto";
import { UpdateStaffTransferDto } from "src/modules/staffs/dto/UpdateStaffTransferDto";
import { UpdateStaffDeployDto } from "src/modules/staffs/dto/UpdateStaffDeployDto";
import { Query } from "@nestjs/common";

@Controller("staffs")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StaffsController {
  constructor(private readonly staffsService: StaffsService) {}

@Get()
async findAll(
  @Request() req,
  @Query("status_id") statusId?: string,
) {
  const accessKeyId = req.user.current_access_key;

  const parsedStatusId = statusId
    ? statusId.split(",").map(Number)
    : undefined;

  return this.staffsService.findAll(accessKeyId, parsedStatusId);
}

  @Get(":id")
  @RequirePermissions({ module: "STAFFS", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.staffsService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "STAFFS", action: "ADD" })
  async create(@Body() createStaffDto: CreateStaffDto, @Request() req) {
    const userId = req.user.id;
    const accessKeyId = req.user.current_access_key;
    return this.staffsService.create(createStaffDto, userId, accessKeyId);
  }

  @Put(":id")
  @RequirePermissions({ module: "STAFFS", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateStaffDto: UpdateStaffDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffsService.update(id, updateStaffDto, userId);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "STAFFS", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffsService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "STAFFS", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffsService.toggleStatus(id, userId);
  }

  @Post("upload-excel")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads/staffs",
        filename: generateTimestampFilename,
      }),
      fileFilter: excelFileFilter,
      limits: { fileSize: FILE_SIZE_LIMITS.EXCEL_8MB },
    }),
  )
  async uploadExcel(@UploadedFile() file: Express.Multer.File, @Request() req) {
    return this.staffsService.uploadExcel(
      file,
      req.user.id,
      req.user.current_access_key,
    );
  }

  @Post("check-existing")
  async checkExisting(@Body() dto: CheckStaffDto) {
    return this.staffsService.checkExistingStaff(dto);
  }
    @Get("history/:id")
  @RequirePermissions({ module: "LOCATION HURDLES", action: "VIEW" })
  async findOneHistory(@Param("id", ParseIntPipe) id: number) {
    return this.staffsService.findOneHistory(id);
  }


  
  @Patch(":id/transfer")
  @RequirePermissions({ module: "STAFFS", action: "TRANSFER" })
  async updateStaffTransfer(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateStaffTransferDto: UpdateStaffTransferDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffsService.staffTransfer(id, updateStaffTransferDto, userId);
  }

  @Post(":id/deploy")
  @RequirePermissions({ module: "STAFFS", action: "DEPLOY" })
  async updateStaffDeploy(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateStaffDeployDto: UpdateStaffDeployDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    const accessKeyId = req.user.current_access_key;
    return this.staffsService.staffDeploy(id, updateStaffDeployDto, userId,accessKeyId);
  }
}
