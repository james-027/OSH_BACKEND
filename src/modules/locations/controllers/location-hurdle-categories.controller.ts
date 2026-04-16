import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../guards/permissions.guard";
import { RequirePermissions } from "../../../decorators/permissions.decorator";
import { LocationHurdleCategoriesService } from "../services/location-hurdle-categories.service";
import { CreateLocationHurdleCategoryDto } from "../dto/CreateLocationHurdleCategoryDto";
import { UpdateLocationHurdleCategoryDto } from "../dto/UpdateLocationHurdleCategoryDto";

@Controller("location-hurdle-categories")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LocationHurdleCategoriesController {
  constructor(private readonly lhcService: LocationHurdleCategoriesService) {}

  @Get()
  @RequirePermissions({ module: "LOCATION_HURDLE_CATEGORIES", action: "VIEW" })
  async findAll() {
    return this.lhcService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "LOCATION_HURDLE_CATEGORIES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.lhcService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "LOCATION_HURDLE_CATEGORIES", action: "ADD" })
  async create(
    @Body() createDto: CreateLocationHurdleCategoryDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.lhcService.create(createDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "LOCATION_HURDLE_CATEGORIES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateLocationHurdleCategoryDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.lhcService.update(id, updateDto, userId);
  }

  @Delete(":id")
  @RequirePermissions({
    module: "LOCATION_HURDLE_CATEGORIES",
    action: "CANCEL",
  })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.lhcService.remove(id);
  }

  @Post(":id/toggle-status-activate")
  @RequirePermissions({
    module: "LOCATION_HURDLE_CATEGORIES",
    action: "ACTIVATE",
  })
  async activate(@Param("id", ParseIntPipe) id: number, @Request() req) {
    const userId = req.user.id;
    return this.lhcService.toggleStatus(id, true, userId);
  }

  @Post(":id/toggle-status-deactivate")
  @RequirePermissions({
    module: "LOCATION_HURDLE_CATEGORIES",
    action: "DEACTIVATE",
  })
  async deactivate(@Param("id", ParseIntPipe) id: number, @Request() req) {
    const userId = req.user.id;
    return this.lhcService.toggleStatus(id, false, userId);
  }
}
