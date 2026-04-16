import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  UseGuards,
  Req,
  ParseIntPipe,
} from "@nestjs/common";
import { RegionsService } from "../services/regions.service";
import { CreateRegionDto } from "../dto/CreateRegionDto";
import { UpdateRegionDto } from "../dto/UpdateRegionDto";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../guards/permissions.guard";
import { DynamicPermissionsGuard } from "../../../guards/dynamic-permissions.guard";
import { RequirePermissions } from "../../../decorators/permissions.decorator";

@Controller("regions")
@UseGuards(JwtAuthGuard)
export class RegionsController {
  constructor(private readonly regionsService: RegionsService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "REGIONS", action: "ADD" })
  async create(@Body() createRegionDto: CreateRegionDto, @Req() req: any) {
    const userId = req.user.id;
    return await this.regionsService.create(createRegionDto, userId);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "REGIONS", action: "VIEW" })
  async findAll() {
    return await this.regionsService.findAll();
  }

  @Get(":id")
  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "REGIONS", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return await this.regionsService.findOne(id);
  }

  @Put(":id")
  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "REGIONS", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateRegionDto: UpdateRegionDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return await this.regionsService.update(id, updateRegionDto, userId);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "REGIONS", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return await this.regionsService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @UseGuards(DynamicPermissionsGuard)
  @RequirePermissions({ module: "REGIONS", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return await this.regionsService.toggleStatus(id, userId);
  }

  @Delete(":id")
  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "REGIONS", action: "CANCEL" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return await this.regionsService.remove(id);
  }
}
