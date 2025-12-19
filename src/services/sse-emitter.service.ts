import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Subject, Observable, Subscription, interval } from "rxjs";
import { tap } from "rxjs/operators";
import logger from "src/config/logger";

/**
 * SSE Event interface for pure broadcast architecture
 * All events are broadcast to ALL connected clients
 * React Query on client intelligently matches resource type to query keys
 */
export interface SSEEvent {
  type: "UPDATE" | "CREATE" | "DELETE" | "INVALIDATE";
  resource: string; // e.g., "users", "renewal_types", "warehouse_requirements", etc.
  resourceId?: number;
  data?: any;
  timestamp: string;
}

/**
 * Subscription details for tracking active connections
 */
export interface SubscriptionDetail {
  subscriptionId: string;
  subscribedAt: Date;
  resource: string;
  resourceId?: number; // e.g., ["users", 3] where 3 is userId
  queryKey: string; // e.g., "users" or "users:3"
}

/**
 * Subscription statistics
 */
export interface SubscriptionStats {
  totalActiveSubscriptions: number;
  subscriptionsPerResource: Record<string, number>;
  allSubscriptions: SubscriptionDetail[];
}

@Injectable()
// export class SSEEmitterService implements OnModuleInit {
export class SSEEmitterService {
  // private readonly logger = new Logger(SSEEmitterService.name);

  // Single global broadcast subject for all connected clients
  private broadcastSubject = new Subject<SSEEvent>();

  // Heartbeat interval subscription to keep connections alive
  private heartbeatSubscription: Subscription;

  // Track all active subscriptions with metadata
  private subscriptionRegistry = new Map<string, SubscriptionDetail>();

  // Track all emitted resources (for monitoring what's active)
  private emittedResources = new Map<
    string,
    {
      resource: string;
      resourceId?: number;
      lastEmittedAt: Date;
      eventCount: number;
    }
  >();

  /**
   * Initialize heartbeat on module startup
   */
  // onModuleInit() {
  //   this.startHeartbeat();
  // }

  /**
   * Start sending heartbeat events every 15 seconds to keep connections alive
   * Without this, browsers close idle EventSource connections after ~30 seconds
   */
  private startHeartbeat(): void {
    this.heartbeatSubscription = interval(15000).subscribe(() => {
      this.broadcastSubject.next({
        type: "UPDATE",
        resource: "heartbeat",
        timestamp: new Date().toISOString(),
      });
      logger.debug(
        `[SSE] Heartbeat sent (keeping ${this.subscriptionRegistry.size} connections alive)`
      );
    });
  }

  /**
   * Subscribe to broadcast event stream
   * All connected users receive the same stream
   * React Query on client filters events by resource type
   *
   * Tracks subscription in registry for monitoring and invalidation
   */
  subscribeToEvents(): Observable<SSEEvent> {
    const subscriptionId = this.generateSubscriptionId();
    const subscriptionDetail: SubscriptionDetail = {
      subscriptionId,
      subscribedAt: new Date(),
      resource: "broadcast", // Broadcast subscription
      queryKey: "broadcast",
    };

    this.subscriptionRegistry.set(subscriptionId, subscriptionDetail);
    logger.info(
      `[SSE] New subscription: ${subscriptionId} (Total: ${this.subscriptionRegistry.size})`
    );

    return this.broadcastSubject.asObservable().pipe(
      tap({
        complete: () => {
          this.subscriptionRegistry.delete(subscriptionId);
          logger.info(
            `[SSE] Subscription removed: ${subscriptionId} (Total: ${this.subscriptionRegistry.size})`
          );
        },
        error: () => {
          this.subscriptionRegistry.delete(subscriptionId);
        },
      })
    );
  }

  /**
   * Broadcast event to ALL connected clients
   * This is the only emission method needed for pure broadcast
   * @param event - The SSE event to broadcast
   */
  broadcastEvent(event: SSEEvent): void {
    // Track emitted resource
    const resourceKey = `${event.resource}:${event.resourceId || "*"}`;
    const existing = this.emittedResources.get(resourceKey);

    this.emittedResources.set(resourceKey, {
      resource: event.resource,
      resourceId: event.resourceId,
      lastEmittedAt: new Date(),
      eventCount: (existing?.eventCount || 0) + 1,
    });

    logger.info(
      `[SSE] Event emitted: ${event.type} - ${event.resource}${
        event.resourceId ? `:${event.resourceId}` : ""
      } | Active subscriptions: ${this.subscriptionRegistry.size}`
    );

    // Emit to all subscribers
    this.broadcastSubject.next(event);

    logger.info(
      `[SSE] Broadcast complete for ${event.resource}:${event.resourceId || "N/A"}`
    );
  }

  /**
   * Get statistics about active subscriptions
   * @returns Subscription statistics including counts and details
   */
  getSubscriptionStats(): SubscriptionStats {
    const stats: SubscriptionStats = {
      totalActiveSubscriptions: this.subscriptionRegistry.size,
      subscriptionsPerResource: {},
      allSubscriptions: Array.from(this.subscriptionRegistry.values()),
    };

    // Count subscriptions per resource
    stats.allSubscriptions.forEach((sub) => {
      if (!stats.subscriptionsPerResource[sub.resource]) {
        stats.subscriptionsPerResource[sub.resource] = 0;
      }
      stats.subscriptionsPerResource[sub.resource]++;
    });

    return stats;
  }

  /**
   * Get count of active subscriptions globally
   * @returns Total number of active subscriptions
   */
  getActiveSubscriptionsCount(): number {
    return this.subscriptionRegistry.size;
  }

  /**
   * List all active subscriptions with details
   * @returns Array of subscription details
   */
  listAllSubscriptions(): SubscriptionDetail[] {
    return Array.from(this.subscriptionRegistry.values());
  }

  /**
   * List subscriptions for a specific resource
   * @param resource - The resource name (e.g., "users", "locations")
   * @param resourceId - Optional resource ID (e.g., userId)
   * @returns Array of matching subscriptions
   */
  listSubscriptionsByResource(
    resource: string,
    resourceId?: number
  ): SubscriptionDetail[] {
    return this.listAllSubscriptions().filter((sub) => {
      if (sub.resource !== resource) return false;
      if (resourceId !== undefined && sub.resourceId !== resourceId)
        return false;
      return true;
    });
  }

  /**
   * Invalidate specific resource subscriptions
   *
   * Usage:
   * - Invalidate all subscriptions for a resource: invalidateResource('users')
   * - Invalidate specific user's subscriptions: invalidateResource('users', 3)
   * - Invalidate subscriptions for user #3's data: invalidateResourceId(3)
   *
   * @param resource - The resource type to invalidate
   * @param resourceId - Optional specific resource ID to invalidate
   *
   * Example: When user #3's permissions change:
   * this.sseEmitterService.invalidateResource('users', 3);
   * // Broadcasts: { type: 'INVALIDATE', resource: 'users', resourceId: 3 }
   */
  invalidateResource(resource: string, resourceId?: number): void {
    const subscriptions = this.listSubscriptionsByResource(
      resource,
      resourceId
    );

    if (subscriptions.length === 0) {
      logger.warn(
        `[SSE] No subscriptions found for ${resource}${
          resourceId ? `:${resourceId}` : ""
        }`
      );
      return;
    }

    logger.info(
      `[SSE] Invalidating ${subscriptions.length} subscriptions for ${resource}${
        resourceId ? `:${resourceId}` : ""
      }`
    );

    // Broadcast invalidation event to all clients
    const event: SSEEvent = {
      type: "INVALIDATE",
      resource,
      resourceId,
      timestamp: new Date().toISOString(),
    };

    this.broadcastEvent(event);
  }

  /**
   * Invalidate all subscriptions for a specific resource ID across all resource types
   *
   * Usage: When a user is deleted or permissions change, invalidate all their subscriptions
   * Example: User #3 is deleted
   * this.sseEmitterService.invalidateAllSubscriptionsForResourceId(3);
   * // Broadcasts invalidation for ['users', 3], ['locations', 3], etc.
   *
   * @param resourceId - The ID to invalidate across all resources
   */
  invalidateAllSubscriptionsForResourceId(resourceId: number): void {
    const allSubscriptions = this.listAllSubscriptions();

    // Find all unique resources that have this resourceId
    const affectedResources = new Set<string>();
    allSubscriptions.forEach((sub) => {
      if (sub.resourceId === resourceId) {
        affectedResources.add(sub.resource);
      }
    });

    if (affectedResources.size === 0) {
      logger.warn(
        `[SSE] No subscriptions found for resource ID: ${resourceId}`
      );
      return;
    }

    logger.info(
      `[SSE] Invalidating ${affectedResources.size} resource types for ID ${resourceId}`
    );

    // Broadcast invalidation for each affected resource
    affectedResources.forEach((resource) => {
      const event: SSEEvent = {
        type: "INVALIDATE",
        resource,
        resourceId,
        timestamp: new Date().toISOString(),
      };
      this.broadcastEvent(event);
    });
  }

  /**
   * Invalidate all subscriptions for multiple resource IDs
   *
   * Usage: When multiple users' permissions change
   * Example: Roles [1, 2, 3] are deactivated
   * this.sseEmitterService.invalidateMultipleResourceIds([1, 2, 3]);
   *
   * @param resourceIds - Array of IDs to invalidate
   */
  invalidateMultipleResourceIds(resourceIds: number[]): void {
    logger.info(
      `[SSE] Invalidating ${resourceIds.length} resource IDs: ${resourceIds.join(", ")}`
    );
    resourceIds.forEach((id) => {
      this.invalidateAllSubscriptionsForResourceId(id);
    });
  }

  /**
   * List all emitted resources (resources with active SSE events)
   * @returns Array of emitted resources with metadata
   */
  listEmittedResources(): Array<{
    resource: string;
    resourceId?: number;
    lastEmittedAt: Date;
    eventCount: number;
  }> {
    return Array.from(this.emittedResources.values());
  }

  /**
   * Get emitted resources grouped by resource type
   * @returns Object with resource types as keys and arrays of details as values
   */
  getEmittedResourcesByType(): Record<
    string,
    Array<{ resourceId?: number; lastEmittedAt: Date; eventCount: number }>
  > {
    const grouped: Record<
      string,
      Array<{ resourceId?: number; lastEmittedAt: Date; eventCount: number }>
    > = {};

    this.emittedResources.forEach((value) => {
      if (!grouped[value.resource]) {
        grouped[value.resource] = [];
      }
      grouped[value.resource].push({
        resourceId: value.resourceId,
        lastEmittedAt: value.lastEmittedAt,
        eventCount: value.eventCount,
      });
    });

    return grouped;
  }

  /**
   * Clear all emitted resources tracking (for testing)
   */
  clearEmittedResources(): void {
    const count = this.emittedResources.size;
    this.emittedResources.clear();
    logger.warn(`[SSE] Cleared ${count} emitted resource records`);
  }

  /**
   * Register a client's interest in specific resources
   * Called by frontend after EventSource connects
   *
   * @param subscriptionId - The subscription ID
   * @param resources - Array of resources: [{ resource: 'users', resourceId: 3 }, ...]
   */
  registerSubscriptionResources(
    subscriptionId: string,
    resources: Array<{ resource: string; resourceId?: number }>
  ): void {
    const existing = this.subscriptionRegistry.get(subscriptionId);
    if (!existing) {
      logger.warn(
        `[SSE] Subscription ${subscriptionId} not found for registration`
      );
      return;
    }

    // Update with actual resources being listened to
    resources.forEach((res) => {
      const detailKey = `${subscriptionId}:${res.resource}:${res.resourceId || "*"}`;
      this.subscriptionRegistry.set(detailKey, {
        subscriptionId,
        subscribedAt: existing.subscribedAt,
        resource: res.resource,
        resourceId: res.resourceId,
        queryKey: res.resourceId
          ? `${res.resource}:${res.resourceId}`
          : res.resource,
      });
    });

    logger.info(
      `[SSE] Registered ${resources.length} resources for subscription ${subscriptionId}`
    );
  }

  /**
   * Clear all subscriptions (for testing or emergency cleanup)
   */
  clearAllSubscriptions(): void {
    const count = this.subscriptionRegistry.size;
    this.subscriptionRegistry.clear();
    logger.warn(`[SSE] Cleared ${count} subscriptions`);
  }

  /**
   * Generate unique subscription ID
   * @private
   */
  private generateSubscriptionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
