import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, EntityManager } from "typeorm";
import { EmailQueue } from "../../../entities/EmailQueue";
import { CreateEmailQueueDto } from "../dto/create-email-queue.dto";
import { EmailNotificationSenderService } from "../../email-notification-matrix/services/email-notification-sender.service";
import { SSEEventEmitterHelper } from "src/modules/sse/services/sse-event-emitter.helper";
@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);

  constructor(
    @InjectRepository(EmailQueue)
    private readonly emailQueueRepository: Repository<EmailQueue>,

    private readonly emailNotificationSenderService: EmailNotificationSenderService,

    private readonly sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  /**
   * Enqueues a new email notification entry.
   * Can accept an optional EntityManager to participate in an active database transaction.
   */
  async enqueue(
    dto: CreateEmailQueueDto,
    entityManager?: EntityManager,
  ): Promise<EmailQueue> {
    const repository = entityManager
      ? entityManager.getRepository(EmailQueue)
      : this.emailQueueRepository;
    this.logger.warn(
      `[EMAIL QUEUE] enqueue() called
  document=${dto.document_number}
  trigger=${dto.trigger_status_id}
  module=${dto.module_id}
  ${new Error().stack}`,
    );

    const existing = await repository.findOne({
      where: {
        document_number: dto.document_number,
        trigger_status_id: dto.trigger_status_id,
        module_id: dto.module_id,
        status_id: 1,
      },
    });

    if (existing) {
      this.logger.warn(
        `Duplicate queue prevented: ${dto.document_number} trigger=${dto.trigger_status_id}`,
      );
      return existing;
    }
    const queueItem = repository.create({
      document_number: dto.document_number,
      transaction_id: dto.transaction_id,
      module_id: dto.module_id,
      trigger_status_id: dto.trigger_status_id,
      priority: dto.priority ?? 3,
      email_subject: dto.email_subject,
      status_id: 1, // 1 = Pending
      retry_count: 0,
      max_retry: 5,
      queued_date: new Date(),
      created_by: dto.created_by,
    });

    const saved = await repository.save(queueItem);
    try {
      this.sseEventEmitter.emitCreateSignal("email-queue", saved.id);
    } catch (err) {
      this.logger.error("SSE event failed:", err);
    }

    this.logger.log(
      `Enqueued email task #${saved.id} for Document: ${saved.document_number}`,
    );

    return saved;
  }

  /**
   * Processes a queued item by processing the template and sending the email.
   */
  async processQueueItem(queueId: number): Promise<void> {
    const queueItem = await this.emailQueueRepository.findOne({
      where: { id: queueId },
    });

    if (!queueItem || queueItem.status_id !== 1) {
      return;
    }

    // Handle Pending Approval separately
    if (
      Number(queueItem.module_id) === 34 &&
      Number(queueItem.trigger_status_id) === 3
    ) {
      return;
    }

    // Mark as Processing
    const result = await this.emailQueueRepository.update(
      {
        id: queueId,
        status_id: 1, // only update if still Pending
      },
      {
        status_id: 28,
        processing_date: new Date(),
        worker_name: "EMAIL_QUEUE_WORKER",
      },
    );

    if (result.affected !== 1) {
      this.logger.warn(`[QUEUE] queue ${queueId} is already being processed.`);
      return;
    }

    try {
      // Delegate recipient lookup, template building, and sending to Sender Service
      this.logger.warn(`[QUEUE] Calling processTrigger() queueId=${queueId}`);
      await this.emailNotificationSenderService.processTrigger({
        moduleId: queueItem.module_id,
        triggerStatusId: queueItem.trigger_status_id,
        transactionId: queueItem.transaction_id,
      });

      // Mark as Completed / Sent (Status ID 2)
      await this.emailQueueRepository.update(queueId, {
        status_id: 29,
        finished_date: new Date(),
        worker_name: null,
        manual_execute: 0,
        error_message: null,
      });

      try {
        this.sseEventEmitter.emitUpdateSignal("email-queue", queueId);
      } catch (err) {
        this.logger.error("SSE event failed:", err);
      }

      this.logger.log(`Successfully processed Email Queue #${queueId}`);
    } catch (error: any) {
      this.logger.error(`Failed to process Email Queue #${queueId}`, error);

      const newRetryCount = queueItem.retry_count + 1;
      const isFailedMax = newRetryCount >= queueItem.max_retry;

      // Calculate exponential backoff (e.g., 5m, 10m, 20m, 40m)
      const nextRetryMinutes = Math.pow(2, newRetryCount) * 5;
      const nextRetryDate = new Date();
      nextRetryDate.setMinutes(nextRetryDate.getMinutes() + nextRetryMinutes);

      await this.emailQueueRepository.update(queueId, {
        retry_count: newRetryCount,
        error_message: error?.message || String(error),
        next_retry_date: isFailedMax ? null : nextRetryDate,
        status_id: isFailedMax ? 30 : 1,
        worker_name: null,
        manual_execute: 0,
        finished_date: isFailedMax ? new Date() : null,
      });

      try {
        this.sseEventEmitter.emitUpdateSignal("email-queue", queueId);
      } catch (err) {
        this.logger.error("SSE event failed:", err);
      }
    }
  }

  private async sendGroupedApprovalEmail(group: {
    recipient: { to: string };
    queues: EmailQueue[];
  }): Promise<void> {
    this.logger.warn("========== GROUPED EMAIL ==========");
    this.logger.warn(`Recipient: ${group.recipient.to}`);
    this.logger.warn(`Documents: ${group.queues.length}`);

    for (const q of group.queues) {
      this.logger.warn(` - ${q.document_number}`);
    }

    const documents: any[] = [];

    for (const queue of group.queues) {
      const document =
        await this.emailNotificationSenderService.getApprovalSummaryDocument(
          queue.transaction_id,
          queue.trigger_status_id,
        );
      this.logger.warn(
        `After getApprovalSummaryDocument ${queue.document_number}`,
      );
      documents.push(document);
    }

    this.logger.warn("Before sendApprovalSummaryEmail");

    const triggerStatusId = group.queues[0].trigger_status_id;

    let isFinalApproved = false;

    if (triggerStatusId === 7) {
      const remainingPending =
        await this.emailNotificationSenderService.countPendingApprovalStages(
          group.queues[0].transaction_id,
        );

      isFinalApproved = remainingPending === 0;
    }

    await this.emailNotificationSenderService.sendApprovalSummaryEmail({
      to: group.recipient.to,
      documents,
      triggerStatusId: group.queues[0].trigger_status_id,
      isFinalApproved,
    });

    this.logger.warn("After sendApprovalSummaryEmail");

    await this.emailQueueRepository.update(
      group.queues.map((q) => q.id),
      {
        status_id: 29,
        processing_date: new Date(),
        finished_date: new Date(),
        worker_name: null,
        manual_execute: 0,
        error_message: null,
      },
    );
    this.logger.warn(
      `[GROUPED EMAIL] Completed ${group.queues.length} queue(s)`,
    );
  }

  private async groupQueuesByTrigger(triggerStatusId: number) {
    const queues = await this.emailQueueRepository.find({
      where: {
        status_id: 1,
        trigger_status_id: triggerStatusId,
        module_id: 34,
      },
      order: {
        queued_date: "ASC",
      },
    });

    const grouped = new Map<
      string,
      {
        recipient: any;
        queues: EmailQueue[];
      }
    >();

    for (const queue of queues) {
      const recipient =
        await this.emailNotificationSenderService.getGroupedApprovalRecipient(
          queue.transaction_id,
          queue.trigger_status_id,
        );

      console.log("QUEUE", queue.document_number);
      console.log("EMAIL:", JSON.stringify(recipient?.to));

      if (!recipient) {
        continue;
      }
      const key = recipient.to.trim().toLowerCase();

      if (!grouped.has(key)) {
        grouped.set(key, {
          recipient,
          queues: [],
        });
      }

      grouped.get(key)!.queues.push(queue);
    }

    this.logger.log(`Grouped Pending Approval Recipients: ${grouped.size}`);

    for (const [email, data] of grouped.entries()) {
      console.log(`${email} -> ${data.queues.length} pending document(s)`);
    }
    return grouped;
  }
  /**
   * Triggers a manual retry for a failed or stalled email task.
   */
  async triggerManualExecute(id: number): Promise<void> {
    const queueItem = await this.emailQueueRepository.findOne({
      where: { id },
    });

    if (!queueItem) {
      throw new NotFoundException(`Email queue item #${id} not found.`);
    }

    await this.emailQueueRepository.update(id, {
      manual_execute: 1,
      status_id: 1,
      retry_count: 0,
      next_retry_date: new Date(),
      processing_date: null,
      worker_name: null,
      error_message: null,
      finished_date: null,
    });

    try {
      this.sseEventEmitter.emitUpdateSignal("email-queue", id);
    } catch (err) {
      this.logger.error("SSE event failed:", err);
    }
    // Run processing immediately in background
    setImmediate(() => this.processQueueItem(id));
  }

  /**
   * Fetches queued items for monitoring/admin console views.
   */
  async findAll(statusId?: number) {
    const query = this.emailQueueRepository
      .createQueryBuilder("eq")
      .leftJoinAndSelect("eq.creator", "creator")
      .leftJoinAndSelect("eq.module", "module")
      .leftJoinAndSelect("eq.status", "status")
      .leftJoinAndSelect("eq.triggerStatus", "triggerStatus");

    if (statusId !== undefined) {
      query.where("eq.status_id = :statusId", { statusId });
    }
    const items = await query.orderBy("eq.queued_date", "DESC").getMany();

    return items.map((item) => ({
      id: item.id,
      document_number: item.document_number,
      transaction_id: item.transaction_id,
      module_id: item.module_id,
      status_name: item.status?.status_name ?? null,
      module_name: item.module?.module_name ?? null,
      recipient_emails: [item.recipient_to, item.recipient_cc]
        .filter(Boolean)
        .join(", "),
      trigger_status_id: item.trigger_status_id,
      trigger_status_name: item.triggerStatus?.status_name ?? null,
      status_id: item.status_id,
      priority: item.priority,
      attempts: `${item.retry_count}/${item.max_retry}`,
      next_retry_date: item.next_retry_date,
      processing_date: item.processing_date,
      finished_date: item.finished_date,
      worker_name: item.worker_name,
      manual_execute: item.manual_execute,
      error_message: item.error_message,
      created_email: item.creator?.email ?? null,
      queued_date: item.queued_date,
      updated_at: item.updated_at,
      created_by: item.created_by,
      email_subject: item.email_subject,
      created_user: item.creator
        ? `${item.creator.first_name} ${item.creator.last_name}`
        : null,
    }));
  }

  async processPendingQueue(): Promise<void> {
    this.logger.warn("========== NEW PROCESS PENDING QUEUE ==========");

    const now = new Date();

    const queueItems = await this.emailQueueRepository
      .createQueryBuilder("eq")
      .where("eq.status_id = :statusId", { statusId: 1 })
      .andWhere("eq.processing_date IS NULL")
      .andWhere("(eq.next_retry_date IS NULL OR eq.next_retry_date <= :now)", {
        now,
      })
      .orderBy("eq.priority", "ASC")
      .addOrderBy("eq.queued_date", "ASC")
      .getMany();

    // Process grouped Pending Approval first
    const groupedTriggers = [3, 4, 7, 15];

    for (const trigger of groupedTriggers) {
      const grouped = await this.groupQueuesByTrigger(trigger);

      for (const [, group] of grouped.entries()) {
        if (group.queues.length === 1) {
          const queue = group.queues[0];

          await this.emailNotificationSenderService.processTrigger({
            moduleId: queue.module_id,
            triggerStatusId: queue.trigger_status_id,
            transactionId: queue.transaction_id,
          });

          await this.emailQueueRepository.update(queue.id, {
            status_id: 29,
            processing_date: new Date(),
            finished_date: new Date(),
            worker_name: null,
            manual_execute: 0,
            error_message: null,
          });

          continue;
        }

        await this.sendGroupedApprovalEmail(group);
      }
    }

    // Process all other queue items normally
    for (const item of queueItems) {
      this.logger.warn(
        `CHECK: ${Number(item.module_id)} / ${Number(item.trigger_status_id)}`,
      );

      if (
        Number(item.module_id) === 34 &&
        [3, 4, 7, 15].includes(Number(item.trigger_status_id))
      ) {
        this.logger.warn(`SKIPPING GROUPED QUEUE ${item.id}`);
        continue;
      }

      this.logger.warn(`PROCESSING QUEUE ${item.id}`);

      await this.processQueueItem(item.id);
    }
  }
}
