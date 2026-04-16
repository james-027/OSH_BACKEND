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
import { SegmentsService } from "../services/segments.service";
import { CreateSegmentDto } from "../dto/CreateSegmentDto";
import { UpdateSegmentDto } from "../dto/UpdateSegmentDto";

@Controller("segments")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SegmentsController {
  constructor(private readonly segmentsService: SegmentsService) {}

  @Get()
  @RequirePermissions({ module: "SEGMENTS", action: "VIEW" })
  async findAll() {
    return this.segmentsService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "SEGMENTS", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.segmentsService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "SEGMENTS", action: "ADD" })
  async create(@Body() createSegmentDto: CreateSegmentDto, @Request() req) {
    const userId = req.user.id;
    return this.segmentsService.create(createSegmentDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "SEGMENTS", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateSegmentDto: UpdateSegmentDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.segmentsService.update(id, updateSegmentDto, userId);
  }

  @Delete(":id")
  @RequirePermissions({ module: "SEGMENTS", action: "CANCEL" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.segmentsService.remove(id);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "SEGMENTS", action: "ACTIVATE" })
  async activateStatus(@Param("id", ParseIntPipe) id: number, @Request() req) {
    const userId = req.user.id;
    const segment = await this.segmentsService.findOne(id);
    if (segment.status_id === 1) return segment;
    await this.segmentsService.toggleStatus(id, userId);
    return this.segmentsService.findOne(id);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "SEGMENTS", action: "DEACTIVATE" })
  async deactivateStatus(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    const segment = await this.segmentsService.findOne(id);
    if (segment.status_id === 2) return segment;
    await this.segmentsService.toggleStatus(id, userId);
    return this.segmentsService.findOne(id);
  }
}
