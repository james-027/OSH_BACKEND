import {
  Controller,
  Get,
  Param,
  Sse,
  MessageEvent,
  UseGuards,
  Request,
  ParseIntPipe,
  Post,
  Body,
  Res,
} from "@nestjs/common";
import { Observable, interval } from "rxjs";
import { map } from "rxjs/operators";
import { SSEEmitterService, SSEEvent } from "../services/sse-emitter.service";
import { JwtAuthGuard } from "src/guards/jwt-auth.guard";
import logger from "src/config/logger";

@Controller("sse")
@UseGuards(JwtAuthGuard)
export class SSEController {
  constructor(private sseEmitterService: SSEEmitterService) {}

  /**
   * SSE endpoint for real-time broadcast events
   * All users connect to the same broadcast stream
   * React Query on client matches resource types to query keys
   *
   * Frontend connects: EventSource('/sse/broadcast')
   * Auth is still required - only authenticated users get the stream
   *
   * Detects client disconnect and cleans up subscriptions to prevent memory leaks
   * Works with both Express and Fastify adapters
   *
   * @param req - Request object with authenticated user
   * @param res - Response object to listen for client disconnect
   * @returns Observable stream of server-sent events (broadcast to all)
   */
  @Sse("broadcast")
  subscribeToEvents(@Request() req, @Res() res): Observable<any> {
    // Verify user is authenticated (JwtAuthGuard ensures this)
    const authenticatedUserId = req.user?.id;
    if (!authenticatedUserId) {
      throw new Error("Unauthorized: Must be authenticated to receive events");
    }

    logger.info(
      `[SSE] User ${authenticatedUserId} connecting to broadcast stream`,
    );

    // Get the raw response object (works with both Express and Fastify)
    const rawRes = res.raw || res;

    // Listen for client disconnect to clean up subscriptions
    rawRes.on("close", () => {
      logger.info(
        `[SSE] Client connection closed for user ${authenticatedUserId}`,
      );
      this.sseEmitterService.cleanupUserConnection(
        authenticatedUserId,
        "client_disconnect",
      );
    });

    rawRes.on("error", (err) => {
      logger.error(
        `[SSE] Connection error for user ${authenticatedUserId}: ${err.message}`,
      );
      this.sseEmitterService.cleanupUserConnection(
        authenticatedUserId,
        "connection_error",
      );
    });

    return this.sseEmitterService.subscribeToEvents(authenticatedUserId).pipe(
      map((event: SSEEvent) => {
        logger.debug(
          `[SSE Controller] Broadcasting to user ${authenticatedUserId}: ${event.resource}:${event.resourceId || "N/A"}`,
        );
        return {
          data: event,
          id: `${event.timestamp}-${Math.random()}`,
        };
      }),
    );
  }

  /**
   * Legacy endpoint for backward compatibility
   * Redirects to broadcast stream regardless of user_id
   * (In pure broadcast, user_id doesn't matter - all users get same events)
   * Also cleans up subscriptions on disconnect
   * Works with both Express and Fastify adapters
   */
  @Sse("users/:user_id")
  subscribeToUserEvents(
    @Param("user_id", ParseIntPipe) user_id: number,
    @Request() req,
    @Res() res,
  ): Observable<any> {
    // Verify user is authenticated
    const authenticatedUserId = req.user?.id;
    if (!authenticatedUserId) {
      throw new Error("Unauthorized: Must be authenticated to receive events");
    }

    // Get the raw response object (works with both Express and Fastify)
    const rawRes = res.raw || res;

    // Listen for client disconnect to clean up subscriptions
    rawRes.on("close", () => {
      logger.info(
        `[SSE] Client connection closed for user ${authenticatedUserId} (legacy endpoint)`,
      );
      this.sseEmitterService.cleanupUserConnection(
        authenticatedUserId,
        "client_disconnect_legacy",
      );
    });

    rawRes.on("error", (err) => {
      logger.error(
        `[SSE] Connection error for user ${authenticatedUserId} (legacy endpoint): ${err.message}`,
      );
      this.sseEmitterService.cleanupUserConnection(
        authenticatedUserId,
        "connection_error_legacy",
      );
    });

    // Return broadcast stream (same for all users)
    return this.sseEmitterService.subscribeToEvents(authenticatedUserId).pipe(
      map((event: SSEEvent) => ({
        data: event,
        id: `${event.timestamp}-${Math.random()}`,
      })),
    );
  }

  /**
   * Health check endpoint for SSE
   * Quick status check for monitoring
   */
  @Get("health")
  getSSEHealth() {
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      activeSubscriptions: this.sseEmitterService.getActiveSubscriptionsCount(),
    };
  }

  /**
   * Monitor 1: CURRENT CONNECTIONS (subscriptionRegistry)
   * Shows who is CURRENTLY connected RIGHT NOW
   * Perfect for detecting stale or accumulated subscriptions
   *
   * Returns:
   * - totalConnections: Total active subscriptions
   * - connectionsPerUser: Breakdown by userId
   * - allSubscriptions: List of all active subscriptions with timestamps
   */
  @Get("monitor/current-connections")
  getCurrentConnections() {
    const allSubscriptions = this.sseEmitterService.listAllSubscriptions();

    // Group by userId
    const connectionsPerUser: Record<number, number> = {};
    allSubscriptions.forEach((sub) => {
      if (sub.userId) {
        connectionsPerUser[sub.userId] =
          (connectionsPerUser[sub.userId] || 0) + 1;
      }
    });

    return {
      timestamp: new Date().toISOString(),
      description: "Active browser connections (subscriptionRegistry)",
      totalConnections: allSubscriptions.length,
      connectionsPerUser,
      allSubscriptions: allSubscriptions.map((sub) => ({
        subscriptionId: sub.subscriptionId,
        userId: sub.userId,
        resource: sub.resource,
        queryKey: sub.queryKey,
        subscribedAt: sub.subscribedAt,
      })),
    };
  }

  /**
   * Monitor 2: EMITTED RESOURCES (emittedResources)
   * Shows what resources have EVER been emitted (historical tracking)
   * Perfect for understanding system activity patterns
   *
   * Returns:
   * - totalUniqueResources: Count of different resources emitted
   * - resourcesByType: Grouped by resource type
   * - allEmittedResources: Detailed list with event counts and last emission time
   */
  @Get("monitor/emitted-resources")
  getEmittedResources() {
    const emittedByType = this.sseEmitterService.getEmittedResourcesByType();
    const allEmitted = this.sseEmitterService.listEmittedResources();

    // Calculate totals
    const totalEventCount = allEmitted.reduce(
      (sum, r) => sum + r.eventCount,
      0,
    );

    return {
      timestamp: new Date().toISOString(),
      description: "Historical resource emissions (emittedResources)",
      totalUniqueResources: allEmitted.length,
      totalEventCount,
      resourcesByType: emittedByType,
      allEmittedResources: allEmitted.map((resource) => ({
        resource: resource.resource,
        resourceId: resource.resourceId,
        eventCount: resource.eventCount,
        lastEmittedAt: resource.lastEmittedAt,
      })),
    };
  }

  /**
   * Monitor SUMMARY: Both connections and emissions at a glance
   * Perfect for dashboard/monitoring overview
   *
   * Returns both metrics in one call for quick health check
   */
  @Get("monitor/summary")
  getMonitoringSummary() {
    const allSubscriptions = this.sseEmitterService.listAllSubscriptions();
    const allEmitted = this.sseEmitterService.listEmittedResources();

    // Calculate stats
    const connectionsPerUser: Record<number, number> = {};
    allSubscriptions.forEach((sub) => {
      if (sub.userId) {
        connectionsPerUser[sub.userId] =
          (connectionsPerUser[sub.userId] || 0) + 1;
      }
    });

    const totalEventCount = allEmitted.reduce(
      (sum, r) => sum + r.eventCount,
      0,
    );

    return {
      timestamp: new Date().toISOString(),
      description: "SSE System Health Summary",
      connections: {
        totalActive: allSubscriptions.length,
        byUser: connectionsPerUser,
        userCount: Object.keys(connectionsPerUser).length,
      },
      emissions: {
        totalUniqueResources: allEmitted.length,
        totalEventCount,
        topResourcesEmitted: allEmitted
          .sort((a, b) => b.eventCount - a.eventCount)
          .slice(0, 5)
          .map((r) => ({
            resource: r.resource,
            resourceId: r.resourceId,
            eventCount: r.eventCount,
          })),
      },
    };
  }

  /**
   * MAINTENANCE: Clear all monitoring data (subscriptions + emissions)
   * ⚠️  WARNING: This will clear all active subscriptions and emission history
   * Only use for testing, debugging, or emergency cleanup
   *
   * Logs details of what was cleared for audit trail
   */
  @Post("monitor/clear-all")
  clearAllMonitoringData(@Request() req) {
    const userId = req.user?.id;
    const allSubscriptions = this.sseEmitterService.listAllSubscriptions();
    const allEmitted = this.sseEmitterService.listEmittedResources();

    const subscriptionCount = allSubscriptions.length;
    const emittedResourceCount = allEmitted.length;
    const totalEventCount = allEmitted.reduce(
      (sum, r) => sum + r.eventCount,
      0,
    );

    // Clear all data
    this.sseEmitterService.clearAllSubscriptions();
    this.sseEmitterService.clearEmittedResources();

    // Log the clearance action
    logger.warn(
      `[SSE MAINTENANCE] User ${userId} triggered clear-all monitoring data:
      - Subscriptions cleared: ${subscriptionCount}
      - Emitted resources cleared: ${emittedResourceCount}
      - Total events tracked: ${totalEventCount}
      - Timestamp: ${new Date().toISOString()}`,
    );

    return {
      timestamp: new Date().toISOString(),
      action: "CLEAR_ALL",
      cleared: {
        subscriptions: subscriptionCount,
        emittedResources: emittedResourceCount,
        totalEventCount,
      },
      clearedBy: userId,
      message: "All SSE monitoring data cleared successfully",
    };
  }

  /**
   * MAINTENANCE: Clear only subscriptions (keeps emission history)
   * Useful for cleaning up stale connections without losing analytics
   */
  @Post("monitor/clear-subscriptions")
  clearSubscriptions(@Request() req) {
    const userId = req.user?.id;
    const allSubscriptions = this.sseEmitterService.listAllSubscriptions();
    const subscriptionCount = allSubscriptions.length;

    this.sseEmitterService.clearAllSubscriptions();

    logger.warn(
      `[SSE MAINTENANCE] User ${userId} cleared subscriptions: ${subscriptionCount} removed at ${new Date().toISOString()}`,
    );

    return {
      timestamp: new Date().toISOString(),
      action: "CLEAR_SUBSCRIPTIONS",
      cleared: {
        subscriptions: subscriptionCount,
      },
      clearedBy: userId,
      message: "All subscriptions cleared (emission history retained)",
    };
  }

  /**
   * MAINTENANCE: Clear only emitted resources (keeps active subscriptions)
   * Useful for resetting analytics while keeping connections alive
   */
  @Post("monitor/clear-emissions")
  clearEmissions(@Request() req) {
    const userId = req.user?.id;
    const allEmitted = this.sseEmitterService.listEmittedResources();
    const emittedCount = allEmitted.length;
    const totalEventCount = allEmitted.reduce(
      (sum, r) => sum + r.eventCount,
      0,
    );

    this.sseEmitterService.clearEmittedResources();

    logger.warn(
      `[SSE MAINTENANCE] User ${userId} cleared emissions: ${emittedCount} resources (${totalEventCount} events) at ${new Date().toISOString()}`,
    );

    return {
      timestamp: new Date().toISOString(),
      action: "CLEAR_EMISSIONS",
      cleared: {
        emittedResources: emittedCount,
        totalEventCount,
      },
      clearedBy: userId,
      message: "All emission history cleared (active subscriptions retained)",
    };
  }

  /**
  getSSESubscriptionList() {
    return {
      activeSubscriptionLists: this.sseEmitterService.listAllSubscriptions(),
    };
  }

  /**
   * List all emitted groups by resource type
   * Returns current active subscriptions count
   */
  @Get("list-all-emitted-resources-by-type")
  getEmittedResourcesByType() {
    return {
      activeSubscriptionLists:
        this.sseEmitterService.getEmittedResourcesByType(),
    };
  }

  /**
   * Register subscription resources
   * Frontend calls this after connecting to EventSource
   * Sends: { subscriptionId, resources: [{ resource: 'users', resourceId: 3 }, ...] }
   */
  @Post("register-subscriptions")
  registerSubscriptions(
    @Body()
    body: {
      subscriptionId: string;
      resources: Array<{ resource: string; resourceId?: number }>;
    },
  ) {
    this.sseEmitterService.registerSubscriptionResources(
      body.subscriptionId,
      body.resources,
    );
    return { success: true, message: "Subscriptions registered" };
  }
}
