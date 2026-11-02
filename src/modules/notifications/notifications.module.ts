import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotificationsController } from "./controllers/notifications.controller";
import { NotificationsService } from "./services/notifications.service";
import { NotificationEventListener } from "./listeners/notification-event.listener";
import { Notification } from "../../entities/Notification";
import { NotificationRecipient } from "../../entities/NotificationRecipient";
import { NotificationMatrix } from "../../entities/NotificationMatrix";
import { NotificationMatrixRecipient } from "../../entities/NotificationMatrixRecipient";
import { Module as ModuleEntity } from "../../entities/Module";
import { User } from "../../entities/User";
import { UserPermissions } from "src/entities/UserPermissions";
import { SSEModule } from "../sse/sse.module";
import { Action } from "src/entities/Action";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationRecipient,
      NotificationMatrix,
      NotificationMatrixRecipient,
      ModuleEntity,
      User,
      UserPermissions,
      Action,
    ]),
    SSEModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationEventListener],
  exports: [NotificationsService],
})
export class NotificationsModule {}
