import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotificationsController } from "./controllers/notifications.controller";
import { NotificationsService } from "./services/notifications.service";
import { NotificationPublisherService } from "./services/notification-publisher.service";
import { NotificationEventListener } from "./listeners/notification-event.listener";
import { Notification } from "../../entities/Notification";
import { NotificationRecipient } from "../../entities/NotificationRecipient";
import { NotificationMatrix } from "../../entities/NotificationMatrix";
import { NotificationMatrixRecipient } from "../../entities/NotificationMatrixRecipient";
import { Module as ModuleEntity } from "../../entities/Module";
import { User } from "../../entities/User";
import { UserPermissions } from "src/entities/UserPermissions";
import { UserLocations } from "src/entities/UserLocations";
import { TransactionSequence } from "src/entities/TransactionSequence";
import { SSEModule } from "../sse/sse.module";
import { Action } from "src/entities/Action";
import { UsersModule } from "../users/users.module";
import { CommonUtilitiesService } from "src/services/common-utilities.service";

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
      UserLocations,
      TransactionSequence,
      Action,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationPublisherService,
    NotificationEventListener,
    CommonUtilitiesService,
  ],
  exports: [NotificationsService, NotificationPublisherService],
})
export class NotificationsModule {}
