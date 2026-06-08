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
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { TrainingService } from "src/modules/trainings/services/trainings.service";
import { CreateTrainingDto } from "src/modules/trainings/dto/CreateTrainingDto";
import { UpdateTrainingDto } from "src/modules/trainings/dto/UpdateTrainingDto";

@Controller("trainings")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TrainingsController {
  constructor(private readonly trainingsService: TrainingService) {}

  @Get()
  async findAll(@Request() req) {
    const accessKeyId = req.user.current_access_key;
    return this.trainingsService.findAll(accessKeyId);
  }

  @Get(":id")
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.trainingsService.findOne(id);
  }

  @Post()
  async create(@Body() createTrainingDto: CreateTrainingDto, @Request() req) {
    const userId = req.user.id;
    const accessKeyId = req.user.current_access_key;
    return this.trainingsService.create(createTrainingDto, userId,accessKeyId);
  }

  @Put(":id")
  @RequirePermissions({ module: "TRAININGS", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateTrainingDto: UpdateTrainingDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.trainingsService.update(id, updateTrainingDto, userId);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "TRAININGS", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.trainingsService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "TRAININGS", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.trainingsService.toggleStatus(id, userId);
  }
}
