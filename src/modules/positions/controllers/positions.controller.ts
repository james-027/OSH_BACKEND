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
import { PositionsService } from "../services/positions.service";
import { CreatePositionDto } from "../dto/CreatePositionDto";
import { UpdatePositionDto } from "../dto/UpdatePositionDto";

@Controller("positions")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get()
  @RequirePermissions(
    { module: "POSITIONS", action: "DATA ACCESS" },
    // { module: "POSITIONS", action: "VIEW" }
  )
  async findAll() {
    return this.positionsService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "POSITIONS", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.positionsService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "POSITIONS", action: "ADD" })
  async create(@Body() createPositionDto: CreatePositionDto, @Request() req) {
    const userId = req.user.id;
    return this.positionsService.create(createPositionDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "POSITIONS", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updatePositionDto: UpdatePositionDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.positionsService.update(id, updatePositionDto, userId);
  }

  @Delete(":id")
  @RequirePermissions({ module: "POSITIONS", action: "CANCEL" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.positionsService.remove(id);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "POSITIONS", action: "EDIT" })
  async activateStatus(@Param("id", ParseIntPipe) id: number, @Request() req) {
    const userId = req.user.id;
    const position = await this.positionsService.findOne(id);
    if (position.status_id === 1) return position;
    await this.positionsService.toggleStatus(id, userId);
    return this.positionsService.findOne(id);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "POSITIONS", action: "EDIT" })
  async deactivateStatus(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    const position = await this.positionsService.findOne(id);
    if (position.status_id === 2) return position;
    await this.positionsService.toggleStatus(id, userId);
    return this.positionsService.findOne(id);
  }
}
