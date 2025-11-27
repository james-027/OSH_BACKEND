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
import { RenewalTypesService } from "src/services/renewal-types.service";
import { CreateRenewalTypeDto } from "src/dto/CreateRenewalTypeDto";
import { UpdateRenewalTypeDto } from "src/dto/UpdateRenewalTypeDto";

@Controller("renewal-types")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RenewalTypesController {
  constructor(private readonly renewalTypesService: RenewalTypesService) {}

  @Get()
  @RequirePermissions({ module: "RENEWAL TYPES", action: "VIEW" })
  async findAll(@Request() req) {
    return this.renewalTypesService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "RENEWAL TYPES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.renewalTypesService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "RENEWAL TYPES", action: "ADD" })
  async create(
    @Body() createRenewalTypeDto: CreateRenewalTypeDto,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.renewalTypesService.create(createRenewalTypeDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "RENEWAL TYPES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateRenewalTypeDto: UpdateRenewalTypeDto,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.renewalTypesService.update(id, updateRenewalTypeDto, userId);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "RENEWAL TYPES", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.renewalTypesService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "RENEWAL TYPES", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.renewalTypesService.toggleStatus(id, userId);
  }
}
