import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Module as ModuleEntity } from "../../../entities/Module";
import { NotificationTriggerEvent } from "../events/notification-trigger.event";
import { PublishNotificationOptions } from "../interfaces/notification-publish.options";
import { STATUS_IDS } from "src/constants/customConstants";
import logger from "src/config/logger";

@Injectable()
export class NotificationPublisherService implements OnModuleInit {
  // High-performance O(1) in-memory module registry
  private readonly moduleByName = new Map<string, ModuleEntity>();
  private readonly moduleByAlias = new Map<string, ModuleEntity>();
  private readonly moduleById = new Map<number, ModuleEntity>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(ModuleEntity)
    private readonly moduleRepo: Repository<ModuleEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshModuleCache();
  }

  /**
   * Loads all active modules into memory once on application startup.
   * Enables 0-cost, 0-DB-call instant lookups for route and module names.
   */
  async refreshModuleCache(): Promise<void> {
    try {
      const activeModules = await this.moduleRepo.find({
        where: { status_id: STATUS_IDS.ACTIVE },
        select: ["id", "module_name", "module_alias", "module_link", "status_id"],
      });

      this.moduleByName.clear();
      this.moduleByAlias.clear();
      this.moduleById.clear();

      for (const mod of activeModules) {
        if (mod.module_name) {
          this.moduleByName.set(mod.module_name.trim().toUpperCase(), mod);
        }
        if (mod.module_alias) {
          this.moduleByAlias.set(mod.module_alias.trim().toLowerCase(), mod);
        }
        this.moduleById.set(mod.id, mod);
      }

      logger.info(
        `[NotificationPublisherService] Cached ${activeModules.length} active modules in memory for zero-cost route resolution.`,
      );
    } catch (error) {
      logger.warn(
        `[NotificationPublisherService] Failed to preload module registry into memory:`,
        error,
      );
    }
  }

  /**
   * Fast O(1) in-memory module finder by ID, name, or alias.
   */
  findModule(identifier?: string | number): ModuleEntity | undefined {
    if (identifier === undefined || identifier === null) return undefined;

    if (typeof identifier === "number") {
      return this.moduleById.get(identifier);
    }

    const str = String(identifier).trim();
    if (!str) return undefined;

    // Check by ID if numeric string
    const num = Number(str);
    if (!isNaN(num) && this.moduleById.has(num)) {
      return this.moduleById.get(num);
    }

    // Check by exact name or alias
    return (
      this.moduleByName.get(str.toUpperCase()) ||
      this.moduleByAlias.get(str.toLowerCase())
    );
  }

  /**
   * Publishes a streamlined in-app notification event.
   * Synthesizes source, destination, and standardized navigation metadata.
   * Automatically resolves destination route from cached ModuleEntity.module_link if not explicitly passed.
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

      // 1. Resolve source module
      const foundSource = this.findModule(source?.moduleId ?? source?.module ?? options.moduleName);
      const sourceModule = foundSource?.module_name || source?.module || options.moduleName || "UNKNOWN";
      const sourceRefId = source?.refId ?? options.refId ?? 0;

      // 2. Resolve destination module & auto-derive route from module_link if omitted
      const foundDest = this.findModule(destination?.moduleId ?? destination?.module);
      const targetModuleName = foundDest?.module_name || destination?.module || "UNKNOWN";
      
      const targetRoute =
        destination?.route ||
        foundDest?.module_link ||
        options.navigation?.route ||
        (foundDest?.module_alias ? `/${foundDest.module_alias}` : "/");

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
              module: sourceModule,
              module_id: foundSource?.id ?? source?.moduleId ?? null,
              ref_id: source.refId,
              reference_no: source.referenceNo ?? null,
              status: source.status ?? null,
              remarks: source.remarks ?? null,
              ...(source.extra ?? {}),
            }
          : undefined,
        destination: destination
          ? {
              module: targetModuleName,
              module_id: foundDest?.id ?? destination?.moduleId ?? null,
              route: targetRoute,
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
