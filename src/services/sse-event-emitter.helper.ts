import { Injectable } from "@nestjs/common";
import { SSEEmitterService, SSEEvent } from "./sse-emitter.service";

/**
 * Helper service for emitting SSE events from business logic services
 * Pure broadcast architecture: all events go to ALL connected clients
 * React Query on client matches resource type to query keys automatically
 *
 * Usage in services:
 * - After creating a resource: this.sseEventEmitter.emitCreate('renewal_types', id, data)
 * - After updating a resource: this.sseEventEmitter.emitUpdate('users', userId, data)
 * - After deleting a resource: this.sseEventEmitter.emitDelete('warehouse_requirements', id)
 * - For complex updates: this.sseEventEmitter.emitInvalidate('resource_name')
 */
@Injectable()
export class SSEEventEmitterHelper {
  constructor(private sseEmitterService: SSEEmitterService) {}

  /**
   * Broadcast CREATE event to all connected clients
   * @param resource - Resource type (e.g., "renewal_types", "users", "warehouse_requirements")
   * @param resourceId - The ID of the created resource
   * @param data - Optional data payload with full resource details
   */
  emitCreate(resource: string, resourceId: number, data?: any): void {
    const event: SSEEvent = {
      type: "CREATE",
      resource,
      resourceId,
      data,
      timestamp: new Date().toISOString(),
    };
    this.sseEmitterService.broadcastEvent(event);
  }

  /**
   * Broadcast UPDATE event to all connected clients
   * @param resource - Resource type (e.g., "users", "renewal_types")
   * @param resourceId - The ID of the updated resource
   * @param data - Optional data payload with updated resource details
   */
  emitUpdate(resource: string, resourceId: number, data?: any): void {
    const event: SSEEvent = {
      type: "UPDATE",
      resource,
      resourceId,
      data,
      timestamp: new Date().toISOString(),
    };
    this.sseEmitterService.broadcastEvent(event);
  }

  /**
   * Broadcast DELETE event to all connected clients
   * @param resource - Resource type (e.g., "renewal_types", "warehouse_requirements")
   * @param resourceId - The ID of the deleted resource
   */
  emitDelete(resource: string, resourceId: number): void {
    const event: SSEEvent = {
      type: "DELETE",
      resource,
      resourceId,
      timestamp: new Date().toISOString(),
    };
    this.sseEmitterService.broadcastEvent(event);
  }

  /**
   * Broadcast INVALIDATE event to trigger full refetch
   * Use this when update is complex and you want client to refetch
   * @param resource - Resource type to invalidate (e.g., "users", "warehouse_requirements")
   */
  emitInvalidate(resource: string): void {
    const event: SSEEvent = {
      type: "INVALIDATE",
      resource,
      timestamp: new Date().toISOString(),
    };
    this.sseEmitterService.broadcastEvent(event);
  }

  /**
   * ========== SIGNAL-ONLY METHODS (No Data) ==========
   * Use these for SSE + React Query (cache invalidation only)
   * Frontend: useSSEBroadcast hook + useQuery hooks
   * Benefit: No data in event, React Query refetches to get fresh data
   * Network: 1 initial load + N refetch calls (cleaner but more API calls)
   */

  /**
   * Broadcast CREATE signal (without data) to all connected clients
   * Triggers React Query cache invalidation and refetch
   * @param resource - Resource type (e.g., "locations", "users")
   * @param resourceId - The ID of the created resource
   */
  emitCreateSignal(resource: string, resourceId: number): void {
    const event: SSEEvent = {
      type: "CREATE",
      resource,
      resourceId,
      // NO data field
      timestamp: new Date().toISOString(),
    };
    this.sseEmitterService.broadcastEvent(event);
  }

  /**
   * Broadcast UPDATE signal (without data) to all connected clients
   * Triggers React Query cache invalidation and refetch
   * @param resource - Resource type (e.g., "locations", "users")
   * @param resourceId - The ID of the updated resource
   */
  emitUpdateSignal(resource: string, resourceId: number): void {
    const event: SSEEvent = {
      type: "UPDATE",
      resource,
      resourceId,
      // NO data field
      timestamp: new Date().toISOString(),
    };
    this.sseEmitterService.broadcastEvent(event);
  }

  /**
   * Broadcast DELETE signal (without data) to all connected clients
   * Triggers React Query cache removal and list refetch
   * @param resource - Resource type (e.g., "locations", "users")
   * @param resourceId - The ID of the deleted resource
   */
  emitDeleteSignal(resource: string, resourceId: number): void {
    const event: SSEEvent = {
      type: "DELETE",
      resource,
      resourceId,
      // NO data field
      timestamp: new Date().toISOString(),
    };
    this.sseEmitterService.broadcastEvent(event);
  }

  /**
   * Broadcast INVALIDATE signal (without data) to trigger full refetch
   * @param resource - Resource type to invalidate (e.g., "locations", "users")
   */
  emitInvalidateSignal(resource: string): void {
    const event: SSEEvent = {
      type: "INVALIDATE",
      resource,
      // NO data field
      timestamp: new Date().toISOString(),
    };
    this.sseEmitterService.broadcastEvent(event);
  }
}
