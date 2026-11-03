import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { NotificationTriggerEvent } from "../events/notification-trigger.event";
import { PublishNotificationOptions } from "../interfaces/notification-publish.options";
import logger from "src/config/logger";

@Injectable()
export class NotificationPublisherService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Publishes a streamlined in-app notification event.
   * Synthesizes source, destination, and standardized navigation metadata.
   */
  publish(options: PublishNotificationOptions): boolean {
    try {
      const {
        eventCode,
        creatorId,
        accessKeyId,
        locationIds,
        source,
        destination,
        fallbackTitle,
        fallbackDescription,
        fallbackActionUrl,
      } = options;

      // 1. Resolve source module and primary refId
      const sourceModule = source?.module || options.moduleName || "UNKNOWN";
      const sourceRefId = source?.refId ?? options.refId ?? 0;

      // 2. Synthesize clean React Navigation contract
      const targetRoute = destination?.route || options.navigation?.route || "/";
      const targetHighlightIds =
        destination?.refIds ??
        options.navigation?.highlightIds ??
        (sourceRefId ? [sourceRefId] : []);

      const synthesizedFilterParams: Record<string, unknown> = {
        ...(destination?.statusId != null
          ? { status_id: destination.statusId }
          : {}),
        ...(destination?.referenceNo
          ? { invoice: destination.referenceNo }
          : {}),
        ...(destination?.filterParams ?? options.navigation?.filterParams ?? {}),
      };

      const navigation = {
        route: targetRoute,
        highlight_ids: targetHighlightIds,
        primary_id: targetHighlightIds[0] ?? sourceRefId ?? null,
        filter_params: synthesizedFilterParams,
        action_modal: destination?.actionModal ?? options.navigation?.actionModal ?? null,
      };

      // 3. Structured standardized raw_data schema
      const standardizedData: Record<string, any> = {
        source: source
          ? {
              module: source.module,
              ref_id: source.refId,
              reference_no: source.referenceNo ?? null,
              status: source.status ?? null,
              remarks: source.remarks ?? null,
              ...(source.extra ?? {}),
            }
          : undefined,
        destination: destination
          ? {
              module: destination.module,
              route: destination.route,
              ref_ids: destination.refIds ?? [],
              reference_no: destination.referenceNo ?? null,
              status_id: destination.statusId ?? null,
              filter_params: destination.filterParams ?? {},
            }
          : undefined,
        navigation,
        // Common template interpolation helpers
        remarks: source?.remarks ?? options.payload?.remarks ?? "",
        reference_no: source?.referenceNo ?? destination?.referenceNo ?? "",
        ref_ids:
          targetHighlightIds.length > 0 ? targetHighlightIds.join(", ") : "",
        payroll_invoices: destination?.referenceNo ?? source?.referenceNo ?? "",
        source_ref_id: sourceRefId,
        target_ref_id: targetHighlightIds[0] ?? null,
        ...(options.payload ?? {}),
      };

      this.eventEmitter.emit(
        "notification.trigger",
        new NotificationTriggerEvent(
          sourceModule,
          eventCode,
          sourceRefId,
          creatorId,
          accessKeyId,
          standardizedData,
          fallbackTitle,
          fallbackDescription,
          fallbackActionUrl ?? targetRoute,
          locationIds,
        ),
      );

      return true;
    } catch (error) {
      logger.error(
        `[NotificationPublisherService] Failed to publish notification for event "${options.eventCode}":`,
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
