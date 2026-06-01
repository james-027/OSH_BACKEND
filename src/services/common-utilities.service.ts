import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { UsersService } from "../modules/users/services/users.service";
import { TransactionSequence } from "../entities/TransactionSequence";

/**
 * Common Utilities Service
 * Provides reusable functions for location access control, date operations, and transaction number generation
 */
@Injectable()
export class CommonUtilitiesService {
  constructor(
    private usersService: UsersService,
    @InjectRepository(TransactionSequence)
    private sequenceRepo: Repository<TransactionSequence>,
    private dataSource: DataSource,
  ) {}

  /**
   * Get user's allowed location IDs based on user-role relationship
   * @param userId - The user's ID
   * @param roleId - The user's role ID
   * @returns Array of allowed location IDs
   */
  async getUserAllowedLocationIds(
    userId: number,
    roleId: number,
  ): Promise<number[]> {
    if (!userId || !roleId) {
      return [];
    }
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

  deductDaysFromDate(date: Date | string, days: number): Date {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    dateObj.setDate(dateObj.getDate() - days);
    return dateObj;
  }

  addDaysFromDate(date: Date | string, days: number): Date {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    dateObj.setDate(dateObj.getDate() + days);
    return dateObj;
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
    for (let i = 3; i < parts.length; i++) {
      newFileName += (i > 3 ? "-" : "") + parts[i].trim();
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

  /**
   * Generate a bulletproof transaction number using database-level locking (SELECT FOR UPDATE)
   * Prevents race conditions even under high concurrency
   *
   * @param params {
   *   transaction_type: 'SALES' | 'PURCHASE' | 'TRANSFER' | etc. - Type of transaction
   *   location_id: number - Location identifier
   *   access_key_id: number - Access key identifier
   *   format: string - Format template, e.g., "{abbr}{key}{year}-{seq:4}"
   *   reset_per_year?: boolean - Whether to reset sequence annually (default: true)
   *   currentDate?: Date - Date to use for year calculation (default: new Date())
   * }
   * @returns Generated transaction number as a formatted string
   *
   * Format template examples:
   * - "{abbr}{key}{year}-{seq:4}" => "LOC1202500001"
   * - "{abbr}{year}{seq:6}" => "LOC202500000001"
   * - "{type}_{location}_{year}_{seq:4}" => "SALES_1_2025_0001"
   *
   * Format variables:
   * - {abbr} - location_abbr (provided in format)
   * - {key} - access_key_id
   * - {year} - 4-digit year
   * - {seq:N} - Zero-padded sequence number, N = number of digits
   * - Any other text is included as-is
   */
  async generateTransactionNumber(params: {
    transaction_type: string;
    location_id: number;
    access_key_id: number;
    format: string;
    reset_per_year?: boolean;
    currentDate?: Date;
    abbr?: string;
    type?: string;
    location?: string;
  }): Promise<string> {
    const {
      transaction_type,
      location_id,
      access_key_id,
      format,
      reset_per_year = true,
      currentDate = new Date(),
    } = params;

    const year = currentDate.getFullYear();

    // Start a transaction for atomic operation with SELECT FOR UPDATE
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction("SERIALIZABLE");

    try {
      // Get or create sequence record with row-level lock (SELECT FOR UPDATE)
      let sequence = await queryRunner.manager.findOne(TransactionSequence, {
        where: {
          transaction_type,
          location_id,
          access_key_id,
          ...(reset_per_year ? { year } : {}),
        },
        lock: { mode: "pessimistic_write" }, // This translates to SELECT ... FOR UPDATE
      });

      // If no sequence exists, create it
      if (!sequence) {
        sequence = new TransactionSequence();
        sequence.transaction_type = transaction_type;
        sequence.location_id = location_id;
        sequence.access_key_id = access_key_id;
        sequence.year = year;
        sequence.current_sequence = 0;
        sequence.reset_per_year = reset_per_year;
        sequence.format_template = format;
        sequence = await queryRunner.manager.save(sequence);
      }
      // If reset_per_year is true and year changed, reset the counter
      else if (reset_per_year && sequence.year !== year) {
        sequence.year = year;
        sequence.current_sequence = 0;
        sequence = await queryRunner.manager.save(sequence);
      }

      // Increment the sequence
      sequence.current_sequence++;
      await queryRunner.manager.save(sequence);

      // Commit transaction to release lock
      await queryRunner.commitTransaction();

      // Generate the formatted transaction number
      const nextNum = sequence.current_sequence;
      const transNumber = this._formatTransactionNumber(format, {
        seq: nextNum,
        year: year.toString(),
        key: access_key_id.toString(),
        abbr: params.abbr || "LOC",
        type: params.type || transaction_type,
        location: params.location || location_id.toString(),
      });

      return transNumber;
    } catch (error) {
      // Rollback on error
      await queryRunner.rollbackTransaction();
      const err = error as Error;
      throw new Error(`Failed to generate transaction number: ${err.message}`);
    } finally {
      // Release connection
      await queryRunner.release();
    }
  }

  /**
   * Helper method to format transaction number based on template
   * @private
   */
  private _formatTransactionNumber(
    template: string,
    vars: Record<string, string | number>,
  ): string {
    let result = template;

    // Replace {seq:N} with zero-padded sequence
    const seqMatch = result.match(/\{seq:(\d+)\}/);
    if (seqMatch) {
      const padLength = parseInt(seqMatch[1], 10);
      const paddedSeq = String(vars.seq).padStart(padLength, "0");
      result = result.replace(seqMatch[0], paddedSeq);
    }

    // Replace other variables
    for (const [key, value] of Object.entries(vars)) {
      if (key !== "seq") {
        result = result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
      }
    }

    return result;
  }
}
