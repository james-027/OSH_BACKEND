import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { NotificationTriggerEvent } from "../events/notification-trigger.event";
import { PublishNotificationOptions } from "../interfaces/notification-publish.options";
import logger from "src/config/logger";

@Injectable()
export class NotificationPublisherService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Publishes a single dynamic in-app notification event safely and asynchronously.
   * Standardizes the { navigation, payload } data schema for the front-end.
   */
  publish(options: PublishNotificationOptions): boolean {
    try {
      const {
        moduleName,
        eventCode,
        refId,
        creatorId,
        accessKeyId,
        locationIds,
        navigation,
        payload = {},
        fallbackTitle,
        fallbackDescription,
        fallbackActionUrl,
      } = options;

      // Standardize data contract: { navigation, payload, ...flattenedPayload }
      const standardizedData: Record<string, any> = {
        navigation: navigation
          ? {
              route: navigation.route,
              highlight_ids: navigation.highlightIds ?? (refId ? [refId] : []),
              primary_id: navigation.primaryId ?? refId,
              filter_params: navigation.filterParams ?? {},
              action_modal: navigation.actionModal ?? null,
            }
          : undefined,
        payload: {
          ...payload,
          location_ids: locationIds,
        },
        // Flatten payload fields to allow template variable interpolation (e.g. {remarks})
        ...payload,
      };

      this.eventEmitter.emit(
        "notification.trigger",
        new NotificationTriggerEvent(
          moduleName,
          eventCode,
          refId,
          creatorId,
          accessKeyId,
          standardizedData,
          fallbackTitle,
          fallbackDescription,
          fallbackActionUrl ?? navigation?.route,
          locationIds,
        ),
      );

      return true;
    } catch (error) {
      logger.error(
        `[NotificationPublisherService] Failed to publish notification for event "${options.eventCode}" (Ref #${options.refId}):`,
        error,
      );
      return false;
    }
  }

  /**
   * Batch-publishes multiple notification events safely.
   */
  publishBatch(optionsList: PublishNotificationOptions[]): void {
    if (!Array.isArray(optionsList) || optionsList.length === 0) {
      return;
    }

    for (const options of optionsList) {
      this.publish(options);
    }
  }
}

