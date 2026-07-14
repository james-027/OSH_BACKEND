import { Cron, CronExpression } from "@nestjs/schedule";
import logger from "src/config/logger";

export function ConditionalCron(
  cronTime: string | CronExpression,
  envVar: string,
  defaultValue: boolean = false,
) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    // Check if env var exists, if not use defaultValue
    const envValue = process.env[envVar];
    const isEnabled =
      envValue !== undefined ? envValue === "true" : defaultValue;

    if (isEnabled) {
      return Cron(cronTime)(target, propertyKey, descriptor);
    } else {
      logger.info(
        `Cron ${propertyKey} is disabled (${envVar}=${envValue || "not set"})`,
      );
      return descriptor;
    }
  };
}
