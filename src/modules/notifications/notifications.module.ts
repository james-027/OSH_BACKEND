import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotificationsController } from "./controllers/notifications.controller";
import { NotificationsService } from "./services/notifications.service";
import { Notification } from "../../entities/Notification";
import { UserPermissions } from "src/entities/UserPermissions";

@Module({
  imports: [TypeOrmModule.forFeature([Notification, UserPermissions])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
