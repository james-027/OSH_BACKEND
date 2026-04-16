import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../guards/permissions.guard";
import { RequirePermissions } from "../../../decorators/permissions.decorator";
import { BrandsService } from "../services/brands.service";
import { CreateBrandDto } from "../dto/CreateBrandDto";
import { UpdateBrandDto } from "../dto/UpdateBrandDto";

@Controller("brands")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @RequirePermissions({ module: "BRANDS", action: "VIEW" })
  async findAll() {
    return this.brandsService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "BRANDS", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.brandsService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "BRANDS", action: "ADD" })
  async create(@Body() createBrandDto: CreateBrandDto, @Request() req) {
    const userId = req.user.id;
    return this.brandsService.create(createBrandDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "BRANDS", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateBrandDto: UpdateBrandDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.brandsService.update(id, updateBrandDto, userId);
  }

  @Delete(":id")
  @RequirePermissions({ module: "BRANDS", action: "CANCEL" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.brandsService.remove(id);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "BRANDS", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.brandsService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "BRANDS", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.brandsService.toggleStatus(id, userId);
  }
}
