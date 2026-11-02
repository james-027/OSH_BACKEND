import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { NotificationsService } from "../services/notifications.service";
import { NotificationTriggerEvent } from "../events/notification-trigger.event";
import logger from "src/config/logger";

@Injectable()
export class NotificationEventListener {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Asynchronous non-blocking event listener for system-wide notification triggers.
   * Runs decoupled from the originating HTTP request lifecycle.
   */
  @OnEvent("notification.trigger", { async: true })
  async handleNotificationTrigger(event: NotificationTriggerEvent): Promise<void> {
    try {
      logger.info(
        `[NotificationEventListener] Received event "${event.eventCode}" for module "${event.moduleName}" (Ref #${event.refId}) from user #${event.creatorId}`,
      );
      const result = await this.notificationsService.triggerNotification({
        moduleName: event.moduleName,
        eventCode: event.eventCode,
        refId: event.refId,
        creatorId: event.creatorId,
        accessKeyId: event.accessKeyId,
        data: event.data,
        customTitle: event.customTitle,
        customDescription: event.customDescription,
        actionUrl: event.actionUrl,
      });

      if (result) {
        logger.info(
          `[NotificationEventListener] Notification #${result.id} successfully generated for event "${event.eventCode}" (Ref #${event.refId})`,
        );
      } else {
        logger.warn(
          `[NotificationEventListener] Notification skipped for event "${event.eventCode}" (Ref #${event.refId})`,
        );
      }
    } catch (error) {
      logger.error(
        `[NotificationEventListener] Error processing notification event "${event.eventCode}":`,
        error,
      );
    }
  }
}
