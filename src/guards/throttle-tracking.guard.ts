import { Injectable } from "@nestjs/common";
import { ThrottleTrackerService } from "../services/throttle-tracker.service";

/**
 * Service to manually track throttle attempts per IP
 * Used by middleware to increment counters before requests are processed
 */
@Injectable()
export class ThrottleTrackingService {
  private attempts: Map<
    string,
    {
      count: number;
      timestamp: number;
      ttl: number;
    }
  > = new Map();

  /**
   * Increment attempt count for an IP
   */
  incrementAttempt(ip: string, ttl: number = 60000): number {
    const key = ip;
    const now = Date.now();

    if (this.attempts.has(key)) {
      const data = this.attempts.get(key)!;
      // Check if TTL has expired
      if (now - data.timestamp > data.ttl) {
        // Reset counter
        this.attempts.set(key, {
          count: 1,
          timestamp: now,
          ttl,
        });
        return 1;
      } else {
        // Increment counter
        data.count++;
        return data.count;
      }
    } else {
      // First attempt
      this.attempts.set(key, {
        count: 1,
        timestamp: now,
        ttl,
      });
      return 1;
    }
  }

  /**
   * Get current attempt count for an IP
   */
  getAttemptCount(ip: string): number {
    if (this.attempts.has(ip)) {
      const data = this.attempts.get(ip)!;
      const now = Date.now();
      if (now - data.timestamp > data.ttl) {
        // TTL expired, reset
        this.attempts.delete(ip);
        return 0;
      }
      return data.count;
    }
    return 0;
  }

  /**
   * Store current attempt info for access in exception filter
   */
  recordAttemptInfo(ip: string, attempts: number, limit: number): void {
    // Store in a simple property for quick access
    (this as any)[`throttle_${ip}`] = {
      attempts,
      limit,
      timestamp: Date.now(),
    };
  }

  /**
   * Get stored attempt info
   */
  getAttemptInfo(ip: string): { attempts: number; limit: number } | null {
    const info = (this as any)[`throttle_${ip}`];
    if (info && Date.now() - info.timestamp < 5000) {
      // Valid for 5 seconds - DO NOT DELETE, keep it for multiple reads
      return info;
    }
    return null;
  }
}
