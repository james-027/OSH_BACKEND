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
import { StaffSchedulingService } from "src/modules/staff-scheduling/services/staff-scheduling.service";
import { CreateScheduleHeaderDto } from "src/modules/staff-scheduling/dto/CreateStaffSchedulingDto";
import { UpdateScheduleHeaderDto } from "src/modules/staff-scheduling/dto/UpdateStaffSchedulingDto";
import { StaffScheduleReportFilterDto } from "src/modules/staff-scheduling/dto/StaffScheduleReportFilterDto";

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

@Controller("staffs-scheduling")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StaffSchedulingController {
  constructor(
    private readonly staffSchedulingService: StaffSchedulingService,
  ) {}

  @Get()
  @RequirePermissions({ module: "STAFF SCHEDULING", action: "VIEW" })
  async findAll(@Query("status_id") statusId?: string, @Request() req?: any,) {
    const parsedStatusId = statusId
      ? statusId.split(",").map(Number)
      : undefined;
    const accessKeyId = req?.user?.current_access_key;
    return this.staffSchedulingService.findAll(parsedStatusId, accessKeyId);
  }

  @Get("details")
  @RequirePermissions({ module: "STAFF SCHEDULING", action: "VIEW" })
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
  @RequirePermissions({ module: "STAFF SCHEDULING", action: "VIEW" })
  async findOneHistory(@Param("id", ParseIntPipe) id: number) {
    return this.staffSchedulingService.findOneHistory(id);
  }

  @Get(":id")
  @RequirePermissions({ module: "STAFF SCHEDULING", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.staffSchedulingService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "STAFF SCHEDULING", action: "ADD" })
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
@RequirePermissions({ module: "STAFF SCHEDULING", action: "ADD" })
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
  @RequirePermissions({ module: "STAFF SCHEDULING", action: "POST" })
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
  @RequirePermissions({ module: "STAFF SCHEDULING", action: "CANCEL" })
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
  @RequirePermissions({ module: "STAFF SCHEDULING", action: "REVERT" })
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
  @RequirePermissions({ module: "STAFF SCHEDULING", action: "EDIT" })
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

  @Get("reports/schedules")
  async getScheduleReport(
    @Query() filter: StaffScheduleReportFilterDto,
    @Request() req?: any,
  // ): Promise<any[]> {
  ): Promise<{ data: any[]; totals: any }> {

    const accessKeyId = req?.user?.current_access_key;

      const locationIds = filter.location_ids
    ? filter.location_ids
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => !isNaN(id))
    : undefined;

      const vendorIds = filter.vendor_ids
    ? filter.vendor_ids
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => !isNaN(id))
    : undefined;

    return this.staffSchedulingService.generateReportScheduleDetails(
      filter.schedule_header_id,
      accessKeyId,
      filter.date_from,
      filter.date_to,
      locationIds,
      vendorIds
    );
  }

  @Post("post-dws-schedule")
  @RequirePermissions({ module: "STAFF SCHEDULING", action: "POST" })
  async postDwsSchedule(
    @Body("schedule_date") scheduleDate: string,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffSchedulingService.syncDwsSchedulesByDate(
      scheduleDate,
      userId,
    );
  }


  
}