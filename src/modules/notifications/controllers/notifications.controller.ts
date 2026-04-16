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
import { NotificationsService } from "../services/notifications.service";
import { CreateNotificationDto } from "../dto/CreateNotificationDto";
import { UpdateNotificationDto } from "../dto/UpdateNotificationDto";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  create(
    @Body() createNotificationDto: CreateNotificationDto,
    @Req() req: any,
  ) {
    return this.notificationsService.create(
      createNotificationDto,
      req.user?.id || 0,
    );
  }

  @Get()
  findAll() {
    return this.notificationsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.notificationsService.findOne(+id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() updateNotificationDto: UpdateNotificationDto,
    @Req() req: any,
  ) {
    return this.notificationsService.update(
      +id,
      updateNotificationDto,
      req.user?.id || 0,
    );
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.notificationsService.remove(+id);
  }
}
