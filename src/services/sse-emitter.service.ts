import { Injectable } from "@nestjs/common";
import { Subject, Observable } from "rxjs";

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

@Injectable()
export class SSEEmitterService {
  // Single global broadcast subject for all connected clients
  private broadcastSubject = new Subject<SSEEvent>();

  /**
   * Subscribe to broadcast event stream
   * All connected users receive the same stream
   * React Query on client filters events by resource type
   */
  subscribeToEvents(): Observable<SSEEvent> {
    return this.broadcastSubject.asObservable();
  }

  /**
   * Broadcast event to ALL connected clients
   * This is the only emission method needed for pure broadcast
   * @param event - The SSE event to broadcast
   */
  broadcastEvent(event: SSEEvent): void {
    this.broadcastSubject.next(event);
  }

  /**
   * Get count of active subscriptions (useful for monitoring)
   */
  getActiveSubscriptions(): number {
    // Note: Subject doesn't track subscriber count directly
    // In production, you'd implement custom subscription tracking
    // For now, this is a placeholder
    return 0;
  }
}
