import {
  Controller,
  Get,
  Post,
  Put,
  Query,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException 
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { StaffAttendanceService } from "src/modules/staff-attendance/services/staff-attendance.service";
import { CreateScheduleHeaderDto } from "src/modules/staff-attendance/dto/CreateStaffSchedulingDto";
import { UpdateScheduleHeaderDto } from "src/modules/staff-attendance/dto/UpdateStaffSchedulingDto";
import {
  FileInterceptor,
  diskStorage,
} from "../../../adapters";

import {
  imageFileFilter,
  excelFileFilter,
  FILE_SIZE_LIMITS,
  generateTimestampFilename,
} from "../../../utils/file-upload.utils";

@Controller("staffs-attendance")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StaffAttendanceController {
  constructor(
    private readonly staffSchedulingService: StaffAttendanceService,
  ) {}

  @Get()
  @RequirePermissions({ module: "STAFF ATTENDANCE", action: "VIEW" })
  async findAll(@Query("attendance_status_id") statusId?: string , @Request() req?: any,) {
    const parsedStatusId = statusId
      ? statusId.split(",").map(Number)
      : undefined;
    const accessKeyId = req?.user?.current_access_key;
    return this.staffSchedulingService.findAll(parsedStatusId, accessKeyId);
  }

  // Placed before :id to prevent collision
  @Get("details")
  @RequirePermissions({ module: "STAFF ATTENDANCE", action: "VIEW" })
  async findScheduleHeaderDetails(
    @Query("schedule_header_id") scheduleHeaderId?: string,
    @Request() req?: any,
  ) {
    const accessKeyId = req?.user?.current_access_key;
    const parsedHeaderId = scheduleHeaderId
      ? Number(scheduleHeaderId)
      : undefined;

    return this.staffSchedulingService.findScheduleHeaderDetails(
      parsedHeaderId,
      accessKeyId,
    );
  }

  // Placed before :id to prevent collision
  @Get("history/:id")
  @RequirePermissions({ module: "STAFF ATTENDANCE", action: "VIEW" })
  async findOneHistory(@Param("id", ParseIntPipe) id: number) {
    return this.staffSchedulingService.findOneHistory(id);
  }

  @Get(":id")
  @RequirePermissions({ module: "STAFF ATTENDANCE", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.staffSchedulingService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "STAFF ATTENDANCE", action: "ADD" })
  async create(
    @Body() createScheduleHeader: CreateScheduleHeaderDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    const accessKeyId = req.user.current_access_key;
    return this.staffSchedulingService.create(
      createScheduleHeader,
      userId,
      accessKeyId,
    );
  }

@Post("upload-excel")
@RequirePermissions({ module: "STAFF ATTENDANCE", action: "ADD" })
@UseInterceptors(
  FileInterceptor("file", {
    storage: diskStorage({
      destination: "./uploads/staffs/scheduling",
      filename: generateTimestampFilename,
    }),
    fileFilter: excelFileFilter,
    limits: { fileSize: FILE_SIZE_LIMITS.EXCEL_8MB },
  }),
)
async uploadExcel(
  @UploadedFile() file: Express.Multer.File,
  @Query("schedule_date") scheduleDate: string,
  @Request() req,
) {
  if (!file) {
    throw new BadRequestException("File is required.");
  }

  if (!scheduleDate) {
    throw new BadRequestException("Schedule date is required.");
  }

  const userId = req.user.id;
  const accessKeyId = req.user.current_access_key;

  return this.staffSchedulingService.uploadExcel(
    file,
    scheduleDate,
    userId,
    accessKeyId,
  );
}

  @Patch("post-schedule")
  @RequirePermissions({ module: "STAFF ATTENDANCE", action: "POST" })
  async postSchedule(
    @Body() updateScheduleDto: UpdateScheduleHeaderDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffSchedulingService.postSchedule(
      updateScheduleDto,
      userId,
    );
  }

  @Patch("cancel-schedule")
  @RequirePermissions({ module: "STAFF ATTENDANCE", action: "CANCEL" })
  async cancelSchedule(
    @Body() updateScheduleDto: UpdateScheduleHeaderDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffSchedulingService.cancelSchedule(
      updateScheduleDto,
      userId,
    );
  }

  @Patch("revert-schedule")
  @RequirePermissions({ module: "STAFF ATTENDANCE", action: "REVERT" })
  async revertSchedule(
    @Body() updateScheduleDto: UpdateScheduleHeaderDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffSchedulingService.revertSchedule(
      updateScheduleDto,
      userId,
    );
  }

  @Put(":id")
  @RequirePermissions({ module: "STAFF ATTENDANCE", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateScheduleDto: UpdateScheduleHeaderDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffSchedulingService.update(
      id,
      updateScheduleDto,
      userId,
    );
  }
}