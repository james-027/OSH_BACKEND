import { Injectable } from "@nestjs/common";

import { SupplierSyncService } from "src/modules/suppliers/services/supplier-sync.service";
import { ProfitcenterSyncService } from "src/modules/profitcenters/services/profitcenter-sync.service";
import { GLAccountSyncService } from "src/modules/gl-accounts/services/glaccount-sync.service";
import { DebitAdviceCategorySyncService } from "src/modules/debit-advice-category/services/debit-advice-category-sync";
import { DebitAdviceGlAccountSyncService } from "src/modules/debit-advice-glaccount/services/debit-advice-glaccount-sync.service";

import logger from "src/config/logger";
import {
  MasterDataSyncLog,
  MasterDataSyncType,
} from "src/entities/MasterDataSyncLog";
import { MasterDataSyncLogService } from "./master-data-sync-log.service";

@Injectable()
export class MasterDataSyncService {
  constructor(
    private readonly supplierSyncService: SupplierSyncService,
    private readonly profitcenterSyncService: ProfitcenterSyncService,
    private readonly glAccountSyncService: GLAccountSyncService,
    private readonly debitAdviceCategorySyncService: DebitAdviceCategorySyncService,
    private readonly debitAdviceGlAccountSyncService: DebitAdviceGlAccountSyncService,
    private readonly masterDataSyncLogService: MasterDataSyncLogService,
  ) {}

  async sync(type: MasterDataSyncType, executedBy?: number) {
    const batchSize = 1000;

    logger.info(`[MANUAL SYNC] Started master data sync: ${type}`);

    // ============================================================
    // CREATE LOG IMMEDIATELY
    // ============================================================

    const syncLog = await this.masterDataSyncLogService.createProcessingLog(
      type,
      executedBy,
    );

    try {
      let result;

      switch (type) {
        case "suppliers":
          logger.info("[MANUAL SYNC] Executing Supplier sync...");

          result = await this.supplierSyncService.syncSuppliers(batchSize);

          break;

        case "profitcenter":
          logger.info("[MANUAL SYNC] Executing Profit Center sync...");

          result =
            await this.profitcenterSyncService.syncProfitcenters(batchSize);

          break;

        case "gl-account":
          logger.info("[MANUAL SYNC] Executing GL Account sync...");

          result = await this.glAccountSyncService.syncGLAccounts(batchSize);

          break;

        case "debit-advice-category":
          logger.info("[MANUAL SYNC] Executing Debit Advice Category sync...");

          result =
            await this.debitAdviceCategorySyncService.syncDebitAdviceCategories(
              batchSize,
            );

          break;

        case "debit-advice-gl-account":
          logger.info(
            "[MANUAL SYNC] Executing Debit Advice GL Account sync...",
          );

          result =
            await this.debitAdviceGlAccountSyncService.syncDebitAdviceGL(
              batchSize,
            );

          break;

        default:
          throw new Error(`Unsupported master data sync type: ${type}`);
      }

      // ============================================================
      // MARK LOG AS COMPLETED
      // ============================================================

      await this.masterDataSyncLogService.markCompleted(syncLog, result);

      logger.info(
        `[MANUAL SYNC] Completed ${type}: ` +
          `${result.inserted} inserted, ` +
          `${result.updated} updated, ` +
          `${result.skipped} skipped, ` +
          `${result.errors} errors.`,
      );

      return {
        success: true,
        type,
        log_id: syncLog.id,
        ...result,
      };
    } catch (error) {
      // ============================================================
      // MARK LOG AS FAILED
      // ============================================================

      await this.masterDataSyncLogService.markFailed(syncLog, error);

      logger.error(
        `[MANUAL SYNC] Failed ${type}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      throw error;
    }
  }

  async getLogs(
    page: number,
    pageSize: number,
    dateFrom?: string,
    dateTo?: string,
  ) {
    return this.masterDataSyncLogService.findLogs(
      page,
      pageSize,
      dateFrom,
      dateTo,
    );
  }
}
