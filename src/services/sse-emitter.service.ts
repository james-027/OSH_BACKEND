import { Injectable } from "@nestjs/common";
import { Subject, Observable } from "rxjs";

/**
 * SSE Event types for React Query invalidation
 */
export interface SSEEvent {
  type: "UPDATE" | "CREATE" | "DELETE" | "INVALIDATE";
  resource: string; // e.g., "users", "warehouse-requirements", etc.
  resourceId?: number;
  data?: any;
  timestamp: string;
  userId?: number;
}

@Injectable()
export class SSEEmitterService {
  // Store subjects per user for targeted broadcasts
  private userEventSubjects = new Map<number, Subject<SSEEvent>>();

  /**
   * Get or create an event stream for a specific user
   */
  subscribeToUserEvents(userId: number): Observable<SSEEvent> {
    if (!this.userEventSubjects.has(userId)) {
      this.userEventSubjects.set(userId, new Subject<SSEEvent>());
    }
    return this.userEventSubjects.get(userId)!.asObservable();
  }

  /**
   * Broadcast event to specific user
   */
  emitUserEvent(userId: number, event: SSEEvent): void {
    const subject = this.userEventSubjects.get(userId);
    if (subject) {
      subject.next(event);
    }
  }

  /**
   * Broadcast event to multiple users
   */
  emitMultipleUserEvents(userIds: number[], event: SSEEvent): void {
    userIds.forEach((userId) => {
      this.emitUserEvent(userId, event);
    });
  }

  /**
   * Broadcast event to all connected users
   */
  emitBroadcastEvent(event: SSEEvent): void {
    this.userEventSubjects.forEach((subject) => {
      subject.next(event);
    });
  }

  /**
   * Clean up user subscription when they disconnect
   */
  unsubscribeUser(userId: number): void {
    const subject = this.userEventSubjects.get(userId);
    if (subject) {
      subject.complete();
      this.userEventSubjects.delete(userId);
    }
  }

  /**
   * Get count of active subscriptions (useful for monitoring)
   */
  getActiveSubscriptions(): number {
    return this.userEventSubjects.size;
  }
}
