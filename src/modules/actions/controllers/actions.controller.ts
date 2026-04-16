import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { ActionsService } from "../services/actions.service";
import { JwtAuthGuard } from "@guards/jwt-auth.guard";
import { CreateActionDto } from "src/modules/actions/dto/CreateActionDto";
import { UpdateActionDto } from "src/modules/actions/dto/UpdateActionDto";

@Controller("actions")
@UseGuards(JwtAuthGuard)
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Get()
  async findAll() {
    return this.actionsService.findAll();
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.actionsService.findOne(+id);
  }

  @Post()
  async create(@Body() createActionDto: CreateActionDto) {
    return this.actionsService.create(createActionDto);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() updateActionDto: UpdateActionDto,
  ) {
    return this.actionsService.update(+id, updateActionDto);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    return this.actionsService.remove(+id);
  }

  @Patch(":id/toggle-status")
  async toggleStatus(@Param("id") id: string) {
    return this.actionsService.toggleStatus(+id);
  }
}
