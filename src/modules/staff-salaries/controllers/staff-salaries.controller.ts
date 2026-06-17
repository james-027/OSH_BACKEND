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
import { StaffSalariesService } from "src/modules/staff-salaries/services/staff-salaries.service";
import { CreateStaffSalaryDto } from "src/modules/staff-salaries/dto/CreateStaffSalaryDto";
import { UpdateStaffSalaryDto } from "src/modules/staff-salaries/dto/UpdateStaffSalaryDto";

@Controller("staff-salaries")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StaffSalariesController {
  constructor(
    private readonly staffSalariesService: StaffSalariesService,
  ) {}

  @Get()
  @RequirePermissions({ module: "STAFF SALARIES", action: "VIEW" })
  async findAll(@Request() req) {
    const accessKeyId = req.user.current_access_key;

    return this.staffSalariesService.findAll(accessKeyId);
  }

  @Get(":id")
  @RequirePermissions({ module: "STAFF SALARIES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.staffSalariesService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "STAFF SALARIES", action: "ADD" })
  async create(
    @Body() createStaffSalaryDto: CreateStaffSalaryDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    const accessKeyId = req.user.current_access_key;
    return this.staffSalariesService.create(
      createStaffSalaryDto,
      userId,
      accessKeyId
    );
  }

  @Put(":id")
  @RequirePermissions({ module: "STAFF SALARIES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateStaffSalaryDto: UpdateStaffSalaryDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffSalariesService.update(
      id,
      updateStaffSalaryDto,
      userId,
    );
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "STAFF SALARIES", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffSalariesService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "STAFF SALARIES", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffSalariesService.toggleStatus(id, userId);
  }
}
