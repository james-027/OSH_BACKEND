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
   * SSE endpoint for real-time user data updates
   * Frontend connects: EventSource('/sse/users/:user_id')
   *
   * @param user_id - The user ID to subscribe to
   * @param req - Request object with authenticated user
   * @returns Observable stream of server-sent events
   */
  @Sse("users/:user_id")
  subscribeToUserEvents(
    @Param("user_id", ParseIntPipe) user_id: number,
    @Request() req
  ): Observable<any> {
    // Verify user is requesting their own data or has permission
    const authenticatedUserId = req.user?.id;
    if (authenticatedUserId !== user_id) {
      throw new Error("Unauthorized: Cannot subscribe to other users' events");
    }

    return this.sseEmitterService.subscribeToUserEvents(user_id).pipe(
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
      activeSubscriptions: this.sseEmitterService.getActiveSubscriptions(),
    };
  }
}
