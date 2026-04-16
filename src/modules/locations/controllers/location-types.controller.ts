import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  Put,
} from "@nestjs/common";
import { JwtAuthGuard } from "src/guards/jwt-auth.guard";
import { LocationTypesService } from "../services/location-types.service";
import { CreateLocationDto } from "src/modules/locations/dto/CreateLocationDto";
import { UpdateLocationTypeDto } from "src/modules/locations/dto/UpdateLocationTypeDto";
import { CreateLocationTypeDto } from "src/modules/locations/dto/CreateLocationTypeDto";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { PermissionsGuard } from "src/guards/permissions.guard";

@Controller("location-types")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LocationTypesController {
  constructor(private readonly locationTypesService: LocationTypesService) {}

  @Get()
  @RequirePermissions({ module: "LOCATION TYPES", action: "VIEW" })
  async findAll() {
    return this.locationTypesService.findAll();
  }

  @Get(":id")
  // @RequirePermissions({ module: "LOCATION TYPES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.locationTypesService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "LOCATION TYPES", action: "ADD" })
  async create(
    @Body() createLocationTypeDto: CreateLocationTypeDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.locationTypesService.create(createLocationTypeDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "LOCATION TYPES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateLocationTypeDto: UpdateLocationTypeDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.locationTypesService.update(id, updateLocationTypeDto, userId);
  }

  @Delete(":id")
  @RequirePermissions({ module: "LOCATION TYPES", action: "DELETE" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.locationTypesService.remove(id);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "LOCATION TYPES", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.locationTypesService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "LOCATION TYPES", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.locationTypesService.toggleStatus(id, userId);
  }
}
