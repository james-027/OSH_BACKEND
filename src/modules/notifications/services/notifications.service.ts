import logger from "src/config/logger";
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, In, EntityManager } from "typeorm";
import { Notification } from "src/entities/Notification";
import { NotificationRecipient } from "src/entities/NotificationRecipient";
import { NotificationMatrix } from "src/entities/NotificationMatrix";
import { NotificationMatrixRecipient } from "src/entities/NotificationMatrixRecipient";
import { Module } from "src/entities/Module";
import { User } from "src/entities/User";
import { UserPermissions } from "src/entities/UserPermissions";
import { CommonUtilitiesService } from "src/services/common-utilities.service";
import { SSEEmitterService } from "src/modules/sse/services/sse-emitter.service";
import { getRedisClient } from "src/config/cache.config";
import { CreateNotificationDto } from "../dto/CreateNotificationDto";
import { UpdateNotificationDto } from "../dto/UpdateNotificationDto";
import {
  CreateNotificationMatrixDto,
  UpdateNotificationMatrixDto,
} from "../dto/NotificationMatrixDto";
import {
  NotificationQueryDto,
  AdminNotificationAuditDto,
} from "../dto/NotificationQueryDto";
import {
  STATUS_IDS,
  NOTIFICATION_EVENT_CATALOG,
} from "src/constants/customConstants";

export interface TriggerNotificationParams {
  moduleId?: number;
  moduleName?: string;
  eventCode: string;
  refId: number;
  creatorId: number;
  accessKeyId?: number | null;
  locationIds?: number[];
  data?: Record<string, any>;
  customTitle?: string;
  customDescription?: string;
  actionUrl?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,

    @InjectRepository(NotificationRecipient)
    private readonly recipientRepository: Repository<NotificationRecipient>,

    @InjectRepository(NotificationMatrix)
    private readonly matrixRepository: Repository<NotificationMatrix>,

    @InjectRepository(NotificationMatrixRecipient)
    private readonly matrixRecipientRepository: Repository<NotificationMatrixRecipient>,

    @InjectRepository(Module)
    private readonly moduleRepository: Repository<Module>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly sseEmitterService: SSEEmitterService,
    private readonly commonUtilitiesService: CommonUtilitiesService,
    private readonly dataSource: DataSource,
  ) {}

  // =========================================================================
  // 1. DYNAMIC NOTIFICATION TRIGGER ENGINE (DRY & OPTIMIZED)
  // =========================================================================

  /**
   * Universal trigger method. Matches dynamic matrix rules, determines recipient
   * roles and users, persists header + recipient rows, updates cache, and sends SSE signal.
   */
  async triggerNotification(
    params: TriggerNotificationParams,
  ): Promise<Notification | null> {
    try {
      const {
        moduleId,
        moduleName,
        eventCode,
        refId,
        creatorId,
        accessKeyId,
        locationIds,
        data = {},
        customTitle,
        customDescription,
        actionUrl,
      } = params;

      // 1. Find active matrix rule for this module and event
      const queryBuilder = this.matrixRepository
        .createQueryBuilder("matrix")
        .leftJoinAndSelect("matrix.module", "module")
        .leftJoinAndSelect(
          "matrix.recipients",
          "recipients",
          "recipients.status_id = :recStatus",
          { recStatus: 1 },
        )
        .leftJoinAndSelect("recipients.role", "role")
        .leftJoinAndSelect("recipients.user", "user")
        .where("matrix.event_code = :eventCode", { eventCode })
        .andWhere("matrix.status_id = :statusId", { statusId: 1 });

      if (moduleId) {
        queryBuilder.andWhere("matrix.module_id = :moduleId", { moduleId });
      } else if (moduleName) {
        queryBuilder.andWhere(
          "(module.module_name = :moduleName OR module.module_alias = :moduleName)",
          { moduleName },
        );
      } else {
        this.logger.warn(
          `[TriggerNotification] Skipped: neither moduleId nor moduleName was provided for event ${eventCode}`,
        );
        return null;
      }

      const matrixRule = await queryBuilder.getOne();

      if (!matrixRule) {
        this.logger.log(
          `[TriggerNotification] No active matrix rule found for event "${eventCode}". Notification skipped.`,
        );
        return null;
      }

      if (!matrixRule.recipients || matrixRule.recipients.length === 0) {
        this.logger.log(
          `[TriggerNotification] Matrix rule #${matrixRule.id} has no active recipients configured.`,
        );
        return null;
      }

      // 2. Fetch Creator Info for template interpolation
      const creator = await this.userRepository.findOne({
        where: { id: creatorId },
        select: [
          "id",
          "user_name",
          "first_name",
          "last_name",
          "current_access_key",
          "role_id",
        ],
      });
      const resolvedAccessKeyId =
        accessKeyId !== undefined
          ? accessKeyId
          : (data.access_key_id ?? creator?.current_access_key ?? null);
      const creatorName = creator
        ? `${creator.first_name} ${creator.last_name}`.trim() ||
          creator.user_name
        : `User #${creatorId}`;

      // 3. Resolve target user IDs (deduplicated)
      const targetUserIds = new Set<number>();
      const rolesToQuery = new Set<number>();

      for (const rec of matrixRule.recipients) {
        if (rec.user_id) {
          // Specific user explicitly designated in the matrix rule
          targetUserIds.add(Number(rec.user_id));
        } else if (rec.role_id) {
          // Dynamic role query: find all users holding this role
          rolesToQuery.add(Number(rec.role_id));
        }
      }

      if (rolesToQuery.size > 0) {
        const candidateRoleUserIds = new Set<number>();
        const roleIdsArray = Array.from(rolesToQuery);

        // A. Authoritative role assignments per user & access key in user_permissions
        const permQb = this.dataSource
          .getRepository(UserPermissions)
          .createQueryBuilder("up")
          .innerJoin("users", "u", "u.id = up.user_id AND u.status_id = 1")
          .select("DISTINCT up.user_id", "userId")
          .where("up.role_id IN (:...roleIds)", { roleIds: roleIdsArray })
          .andWhere("up.status_id = :statusId", { statusId: 1 });

        if (resolvedAccessKeyId) {
          permQb.andWhere("up.access_key_id = :accessKeyId", {
            accessKeyId: resolvedAccessKeyId,
          });
        }

        const permRows = await permQb.getRawMany();
        permRows.forEach((r) => candidateRoleUserIds.add(Number(r.userId)));

        // B. Union with users whose current active role in users table matches
        const usersInCurrentRole = await this.userRepository.find({
          where: {
            role_id: In(roleIdsArray),
            status_id: 1,
          },
          select: ["id"],
        });
        usersInCurrentRole.forEach((u) => candidateRoleUserIds.add(u.id));

        // C. Location Filtering (multi-user batch check)
        let targetLocIds: number[] = Array.isArray(locationIds)
          ? [...locationIds]
          : [];

        // If no explicit document locations provided, derive from creator's allowed locations
        if (targetLocIds.length === 0 && creator?.id && creator?.role_id) {
          targetLocIds =
            await this.commonUtilitiesService.getUserAllowedLocationIds(
              creator.id,
              creator.role_id,
              resolvedAccessKeyId ?? undefined,
            );
        }

        if (candidateRoleUserIds.size > 0) {
          if (targetLocIds.length > 0) {
            // Filter candidate role users to only those with access to matching locations (O(1) batch query)
            const matchedUserIds =
              await this.commonUtilitiesService.filterUsersByAllowedLocations(
                Array.from(candidateRoleUserIds),
                targetLocIds,
                undefined,
                resolvedAccessKeyId ?? undefined,
              );
            matchedUserIds.forEach((uid) => targetUserIds.add(uid));
          } else {
            // No location restriction applies -> notify all candidate users in the role
            candidateRoleUserIds.forEach((uid) => targetUserIds.add(uid));
          }
        }
      }

      if (targetUserIds.size === 0) {
        logger.warn(
          `[TriggerNotification] Matrix rule #${matrixRule.id} matched, but resolved 0 eligible recipient users (after role and location filtering).`,
        );
        return null;
      }

      // 4. Interpolate title, description and action URL (supports legacy payload, source, destination, and navigation)
      const payloadData =
        data?.payload && typeof data.payload === "object" ? data.payload : {};
      const sourceData =
        data?.source && typeof data.source === "object" ? data.source : {};
      const destinationData =
        data?.destination && typeof data.destination === "object"
          ? data.destination
          : {};

      const templateParams: Record<string, any> = {
        ...payloadData,
        ...sourceData,
        ...destinationData,
        ...data,
        ref_id: refId,
        creator_id: creatorId,
        creator_name: creatorName,
        user_name: creatorName,
        remarks:
          data?.remarks ?? sourceData?.remarks ?? payloadData?.remarks ?? "",
        reference_no:
          data?.reference_no ??
          sourceData?.reference_no ??
          destinationData?.reference_no ??
          payloadData?.reference_no ??
          "",
        ref_ids:
          data?.ref_ids ??
          (Array.isArray(destinationData?.ref_ids)
            ? destinationData.ref_ids.join(", ")
            : (destinationData?.ref_ids ?? "")),
      };

      // Dynamic matrix templates configured in admin take priority over hardcoded defaults
      const finalTitle = matrixRule.title_template?.trim()
        ? this.interpolateTemplate(matrixRule.title_template, templateParams)
        : customTitle || `${matrixRule.event_name} - #${refId}`;

      const finalDescription = matrixRule.description_template?.trim()
        ? this.interpolateTemplate(
            matrixRule.description_template,
            templateParams,
          )
        : customDescription ||
          `Action required on ${matrixRule.event_name} for ref #${refId}`;

      const finalActionUrl = matrixRule.action_url?.trim()
        ? this.interpolateTemplate(matrixRule.action_url, templateParams)
        : actionUrl || null;

      // 5. Execute DB write in a transaction (atomic master + recipients)
      let savedNotification: Notification;

      await this.dataSource.transaction(async (manager) => {
        const notificationEntity = manager.create(Notification, {
          module_id: matrixRule.module_id,
          access_key_id: resolvedAccessKeyId,
          event_code: eventCode,
          ref_id: refId,
          title: finalTitle,
          description: finalDescription,
          action_url: finalActionUrl,
          raw_data: data,
          created_by: creatorId,
          status_id: 1,
        });

        savedNotification = await manager.save(
          Notification,
          notificationEntity,
        );

        const recipientEntities = Array.from(targetUserIds).map((userId) =>
          manager.create(NotificationRecipient, {
            notification_id: savedNotification.id,
            user_id: userId,
            is_read: false,
          }),
        );

        await manager.save(NotificationRecipient, recipientEntities);
      });

      // 6. Redis Cache Invalidation & SSE Signal Broadcast (Non-blocking)
      const recipientIdsArray = Array.from(targetUserIds);
      this.invalidateUnreadCountCache(recipientIdsArray).catch((err) =>
        this.logger.error("Failed to invalidate unread count cache:", err),
      );

      // Broadcast targeted SSE signals: Front-end React Query hooks react to their own userId
      for (const recipientId of recipientIdsArray) {
        this.sseEmitterService.broadcastEvent({
          type: "CREATE",
          resource: "notifications",
          resourceId: recipientId,
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(
        `[TriggerNotification] Notification #${savedNotification.id} dispatched to ${recipientIdsArray.length} recipient(s) for event ${eventCode}`,
      );

      return savedNotification;
    } catch (error) {
      this.logger.error(
        `[TriggerNotification] Failed to trigger notification for event ${params.eventCode}:`,
        error,
      );
      return null;
    }
  }

  // =========================================================================
  // 2. RECIPIENT OPERATIONS (END-USER / PAYROLL TEAM)
  // =========================================================================

  /**
   * Get paginated notifications for the logged-in user
   */
  async getMyNotifications(
    userId: number,
    query: NotificationQueryDto,
    accessKeyId: number | null,
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;
    const accessKeyFilter = query.access_key_id ?? null;

    const qb = this.recipientRepository
      .createQueryBuilder("rec")
      .innerJoinAndSelect("rec.notification", "notif")
      .leftJoinAndSelect("notif.module", "module")
      .leftJoinAndSelect("notif.createdBy", "creator")
      .where("rec.user_id = :userId", { userId })
      .andWhere("rec.is_dismissed = :dismissed", { dismissed: false })
      .andWhere("notif.status_id = :statusId", { statusId: STATUS_IDS.ACTIVE });

    if (query.unread_only) {
      qb.andWhere("rec.is_read = :isRead", { isRead: false });
    }

    if (accessKeyFilter) {
      qb.andWhere(
        "(notif.access_key_id = :accessKeyId OR notif.access_key_id IS NULL)",
        { accessKeyId: accessKeyFilter },
      );
    }

    if (query.search) {
      qb.andWhere(
        "(notif.title LIKE :search OR notif.description LIKE :search)",
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy("rec.created_at", "DESC").skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();
    const unreadCount = await this.getUnreadCount(userId, accessKeyFilter);

    return {
      items: items.map((item) => ({
        id: item.id,
        notification_id: item.notification_id,
        title: item.notification?.title,
        description: item.notification?.description,
        event_code: item.notification?.event_code,
        ref_id: item.notification?.ref_id,
        access_key_id: item.notification?.access_key_id,
        action_url: item.notification?.action_url,
        raw_data: item.notification?.raw_data,
        module: item.notification?.module
          ? {
              id: item.notification.module.id,
              name: item.notification.module.module_name,
              alias: item.notification.module.module_alias,
            }
          : null,
        created_by: item.notification?.createdBy
          ? {
              id: item.notification.createdBy.id,
              user_name: item.notification.createdBy.user_name,
              full_name:
                `${item.notification.createdBy.first_name} ${item.notification.createdBy.last_name}`.trim(),
            }
          : null,
        is_read: item.is_read,
        read_at: item.read_at,
        created_at: item.created_at,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        unread_count: unreadCount,
        access_key_id: accessKeyFilter,
      },
    };
  }

  /**
   * Get unread notification count with Redis caching for instant badge render
   */
  async getUnreadCount(
    userId: number,
    accessKeyId: number | null,
  ): Promise<number> {
    const cacheKey = `notifications:unread:${userId}`;
    const redis = getRedisClient();

    if (redis && redis.isOpen) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached !== null) {
          return parseInt(cached, 10);
        }
      } catch (err) {
        this.logger.warn(`Redis get failed for ${cacheKey}: ${err}`);
      }
    }

    // Query from DB using index-optimized count
    const count = await this.recipientRepository.count({
      where: {
        user_id: userId,
        is_read: false,
        is_dismissed: false,
        notification: {
          access_key_id: accessKeyId ?? 0,
          status_id: STATUS_IDS.ACTIVE,
        },
      },
      relations: ["notification"],
    });

    if (redis && redis.isOpen) {
      try {
        await redis.set(cacheKey, count.toString(), { EX: 300 }); // 5 min TTL
      } catch (err) {
        this.logger.warn(`Redis set failed for ${cacheKey}: ${err}`);
      }
    }

    return count;
  }

  /**
   * Mark a single notification as read for the current user
   */
  async markAsRead(notificationId: number, userId: number) {
    const recipient = await this.recipientRepository.findOne({
      where: { notification_id: notificationId, user_id: userId },
    });

    if (!recipient) {
      throw new NotFoundException(
        `Notification #${notificationId} not found for this user`,
      );
    }

    if (!recipient.is_read) {
      recipient.is_read = true;
      recipient.read_at = new Date();
      await this.recipientRepository.save(recipient);

      // Invalidate cache and emit SSE update
      await this.invalidateUnreadCountCache([userId]);
      this.sseEmitterService.broadcastEvent({
        type: "UPDATE",
        resource: "notifications",
        resourceId: userId,
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, message: "Notification marked as read" };
  }

  /**
   * Mark all notifications as read for current user
   */
  async markAllAsRead(userId: number) {
    await this.recipientRepository
      .createQueryBuilder()
      .update(NotificationRecipient)
      .set({ is_read: true, read_at: new Date() })
      .where("user_id = :userId", { userId })
      .andWhere("is_read = :isRead", { isRead: false })
      .execute();

    // Cache reset to 0
    const redis = getRedisClient();
    if (redis && redis.isOpen) {
      try {
        await redis.set(`notifications:unread:${userId}`, "0", { EX: 300 });
      } catch (err) {
        this.logger.warn(`Redis set 0 failed: ${err}`);
      }
    }

    this.sseEmitterService.broadcastEvent({
      type: "UPDATE",
      resource: "notifications",
      resourceId: userId,
      timestamp: new Date().toISOString(),
    });

    return { success: true, message: "All notifications marked as read" };
  }

  // =========================================================================
  // 3. SYSTEM ADMIN AUDIT TRAIL (OVERALL VIEW)
  // =========================================================================

  /**
   * Overall view for System Admin to see all notifications across modules
   * and monitor which recipients have read them with read timestamps.
   */
  async getAdminAuditTrail(query: AdminNotificationAuditDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const qb = this.notificationRepository
      .createQueryBuilder("notif")
      .leftJoinAndSelect("notif.module", "module")
      .leftJoinAndSelect("notif.createdBy", "creator")
      .leftJoinAndSelect("notif.recipients", "recipients")
      .leftJoinAndSelect("recipients.user", "user")
      .leftJoinAndSelect("user.role", "role");

    if (query.module_id) {
      qb.andWhere("notif.module_id = :moduleId", { moduleId: query.module_id });
    }

    if (query.access_key_id) {
      qb.andWhere("notif.access_key_id = :accessKeyId", {
        accessKeyId: query.access_key_id,
      });
    }

    if (query.event_code) {
      qb.andWhere("notif.event_code = :eventCode", {
        eventCode: query.event_code,
      });
    }

    if (query.date_from) {
      qb.andWhere("notif.created_at >= :dateFrom", {
        dateFrom: new Date(query.date_from),
      });
    }

    if (query.date_to) {
      qb.andWhere("notif.created_at <= :dateTo", {
        dateTo: new Date(query.date_to),
      });
    }

    qb.orderBy("notif.created_at", "DESC").skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    // Map audit view with read/unread metrics per event
    const auditData = items.map((notif) => {
      const recipients = notif.recipients || [];
      const totalRecipients = recipients.length;
      const readCount = recipients.filter((r) => r.is_read).length;
      const unreadCount = totalRecipients - readCount;

      let statusSummary = "PENDING";
      if (totalRecipients > 0 && readCount === totalRecipients) {
        statusSummary = "ALL_READ";
      } else if (readCount > 0) {
        statusSummary = "PARTIALLY_READ";
      }

      return {
        id: notif.id,
        module: notif.module
          ? {
              id: notif.module.id,
              name: notif.module.module_name,
              alias: notif.module.module_alias,
            }
          : null,
        event_code: notif.event_code,
        title: notif.title,
        description: notif.description,
        ref_id: notif.ref_id,
        access_key_id: notif.access_key_id,
        action_url: notif.action_url,
        raw_data: notif.raw_data,
        created_at: notif.created_at,
        created_by: notif.createdBy
          ? {
              id: notif.createdBy.id,
              user_name: notif.createdBy.user_name,
              full_name:
                `${notif.createdBy.first_name} ${notif.createdBy.last_name}`.trim(),
            }
          : null,
        metrics: {
          total_recipients: totalRecipients,
          read_count: readCount,
          unread_count: unreadCount,
          status_summary: statusSummary,
        },
        recipients: recipients.map((r) => ({
          id: r.id,
          user_id: r.user_id,
          user_name: r.user?.user_name,
          full_name: r.user
            ? `${r.user.first_name} ${r.user.last_name}`.trim()
            : `User #${r.user_id}`,
          role_name: r.user?.role?.role_name || "Unknown",
          is_read: r.is_read,
          read_at: r.read_at,
          created_at: r.created_at,
        })),
      };
    });

    // Optional post-filter for read_status
    let filteredAuditData = auditData;
    if (query.read_status && query.read_status !== "all") {
      if (query.read_status === "read") {
        filteredAuditData = auditData.filter(
          (a) => a.metrics.status_summary === "ALL_READ",
        );
      } else if (query.read_status === "unread") {
        filteredAuditData = auditData.filter(
          (a) => a.metrics.status_summary === "PENDING",
        );
      } else if (query.read_status === "partial") {
        filteredAuditData = auditData.filter(
          (a) => a.metrics.status_summary === "PARTIALLY_READ",
        );
      }
    }

    return {
      items: filteredAuditData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // =========================================================================
  // 4. MATRIX CONFIGURATION CRUD (ADMIN SETTINGS)
  // =========================================================================

  getEventCatalog() {
    return Object.values(NOTIFICATION_EVENT_CATALOG);
  }

  async findAllMatrix() {
    return this.matrixRepository.find({
      relations: [
        "module",
        "status",
        "recipients",
        "recipients.role",
        "recipients.user",
      ],
      order: { id: "DESC" },
    });
  }

  async findOneMatrix(id: number, manager?: EntityManager) {
    const repo = manager
      ? manager.getRepository(NotificationMatrix)
      : this.matrixRepository;

    const matrix = await repo.findOne({
      where: { id },
      relations: [
        "module",
        "status",
        "recipients",
        "recipients.role",
        "recipients.user",
      ],
    });

    if (!matrix) {
      throw new NotFoundException(`Notification matrix rule #${id} not found`);
    }

    return matrix;
  }

  async createMatrix(dto: CreateNotificationMatrixDto, userId: number) {
    // Validate module exists
    const module = await this.moduleRepository.findOne({
      where: { id: dto.module_id },
    });
    if (!module) {
      throw new BadRequestException(`Module #${dto.module_id} not found`);
    }

    const savedMatrixId = await this.dataSource.transaction(async (manager) => {
      const matrix = manager.create(NotificationMatrix, {
        module_id: dto.module_id,
        event_code: dto.event_code.trim().toUpperCase(),
        event_name: dto.event_name.trim(),
        title_template: dto.title_template,
        description_template: dto.description_template,
        action_url: dto.action_url,
        status_id: dto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedMatrix = await manager.save(NotificationMatrix, matrix);

      if (dto.recipients && dto.recipients.length > 0) {
        const recipients = dto.recipients.map((r) =>
          manager.create(NotificationMatrixRecipient, {
            matrix_id: savedMatrix.id,
            role_id: r.role_id,
            user_id: r.user_id || null,
            status_id: r.status_id || 1,
            created_by: userId,
            updated_by: userId,
          }),
        );
        await manager.save(NotificationMatrixRecipient, recipients);
      }

      return savedMatrix.id;
    });

    return this.findOneMatrix(savedMatrixId);
  }

  async updateMatrix(
    id: number,
    dto: UpdateNotificationMatrixDto,
    userId: number,
  ) {
    const existing = await this.findOneMatrix(id);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(NotificationMatrix, id, {
        module_id: dto.module_id ?? existing.module_id,
        event_code: dto.event_code
          ? dto.event_code.trim().toUpperCase()
          : existing.event_code,
        event_name: dto.event_name
          ? dto.event_name.trim()
          : existing.event_name,
        title_template: dto.title_template ?? existing.title_template,
        description_template:
          dto.description_template ?? existing.description_template,
        action_url: dto.action_url ?? existing.action_url,
        status_id: dto.status_id ?? existing.status_id,
        updated_by: userId,
      });

      if (dto.recipients !== undefined) {
        // Replace existing recipients with new set
        await manager.delete(NotificationMatrixRecipient, { matrix_id: id });

        if (dto.recipients.length > 0) {
          const newRecipients = dto.recipients.map((r) =>
            manager.create(NotificationMatrixRecipient, {
              matrix_id: id,
              role_id: r.role_id,
              user_id: r.user_id || null,
              status_id: r.status_id || 1,
              created_by: userId,
              updated_by: userId,
            }),
          );
          await manager.save(NotificationMatrixRecipient, newRecipients);
        }
      }
    });

    return this.findOneMatrix(id);
  }

  async removeMatrix(id: number) {
    const matrix = await this.findOneMatrix(id);
    await this.matrixRepository.delete(matrix.id);
    return { success: true, message: `Notification matrix #${id} deleted` };
  }

  // =========================================================================
  // 5. LEGACY METHODS (PRESERVED FOR BACKWARD COMPATIBILITY)
  // =========================================================================

  async create(
    createNotificationDto: CreateNotificationDto,
    created_by: number,
  ) {
    const notifications = createNotificationDto.to_user_ids.map((to_user_id) =>
      this.notificationRepository.create({
        ...createNotificationDto,
        to_user_id,
        created_by,
        status_id: 1,
      }),
    );
    return this.notificationRepository.save(notifications);
  }

  async findAll() {
    return this.notificationRepository.find();
  }

  async findOne(id: number) {
    return this.notificationRepository.findOneBy({ id });
  }

  async update(
    id: number,
    updateNotificationDto: UpdateNotificationDto,
    updated_by: number,
  ) {
    await this.notificationRepository.update(id, {
      ...updateNotificationDto,
      updated_by,
    });
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.notificationRepository.delete(id);
    return { success: true };
  }

  async notify(params: {
    module_id: number;
    ref_id: number;
    description: string;
    raw_data?: any;
    to_user_ids: number[];
    created_by: number;
  }) {
    const notifications = params.to_user_ids.map((to_user_id) =>
      this.notificationRepository.create({
        module_id: params.module_id,
        ref_id: params.ref_id,
        description: params.description,
        raw_data: params.raw_data,
        to_user_id,
        created_by: params.created_by,
        status_id: 1,
      }),
    );
    return this.notificationRepository.save(notifications);
  }

  // =========================================================================
  // 6. PRIVATE UTILITY HELPERS
  // =========================================================================

  private interpolateTemplate(
    template: string,
    params: Record<string, any>,
  ): string {
    if (!template) return "";

    const resolveValue = (key: string): any => {
      if (params[key] !== undefined && params[key] !== null) {
        return params[key];
      }
      if (key.includes(".")) {
        return key
          .split(".")
          .reduce(
            (acc, part) =>
              acc && acc[part] !== undefined ? acc[part] : undefined,
            params,
          );
      }
      return undefined;
    };

    const formatValue = (val: any): string => {
      if (Array.isArray(val)) {
        return val.join(", ");
      }
      if (typeof val === "object" && val !== null) {
        return JSON.stringify(val);
      }
      return String(val);
    };

    // Supports {var} and (var), with nested dot notation like {source.reference_no}
    return template
      .replace(/\{([\w.-]+)\}/g, (match, key) => {
        const val = resolveValue(key);
        return val !== undefined && val !== null ? formatValue(val) : match;
      })
      .replace(/\(([\w.-]+)\)/g, (match, key) => {
        const val = resolveValue(key);
        return val !== undefined && val !== null ? formatValue(val) : match;
      });
  }

  private async invalidateUnreadCountCache(userIds: number[]): Promise<void> {
    const redis = getRedisClient();
    if (!redis || !redis.isOpen) return;

    try {
      const keys = userIds.map((id) => `notifications:unread:${id}`);
      if (keys.length > 0) {
        await redis.del(keys);
      }
    } catch (err) {
      this.logger.warn(`Failed to del Redis keys: ${err}`);
    }
  }
}
