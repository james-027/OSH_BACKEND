import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { ThrottleTrackingService } from "../guards/throttle-tracking.guard";

/**
 * Interceptor to store the current attempt count before response
 * Keeps the data fresh for the exception filter
 */
@Injectable()
export class ThrottleTrackingInterceptor implements NestInterceptor {
  constructor(
    @Inject(ThrottleTrackingService)
    private throttleTrackingService: ThrottleTrackingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const ip =
      request.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
      request.ip ||
      "UNKNOWN";

    // Get the current attempt count for this IP
    const attempts = this.throttleTrackingService.getAttemptCount(ip);

    // Store it for access in the exception filter
    // Just store the attempt count, no limit needed
    this.throttleTrackingService.recordAttemptInfo(ip, attempts, 0);

    console.log(
      `🔥 [THROTTLE-TRACKING-INTERCEPTOR] IP: ${ip} | Current Attempts: ${attempts}`,
    );

    return next.handle();
  }
}
