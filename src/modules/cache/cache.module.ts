import { Module } from "@nestjs/common";
import { CacheInvalidationService } from "./services/cache-invalidation.service";
import { CacheDiagnosticService } from "src/modules/cache/services/cache-diagnostic.service";
import { CacheDebugController } from "src/modules/cache/controllers/cache-debug.controller";

/**
 * Shared Cache Module
 * Provides:
 * - CacheInvalidationService: Handles cache invalidation for features
 * - CacheDiagnosticService: Diagnoses cache and Redis issues
 * - CacheDebugController: Debug endpoints for testing cache
 *
 * This module ensures cache services are available across the application
 */
@Module({
  controllers: [CacheDebugController],
  providers: [CacheInvalidationService, CacheDiagnosticService],
  exports: [CacheInvalidationService, CacheDiagnosticService],
})
export class CacheInvalidationModule {}
