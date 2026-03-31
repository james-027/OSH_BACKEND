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
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { StaffsService } from "src/services/staffs.service";
import { CreateStaffDto } from "src/dto/CreateStaffDto";
import { UpdateStaffDto } from "src/dto/UpdateStaffDto";

@Controller("staffs")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StaffsController {
  constructor(private readonly staffsService: StaffsService) {}

  @Get()
  @RequirePermissions({ module: "STAFFS", action: "VIEW" })
  async findAll(@Request() req) {
    return this.staffsService.findAll();
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
    return this.staffsService.create(createStaffDto, userId);
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
}
