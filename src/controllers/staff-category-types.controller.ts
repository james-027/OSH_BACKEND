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
import { StaffCategoryTypesService } from "src/services/staff-category-types.service";
import { CreateStaffCategoryTypeDto } from "src/dto/CreateStaffCategoryTypeDto";
import { UpdateStaffCategoryTypeDto } from "src/dto/UpdateStaffCategoryTypeDto";

@Controller("staff-category-types")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StaffCategoryTypesController {
  constructor(
    private readonly staffCategoryTypesService: StaffCategoryTypesService,
  ) {}

  @Get()
  @RequirePermissions({ module: "STAFF CATEGORY TYPES", action: "VIEW" })
  async findAll(@Request() req) {
    return this.staffCategoryTypesService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "STAFF CATEGORY TYPES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.staffCategoryTypesService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "STAFF CATEGORY TYPES", action: "ADD" })
  async create(
    @Body() createStaffCategoryTypeDto: CreateStaffCategoryTypeDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffCategoryTypesService.create(
      createStaffCategoryTypeDto,
      userId,
    );
  }

  @Put(":id")
  @RequirePermissions({ module: "STAFF CATEGORY TYPES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateStaffCategoryTypeDto: UpdateStaffCategoryTypeDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffCategoryTypesService.update(
      id,
      updateStaffCategoryTypeDto,
      userId,
    );
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "STAFF CATEGORY TYPES", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffCategoryTypesService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "STAFF CATEGORY TYPES", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffCategoryTypesService.toggleStatus(id, userId);
  }
}
