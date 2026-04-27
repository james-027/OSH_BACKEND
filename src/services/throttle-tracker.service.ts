import { Injectable } from "@nestjs/common";

/**
 * Tracks throttle attempts per IP address
 * Allows the exception filter to access attempt counts for logging
 */
@Injectable()
export class ThrottleTrackerService {
  private throttleData: Map<string, { attempts: number; limit: number }> =
    new Map();

  /**
   * Record a throttle attempt for an IP
   */
  recordAttempt(ip: string, attempts: number, limit: number): void {
    this.throttleData.set(ip, { attempts, limit });
  }

  /**
   * Get the current throttle data for an IP
   */
  getThrottleData(ip: string): { attempts: number; limit: number } | null {
    return this.throttleData.get(ip) || null;
  }

  /**
   * Clear data for an IP after logging
   */
  clearData(ip: string): void {
    this.throttleData.delete(ip);
  }
}
