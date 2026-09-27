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
import { WorkingDaysService } from "src/modules/working-days/services/working-days.service";
import { CreateTrainingDto } from "src/modules/trainings/dto/CreateTrainingDto";
import { UpdateTrainingDto } from "src/modules/trainings/dto/UpdateTrainingDto";

@Controller("working-days")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkingDaysController {
  constructor(private readonly workingDaysService: WorkingDaysService) {}

  @Get()
  async findAll(@Request() req) {
    return this.workingDaysService.findAll();
  }


}
