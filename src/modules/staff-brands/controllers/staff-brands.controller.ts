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
import { StaffBrandsService } from "src/modules/staff-brands/services/staff-brands.service";
import { CreateStaffBrandDto } from "src/modules/staff-brands/dto/CreateStaffBrandDto";
import { UpdateStaffBrandDto } from "src/modules/staff-brands/dto/UpdateStaffBrandDto";

@Controller("staff-brands")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StaffBrandsController {
  constructor(private readonly staffBrandsService: StaffBrandsService) {}

  @Get()
  @RequirePermissions({ module: "STAFF BRANDS", action: "VIEW" })
  async findAll(@Request() req) {
    const accessKeyId = req.user.current_access_key;

    return this.staffBrandsService.findAll(accessKeyId);
  }

  @Get(":id")
  @RequirePermissions({ module: "STAFF BRANDS", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.staffBrandsService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "STAFF BRANDS", action: "ADD" })
  async create(
    @Body() createStaffBrandDto: CreateStaffBrandDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffBrandsService.create(createStaffBrandDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "STAFF BRANDS", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateStaffBrandDto: UpdateStaffBrandDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffBrandsService.update(id, updateStaffBrandDto, userId);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "STAFF BRANDS", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffBrandsService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "STAFF BRANDS", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffBrandsService.toggleStatus(id, userId);
  }
}
