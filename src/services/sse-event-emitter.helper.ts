import { Injectable } from "@nestjs/common";
import { SSEEmitterService, SSEEvent } from "./sse-emitter.service";

/**
 * Helper service for emitting SSE events from business logic services
 * Use this in your services (e.g., UsersService, WarehouseRequirementsService) to emit updates
 */
@Injectable()
export class SSEEventEmitterHelper {
  constructor(private sseEmitterService: SSEEmitterService) {}

  /**
   * Emit update event for a user resource
   * @param userId - The user ID receiving the event
   * @param resource - Resource type (e.g., "users", "warehouse-requirements")
   * @param resourceId - The ID of the updated resource
   * @param data - Optional data payload
   */
  emitUserUpdate(
    userId: number,
    resource: string,
    resourceId: number,
    data?: any
  ): void {
    const event: SSEEvent = {
      type: "UPDATE",
      resource,
      resourceId,
      data,
      timestamp: new Date().toISOString(),
      userId,
    };
    this.sseEmitterService.emitUserEvent(userId, event);
  }

  /**
   * Emit create event
   */
  emitUserCreate(
    userId: number,
    resource: string,
    resourceId: number,
    data?: any
  ): void {
    const event: SSEEvent = {
      type: "CREATE",
      resource,
      resourceId,
      data,
      timestamp: new Date().toISOString(),
      userId,
    };
    this.sseEmitterService.emitUserEvent(userId, event);
  }

  /**
   * Emit delete event
   */
  emitUserDelete(userId: number, resource: string, resourceId: number): void {
    const event: SSEEvent = {
      type: "DELETE",
      resource,
      resourceId,
      timestamp: new Date().toISOString(),
      userId,
    };
    this.sseEmitterService.emitUserEvent(userId, event);
  }

  /**
   * Emit invalidation event (tells client to refetch)
   * Useful when you want the client to do a full refetch instead of partial update
   */
  emitQueryInvalidation(userId: number, resource: string): void {
    const event: SSEEvent = {
      type: "INVALIDATE",
      resource,
      timestamp: new Date().toISOString(),
      userId,
    };
    this.sseEmitterService.emitUserEvent(userId, event);
  }

  /**
   * Emit update to multiple users
   */
  emitMultipleUsersUpdate(
    userIds: number[],
    resource: string,
    resourceId: number,
    data?: any
  ): void {
    const event: SSEEvent = {
      type: "UPDATE",
      resource,
      resourceId,
      data,
      timestamp: new Date().toISOString(),
    };
    this.sseEmitterService.emitMultipleUserEvents(userIds, event);
  }

  /**
   * Broadcast update to all users
   */
  emitBroadcastUpdate(resource: string, resourceId: number, data?: any): void {
    const event: SSEEvent = {
      type: "UPDATE",
      resource,
      resourceId,
      data,
      timestamp: new Date().toISOString(),
    };
    this.sseEmitterService.emitBroadcastEvent(event);
  }
}
