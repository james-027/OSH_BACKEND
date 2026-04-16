import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Req,
} from "@nestjs/common";
import { ActionLogsService } from "../services/action-logs.service";
import { CreateActionLogDto } from "../dto/CreateActionLogDto";
import { UpdateActionLogDto } from "../dto/UpdateActionLogDto";

@Controller("action-logs")
export class ActionLogsController {
  constructor(private readonly actionLogsService: ActionLogsService) {}

  @Post()
  create(@Body() createActionLogDto: CreateActionLogDto, @Req() req: any) {
    return this.actionLogsService.create(createActionLogDto, req.user?.id || 0);
  }

  @Get()
  findAll() {
    return this.actionLogsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.actionLogsService.findOne(+id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() updateActionLogDto: UpdateActionLogDto,
    @Req() req: any
  ) {
    return this.actionLogsService.update(
      +id,
      updateActionLogDto,
      req.user?.id || 0
    );
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.actionLogsService.remove(+id);
  }
}
