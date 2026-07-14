import { Injectable } from "@nestjs/common";
import { CronExpression } from "@nestjs/schedule";
import logger from "../config/logger";
import { OSHJVService } from "src/modules/debit-advice/services/jv-creation.service";
import { ConditionalCron } from "src/decorators/conditional-cron.decorator";

@Injectable()
export class OSHJVPostingScheduler {
  constructor(private readonly documentPostingLogService: OSHJVService) {}

  //   @Cron(CronExpression.EVERY_MINUTE)
  @ConditionalCron(CronExpression.EVERY_MINUTE, "ENABLE_OSHJV_CRON")
  async handleOSHJVPosting() {
    try {
      const logs = await this.documentPostingLogService.SyncingPosting();

      const failedLogs = logs.filter((log) => log.status === "PENDING");

      if (!failedLogs.length) {
        logger.info("No pending OSHJV posting logs found.");
        return;
      } else {
        logger.info(
          `Starting OSHJV posting process. Found ${failedLogs.length} pending logs.`,
        );

        for (const log of failedLogs) {
          try {
            const payload =
              typeof log.payload === "string"
                ? JSON.parse(log.payload)
                : log.payload;

            await this.documentPostingLogService.postToOSHJV(payload, 1);

            logger.info(`Successfully reposted Ref Doc No: ${log.ref_docno}`);
          } catch (error: any) {
            logger.error(
              `Failed reposting Ref Doc No: ${log.ref_docno}`,
              error?.stack,
            );
          }
        }

        logger.info("OSHJV posting process completed.");
      }
    } catch (error: any) {
      logger.error(
        `OSHJV posting scheduler failed: ${error.message}`,
        error.stack,
      );
    }
  }
}
