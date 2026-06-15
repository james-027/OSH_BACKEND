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
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { StaffTrainingService } from "src/modules/staff-trainings/services/staff-trainings.service";
import { CreateStaffTrainingDto } from "src/modules/staff-trainings/dto/CreateStaffTrainingDto";
import { UpdateStaffTrainingDto } from "src/modules/staff-trainings/dto/UpdateStaffTrainingDto";

@Controller("staff-trainings")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StaffTrainingsController {
  constructor(
    private readonly staffTrainingsService: StaffTrainingService,
  ) {}

@Get()
@RequirePermissions({ module: "STAFFS", action: "VIEW" })
async findAll(
) {

  return this.staffTrainingsService.findAll();
}

  @Get(":id")
  @RequirePermissions({ module: "STAFFS", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.staffTrainingsService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "STAFFS", action: "ADD" })
  async create(
    @Body() createStaffTrainingDto: CreateStaffTrainingDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    const accessKeyId = req.user.current_access_key;
    return this.staffTrainingsService.create(
      createStaffTrainingDto,
      userId,
      accessKeyId
    );
  }

  @Put(":id")
  @RequirePermissions({ module: "STAFFS", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateStaffTrainingDto: UpdateStaffTrainingDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffTrainingsService.update(
      id,
      updateStaffTrainingDto,
      userId,
    );
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "STAFFS", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffTrainingsService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "STAFFS", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffTrainingsService.toggleStatus(id, userId);
  }

  
}
