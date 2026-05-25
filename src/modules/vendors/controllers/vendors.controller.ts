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
import { VendorsService } from "src/modules/vendors/services/vendors.service";
import { CreateVendorDto } from "src/modules/vendors/dto/CreateVendorDto";
import { UpdateVendorDto } from "src/modules/vendors/dto/UpdateVendorDto";

@Controller("vendors")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  @RequirePermissions({ module: "VENDORS", action: "VIEW" })
  async findAll(@Request() req) {
    const accessKeyId = req.user.current_access_key;
    return this.vendorsService.findAll(accessKeyId);
  }

  @Get(":id")
  @RequirePermissions({ module: "VENDORS", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.vendorsService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "VENDORS", action: "ADD" })
  async create(@Body() createVendorDto: CreateVendorDto, @Request() req) {
    const userId = req.user.id;
    return this.vendorsService.create(createVendorDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "VENDORS", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateVendorDto: UpdateVendorDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.vendorsService.update(id, updateVendorDto, userId);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "VENDORS", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.vendorsService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "VENDORS", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.vendorsService.toggleStatus(id, userId);
  }
}
