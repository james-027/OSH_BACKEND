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
import { ReminderTypesService } from "src/services/reminder-types.service";
import { CreateReminderTypeDto } from "src/dto/CreateReminderTypeDto";
import { UpdateReminderTypeDto } from "src/dto/UpdateReminderTypeDto";

@Controller("reminder-types")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReminderTypesController {
  constructor(private readonly reminderTypesService: ReminderTypesService) {}

  @Get()
  @RequirePermissions({ module: "REMINDER TYPES", action: "VIEW" })
  async findAll(@Request() req) {
    return this.reminderTypesService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "REMINDER TYPES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.reminderTypesService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "REMINDER TYPES", action: "ADD" })
  async create(
    @Body() createReminderTypeDto: CreateReminderTypeDto,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.reminderTypesService.create(createReminderTypeDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "REMINDER TYPES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateReminderTypeDto: UpdateReminderTypeDto,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.reminderTypesService.update(id, updateReminderTypeDto, userId);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "REMINDER TYPES", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.reminderTypesService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "REMINDER TYPES", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.reminderTypesService.toggleStatus(id, userId);
  }
}
