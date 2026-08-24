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
import { StaffsService } from "src/modules/staffs/services/staffs.service";
import {
  CheckStaffDto,
  CreateStaffDto,
  RevertStaffDto,
  ApprovalStaffDto,
  RejectStaffDto,
} from "src/modules/staffs/dto/CreateStaffDto";
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
    @Query("assign_status_id") assignStatusId?: string,
  ) {
    const accessKeyId = req.user.current_access_key;

    const parsedStatusId = statusId
      ? statusId.split(",").map(Number)
      : undefined;

    const parsedAssignStatusId = assignStatusId
      ? assignStatusId.split(",").map(Number)
      : undefined;

    return this.staffsService.findAll(
      accessKeyId,
      parsedStatusId,
      parsedAssignStatusId,
    );
  }

  @Get("for-approval")
  async findStaffForApproval(
    @Request() req,
    @Query("status_id") statusId?: string,
    @Query("approval_status_id") approvalStatusId?: string,
  ) {
    const accessKeyId = req.user.current_access_key;

    const parsedStatusId = statusId
      ? statusId.split(",").map(Number)
      : undefined;

    const parsedApprovalSTatusId = approvalStatusId
      ? approvalStatusId.split(",").map(Number)
      : undefined;

    return this.staffsService.findStaffForApproval(
      accessKeyId,
      parsedStatusId,
      parsedApprovalSTatusId,
    );
  }

  @Get(":id")
  @RequirePermissions({ module: "STAFF MANAGEMENTS", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.staffsService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "STAFF MANAGEMENTS", action: "ADD" })
  async create(@Body() createStaffDto: CreateStaffDto, @Request() req) {
    const userId = req.user.id;
    const accessKeyId = req.user.current_access_key;
    return this.staffsService.create(createStaffDto, userId, accessKeyId);
  }

  @Put(":id")
  @RequirePermissions({ module: "STAFF MANAGEMENTS", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateStaffDto: UpdateStaffDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffsService.update(id, updateStaffDto, userId);
  }

  @Patch(":id/revert-staff")
  @RequirePermissions({ module: "STAFF MANAGEMENTS", action: "REVERT" })
  async updateRevertStaff(
    @Param("id", ParseIntPipe) id: number,
    @Body() revertStaffDto: RevertStaffDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffsService.revertStaff(id, revertStaffDto, userId);
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

  @Post("upload-transfer-excel")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads/staffs/transfer",
        filename: generateTimestampFilename,
      }),
      fileFilter: excelFileFilter,
      limits: { fileSize: FILE_SIZE_LIMITS.EXCEL_8MB },
    }),
  )
  async uploadStaffTransferExcel(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    return this.staffsService.uploadStaffTransfer(
      file,
      req.user.id,
      req.user.current_access_key,
      req.user?.role_id,
    );
  }

  @Post("upload-deploy-excel")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads/staffs/deploy",
        filename: generateTimestampFilename,
      }),
      fileFilter: excelFileFilter,
      limits: { fileSize: FILE_SIZE_LIMITS.EXCEL_8MB },
    }),
  )
  async uploadStaffDeployExcel(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    return this.staffsService.uploadStaffDeploy(
      file,
      req.user.id,
      req.user.current_access_key,
    );
  }

  @Post("upload-buddy-up-excel")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads/staffs/buddy-up",
        filename: generateTimestampFilename,
      }),
      fileFilter: excelFileFilter,
      limits: { fileSize: FILE_SIZE_LIMITS.EXCEL_8MB },
    }),
  )
  async uploadStaffBuddyUpExcel(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    return this.staffsService.uploadStaffBuddyUp(
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
  @RequirePermissions({ module: "STAFF MANAGEMENTS", action: "VIEW" })
  async findOneHistory(@Param("id", ParseIntPipe) id: number) {
    return this.staffsService.findOneHistory(id);
  }

  @Patch(":id/transfer")
  @RequirePermissions({ module: "STAFF MANAGEMENTS", action: "TRANSFER" })
  async updateStaffTransfer(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateStaffTransferDto: UpdateStaffTransferDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffsService.staffTransfer(id, updateStaffTransferDto, userId);
  }

  @Patch(":id/activate-request")
  @RequirePermissions({ module: "STAFF MANAGEMENTS", action: "ACTIVATE" })
  async updateStaffRequestActivate(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateStaffTransferDto: UpdateStaffTransferDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    const accessKeyId = req.user.current_access_key;
    return this.staffsService.staffForRequestActivate(id, updateStaffTransferDto, userId,accessKeyId);
  }

  @Patch(":id/deploy")
  @RequirePermissions({ module: "STAFF MANAGEMENTS", action: "DEPLOY" })
  async updateStaffDeploy(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateStaffDeployDto: UpdateStaffDeployDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    const accessKeyId = req.user.current_access_key;
    return this.staffsService.staffDeploy(
      id,
      updateStaffDeployDto,
      userId,
      accessKeyId,
    );
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "STAFF MANAGEMENTS", action: "ACTIVATE" })
  async activateStatus(@Param("id", ParseIntPipe) id: number, @Request() req) {
    const userId = req.user.id;
    const staff = await this.staffsService.findOne(id);
    if (staff.status_id === 1) return staff;
    await this.staffsService.toggleStatus(id, userId);
    return this.staffsService.findOne(id);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "STAFF MANAGEMENTS", action: "DEACTIVATE" })
  async deactivateStatus(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    const staff = await this.staffsService.findOne(id);
    if (staff.status_id === 2) return staff;
    await this.staffsService.toggleStatus(id, userId);
    return this.staffsService.findOne(id);
  }

  @Post("/change-bulk-status")
  @RequirePermissions({ module: "STAFF MANAGEMENTS", action: "DEACTIVATE" })
  async toggleBulkStatus(
    @Body()
    body: { ids: number[]; reason_status_id: number; remarks?: string, effectivity_date?:string},
    @Request() req,
  ) {
    const userId = req.user.id;
    const accessKeyId = req.user.current_access_key;
    const { ids, reason_status_id, remarks,effectivity_date } = body;
    if (!Array.isArray(ids) || typeof reason_status_id !== "number") {
      throw new BadRequestException(
        "Invalid payload: ids and reason_status_id are required.",
      );
    }
    return this.staffsService.toggleBulkStatusRequest(
      ids,
      reason_status_id,
      userId,
      remarks,
      effectivity_date,
      accessKeyId
    );
  }


  @Post("/approve-staff")
  @RequirePermissions({ module: "STAFF DEACTIVATION APPROVAL", action: "APPROVE" })
  async updateApproveStaff(
    @Body() approvalStaffDto: ApprovalStaffDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffsService.approvalStaff(approvalStaffDto, userId);
  }

  
  @Post("/reject-staff")
  @RequirePermissions({ module: "STAFF DEACTIVATION APPROVAL", action: "REVERT" })
  async updateRejectStaff(
    @Body() rejectStaffDto: RejectStaffDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffsService.rejectStaff(rejectStaffDto, userId);
  }
}
