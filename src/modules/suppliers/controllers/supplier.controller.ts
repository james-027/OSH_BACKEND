import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Request,
  ParseIntPipe,
  UseGuards,
} from "@nestjs/common";

import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "../../../decorators/permissions.decorator";

import { SupplierService } from "../services/supplier.service";

import { CreateSupplierDto } from "../dto/CreateSupplierDto";
import { UpdateSupplierDto } from "../dto/UpdateSupplierDto";

@Controller("suppliers")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SupplierController {
  constructor(
    private readonly supplierService: SupplierService,
  ) {}

  @Get()
  @RequirePermissions({ module: "SUPPLIERS", action: "VIEW" })
  async findAll(@Request() req) {
    return this.supplierService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "SUPPLIERS", action: "VIEW" })
  async findOne(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.supplierService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "SUPPLIERS", action: "ADD" })
  async create(
    @Body() createSupplierDto: CreateSupplierDto,
    @Request() req,
  ) {
    const userId = req.user.id;

    return this.supplierService.create(
      createSupplierDto,
      userId,
    );
  }

  @Put(":id")
  @RequirePermissions({ module: "SUPPLIERS", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateSupplierDto: UpdateSupplierDto,
    @Request() req,
  ) {
    const userId = req.user.id;

    return this.supplierService.update(
      id,
      updateSupplierDto,
      userId,
    );
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({
    module: "SUPPLIERS",
    action: "ACTIVATE",
  })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;

    return this.supplierService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({
    module: "SUPPLIERS",
    action: "DEACTIVATE",
  })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;

    return this.supplierService.toggleStatus(id, userId);
  }
}