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
  BadRequestException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { StaffAttendanceService } from "src/modules/staff-attendance/services/staff-attendance.service";
import { CreateScheduleHeaderDto } from "src/modules/staff-attendance/dto/CreateStaffSchedulingDto";
import { AttendanceReportFilter } from "src/modules/staff-attendance/dto/AttendanceReportFilterDto";
import { UpdateScheduleHeaderDto } from "src/modules/staff-attendance/dto/UpdateStaffSchedulingDto";
import { FileInterceptor, diskStorage } from "../../../adapters";

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
    private readonly staffAttendanceService: StaffAttendanceService,
  ) {}

  @Get()
  @RequirePermissions({ module: "STAFF ATTENDANCE", action: "VIEW" })
  async findAll(
    @Query("attendance_status_id") statusId?: string,
    @Request() req?: any,
  ) {
    const parsedStatusId = statusId
      ? statusId.split(",").map(Number)
      : undefined;
    const accessKeyId = req?.user?.current_access_key;
    const userId = req.user?.id;
    const roleId = req.user?.role_id;

    return this.staffAttendanceService.findAll(
      parsedStatusId,
      accessKeyId,
      userId,
      roleId,
    );
  }

  @Get("details")
  @RequirePermissions({ module: "STAFF ATTENDANCE", action: "VIEW" })
  async findScheduleHeaderDetails(
    @Query("schedule_header_id") scheduleHeaderId?: string,
    @Request() req?: any,
  ) {
    const accessKeyId = req?.user?.current_access_key;
    const userId = req.user?.id;
    const roleId = req.user?.role_id;
    const parsedHeaderId = scheduleHeaderId
      ? Number(scheduleHeaderId)
      : undefined;

    return this.staffAttendanceService.findScheduleHeaderDetails(
      parsedHeaderId,
      accessKeyId,
      userId,
      roleId,
    );
  }

  @Get("schedule-details")
  @RequirePermissions({ module: "STAFF ATTENDANCE", action: "VIEW" })
  async findScheduleDetails(
    @Query("attendance_status_id") attendanceStatusId?: string,
    @Request() req?: any,
  ) {
    const accessKeyId = req?.user?.current_access_key;
    const userId = req.user?.id;
    const roleId = req.user?.role_id;
    const parsedStatusId = attendanceStatusId
      ? Number(attendanceStatusId)
      : undefined;

    return this.staffAttendanceService.findAllScheduleDetails(
      accessKeyId,
      parsedStatusId,
      userId,
      roleId,
    );
  }

  @Post("attendance-reports")
  @RequirePermissions({ module: "ATTENDANCE REPORT", action: "VIEW" })
  async getPayrollReport(
    @Body() filter: AttendanceReportFilter,
    @Request() req?: any,
  ): Promise<any[]> {
    const accessKeyId = req?.user?.current_access_key;
    const userId = req.user?.id;
    const roleId = req.user?.role_id;

    return this.staffAttendanceService.generateAttendanceReport(
      accessKeyId,
      filter.date_from,
      filter.date_to,
      filter.vendor_ids,
      filter.location_ids,
      userId,
      roleId,
    );
  }

  // Placed before :id to prevent collision
  @Get("history/:id")
  @RequirePermissions({ module: "STAFF ATTENDANCE", action: "VIEW" })
  async findOneHistory(@Param("id", ParseIntPipe) id: number) {
    return this.staffAttendanceService.findOneHistory(id);
  }

  @Get(":id")
  @RequirePermissions({ module: "STAFF ATTENDANCE", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.staffAttendanceService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "STAFF ATTENDANCE", action: "ADD" })
  async create(
    @Body() createScheduleHeader: CreateScheduleHeaderDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    const accessKeyId = req.user.current_access_key;
    return this.staffAttendanceService.create(
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

    return this.staffAttendanceService.uploadExcel(
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
    return this.staffAttendanceService.postSchedule(updateScheduleDto, userId);
  }

  @Patch("cancel-schedule")
  @RequirePermissions({ module: "STAFF ATTENDANCE", action: "CANCEL" })
  async cancelSchedule(
    @Body() updateScheduleDto: UpdateScheduleHeaderDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffAttendanceService.cancelSchedule(
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
    return this.staffAttendanceService.revertSchedule(
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
    return this.staffAttendanceService.update(id, updateScheduleDto, userId);
  }
}
