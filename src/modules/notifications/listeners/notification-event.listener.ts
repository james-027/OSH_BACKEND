import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { NotificationsService } from "../services/notifications.service";
import { NotificationTriggerEvent } from "../events/notification-trigger.event";

@Injectable()
export class NotificationEventListener {
  private readonly logger = new Logger(NotificationEventListener.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Asynchronous non-blocking event listener for system-wide notification triggers.
   * Runs decoupled from the originating HTTP request lifecycle.
   */
  @OnEvent("notification.trigger", { async: true })
  async handleNotificationTrigger(event: NotificationTriggerEvent): Promise<void> {
    try {
      this.logger.log(
        `[NotificationEventListener] Received event "${event.eventCode}" for module "${event.moduleName}" (Ref #${event.refId})`,
      );
      await this.notificationsService.triggerNotification({
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
    } catch (error) {
      this.logger.error(
        `[NotificationEventListener] Error processing notification event "${event.eventCode}":`,
        error,
      );
    }
  }
}

