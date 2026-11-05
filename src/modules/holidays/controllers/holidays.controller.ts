import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../guards/permissions.guard";
import { RequirePermissions } from "../../../decorators/permissions.decorator";
import { HolidaysService } from "../services/holidays.service";
import { CreateHolidayDto } from "../dto/CreateHolidayDto";
import { UpdateHolidayDto } from "../dto/UpdateHolidayDto";
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

@Controller("holidays")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Get()
  @RequirePermissions({ module: "HOLIDAYS", action: "VIEW" })
  async findAll() {
    return this.holidaysService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "HOLIDAYS", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.holidaysService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "HOLIDAYS", action: "ADD" })
  async create(@Body() createHolidayDto: CreateHolidayDto, @Request() req) {
    const userId = req.user.id;
    return this.holidaysService.create(createHolidayDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "HOLIDAYS", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateHolidayDto: UpdateHolidayDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.holidaysService.update(id, updateHolidayDto, userId);
  }


  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "HOLIDAYS", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.holidaysService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "HOLIDAYS", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.holidaysService.toggleStatus(id, userId);
  }

   @Post("upload-excel")
    @UseInterceptors(
      FileInterceptor("file", {
        storage: diskStorage({
          destination: "./uploads/holidays",
          filename: generateTimestampFilename,
        }),
        fileFilter: excelFileFilter,
        limits: { fileSize: FILE_SIZE_LIMITS.EXCEL_8MB },
      }),
    )
    async uploadExcel(@UploadedFile() file: Express.Multer.File, @Request() req) {
      return this.holidaysService.uploadExcel(
        file,
        req.user.id,
      );
    }
}
