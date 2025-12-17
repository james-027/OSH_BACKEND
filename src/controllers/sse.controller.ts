import {
  Controller,
  Get,
  Param,
  Sse,
  MessageEvent,
  UseGuards,
  Request,
  ParseIntPipe,
} from "@nestjs/common";
import { Observable, interval } from "rxjs";
import { map } from "rxjs/operators";
import { SSEEmitterService, SSEEvent } from "../services/sse-emitter.service";
import { JwtAuthGuard } from "src/guards/jwt-auth.guard";

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
   * @param req - Request object with authenticated user
   * @returns Observable stream of server-sent events (broadcast to all)
   */
  @Sse("broadcast")
  subscribeToEvents(@Request() req): Observable<any> {
    // Verify user is authenticated (JwtAuthGuard ensures this)
    const authenticatedUserId = req.user?.id;
    if (!authenticatedUserId) {
      throw new Error("Unauthorized: Must be authenticated to receive events");
    }

    return this.sseEmitterService.subscribeToEvents().pipe(
      map((event: SSEEvent) => ({
        data: event,
        id: `${event.timestamp}-${Math.random()}`,
      }))
    );
  }

  /**
   * Legacy endpoint for backward compatibility
   * Redirects to broadcast stream regardless of user_id
   * (In pure broadcast, user_id doesn't matter - all users get same events)
   */
  @Sse("users/:user_id")
  subscribeToUserEvents(
    @Param("user_id", ParseIntPipe) user_id: number,
    @Request() req
  ): Observable<any> {
    // Verify user is authenticated
    const authenticatedUserId = req.user?.id;
    if (!authenticatedUserId) {
      throw new Error("Unauthorized: Must be authenticated to receive events");
    }

    // Return broadcast stream (same for all users)
    return this.sseEmitterService.subscribeToEvents().pipe(
      map((event: SSEEvent) => ({
        data: event,
        id: `${event.timestamp}-${Math.random()}`,
      }))
    );
  }

  /**
   * Health check endpoint for SSE
   * Returns current active subscriptions count
   */
  @Get("health")
  getSSEHealth() {
    return {
      status: "healthy",
      activeSubscriptions: this.sseEmitterService.getActiveSubscriptionsCount(),
    };
  }

  /**
   * List all subscriptions for SSE
   * Returns current active subscriptions count
   */
  @Get("list-all-subscriptions")
  getSSESubscriptionList(@Request() req) {
    return {
      user: req.user?.id || null,
      activeSubscriptionLists: this.sseEmitterService.listAllSubscriptions(),
    };
  }
}
