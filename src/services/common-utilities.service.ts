import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UsersService } from "./users.service";

/**
 * Common Utilities Service
 * Provides reusable functions for location access control and date operations
 */
@Injectable()
export class CommonUtilitiesService {
  constructor(private usersService: UsersService) {}

  /**
   * Get user's allowed location IDs based on user-role relationship
   * @param userId - The user's ID
   * @param roleId - The user's role ID
   * @returns Array of allowed location IDs
   */
  async getUserAllowedLocationIds(
    userId: number,
    roleId: number
  ): Promise<number[]> {
    try {
      const userLocations = await this.usersService[
        "userLocationsRepository"
      ].find({
        where: { user_id: userId, role_id: roleId, status_id: 1 },
        select: ["location_id"],
      });
      return userLocations.map((ul) => ul.location_id);
    } catch (error) {
      console.error("Error fetching user location IDs:", error);
      return [];
    }
  }

  /**
   * Generate array of dates within a range
   * @param dateFrom - Start date (YYYY-MM-DD format)
   * @param dateTo - End date (YYYY-MM-DD format)
   * @returns Array of date strings in YYYY-MM-DD format
   */
  getDateRange(dateFrom: string, dateTo: string): string[] {
    const dates: string[] = [];
    const start = new Date(dateFrom);
    const end = new Date(dateTo);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.warn(`Invalid date range provided: ${dateFrom} to ${dateTo}`);
      return dates;
    }

    // Ensure start is before end
    if (start > end) {
      console.warn(`Start date (${dateFrom}) is after end date (${dateTo})`);
      return dates;
    }

    // Generate date range
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split("T")[0]);
    }

    return dates;
  }

  /**
   * Format date to YYYY-MM-DD string
   * @param date - Date object or string
   * @returns Formatted date string (YYYY-MM-DD)
   */
  formatDateToString(date: Date | string): string {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return dateObj.toISOString().split("T")[0];
  }

  /**
   * Helper method to format date string
   */
  formatDateString(date: any): string {
    if (!date) return null;
    if (typeof date === "string") return date;
    if (date instanceof Date) {
      return date.toISOString().split("T")[0];
    }
    return null;
  }

  /**
   * Helper method to format file name
   */
  formatTransFileName(fileName: any): string {
    if (!fileName) return null;

    const parts = fileName.split("-");
    let newFileName = "";
    if (parts.length === 5) {
      newFileName = `${parts[3].trim()} - ${parts[4].trim()}`;
    }
    return newFileName;
  }

  /**
   * Check if date string is valid
   * @param dateStr - Date string in YYYY-MM-DD format
   * @returns true if valid, false otherwise
   */
  isValidDateString(dateStr: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) {
      return false;
    }
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }

  /**
   * Get start and end of month for given date
   * @param date - Date object or string
   * @returns Object with startDate and endDate
   */
  getMonthBoundaries(date: Date | string): {
    startDate: string;
    endDate: string;
  } {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    return {
      startDate: this.formatDateToString(startDate),
      endDate: this.formatDateToString(endDate),
    };
  }

  /**
   * Get date N days ago
   * @param days - Number of days to subtract
   * @returns Date string in YYYY-MM-DD format
   */
  getDateNDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return this.formatDateToString(date);
  }

  /**
   * Get date N days from now
   * @param days - Number of days to add
   * @returns Date string in YYYY-MM-DD format
   */
  getDateNDaysFromNow(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return this.formatDateToString(date);
  }
}
