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
import { RequirePermissions } from "../../../decorators/permissions.decorator";

import { ProfitcenterService } from "../services/profitcenter.service";

import { CreateProfitcenterDto } from "../dto/CreateProfitcenterDto";
import { UpdateProfitcenterDto } from "../dto/UpdateProfitcenterDto";

@Controller("profitcenters")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProfitcenterController {
  constructor(
    private readonly profitcenterService: ProfitcenterService,
  ) {}

  @Get()
  @RequirePermissions({
    module: "PROFIT CENTERS",
    action: "VIEW",
  })
  async findAll(@Request() req) {
    return this.profitcenterService.findAll();
  }

  @Get(":id")
  @RequirePermissions({
    module: "PROFIT CENTERS",
    action: "VIEW",
  })
  async findOne(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.profitcenterService.findOne(id);
  }

  @Post()
  @RequirePermissions({
    module: "PROFIT CENTERS",
    action: "ADD",
  })
  async create(
    @Body() createProfitcenterDto: CreateProfitcenterDto,
    @Request() req,
  ) {
    const userId = req.user.id;

    return this.profitcenterService.create(
      createProfitcenterDto,
      userId,
    );
  }

  @Put(":id")
  @RequirePermissions({
    module: "PROFIT CENTERS",
    action: "EDIT",
  })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateProfitcenterDto: UpdateProfitcenterDto,
    @Request() req,
  ) {
    const userId = req.user.id;

    return this.profitcenterService.update(
      id,
      updateProfitcenterDto,
      userId,
    );
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({
    module: "PROFIT CENTERS",
    action: "ACTIVATE",
  })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;

    return this.profitcenterService.toggleStatus(
      id,
      userId,
    );
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({
    module: "PROFIT CENTERS",
    action: "DEACTIVATE",
  })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;

    return this.profitcenterService.toggleStatus(
      id,
      userId,
    );
  }
}