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
  @RequirePermissions({ module: "POSITIONS", action: "DATA ACCESS" })
  async findAll(@Request() req) {
    const accessKeyId = req.user?.current_access_key;
    return this.positionsService.findAll(accessKeyId);
  }

  @Get(":id")
  @RequirePermissions({ module: "POSITIONS", action: "DATA ACCESS" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    const accessKeyId = req.user?.current_access_key;
    return this.positionsService.findOne(id, accessKeyId);
  }

  @Post()
  @RequirePermissions({ module: "POSITIONS", action: "ADD" })
  async create(@Body() createPositionDto: CreatePositionDto, @Request() req) {
    const userId = req.user.id;
    const accessKeyId =
      createPositionDto.access_key_id || req.user?.current_access_key;
    return this.positionsService.create(createPositionDto, userId, accessKeyId);
  }

  @Put(":id")
  @RequirePermissions({ module: "POSITIONS", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updatePositionDto: UpdatePositionDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    const accessKeyId =
      updatePositionDto.access_key_id || req.user?.current_access_key;
    return this.positionsService.update(
      id,
      updatePositionDto,
      userId,
      accessKeyId,
    );
  }

  @Delete(":id")
  @RequirePermissions({ module: "POSITIONS", action: "CANCEL" })
  async remove(@Param("id", ParseIntPipe) id: number, @Request() req) {
    const accessKeyId = req.user?.current_access_key;
    return this.positionsService.remove(id, accessKeyId);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "POSITIONS", action: "EDIT" })
  async activateStatus(@Param("id", ParseIntPipe) id: number, @Request() req) {
    const userId = req.user.id;
    const accessKeyId = req.user?.current_access_key;
    const position = await this.positionsService.findOne(id, accessKeyId);
    if (position.status_id === 1) return position;
    await this.positionsService.toggleStatus(id, userId, accessKeyId);
    return this.positionsService.findOne(id, accessKeyId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "POSITIONS", action: "EDIT" })
  async deactivateStatus(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    const accessKeyId = req.user?.current_access_key;
    const position = await this.positionsService.findOne(id, accessKeyId);
    if (position.status_id === 2) return position;
    await this.positionsService.toggleStatus(id, userId, accessKeyId);
    return this.positionsService.findOne(id, accessKeyId);
  }
}
