import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, In } from "typeorm";
import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";

import { PayrollHeader } from "src/entities/PayrollHeader";
import { CreatePayrollHeaderDto } from "src/modules/staff-payroll/dto/CreatePayrollHeaderDto";
import { UpdatePayrollHeaderDto } from "src/modules/staff-payroll/dto/UpdatePayrollHeaderDto";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "../../../config/logger";
import { STATUS_IDS, ACTION_IDS } from "src/constants/customConstants";
import { StaffWarehouse } from "src/entities/StaffWarehouse";
import { FindStaffPayrollDetailsDto } from "src/modules/staff-payroll/dto/FindStaffPayrollDetailsDto";
import { ScheduleHeader } from "src/entities/ScheduleHeader";
import { ScheduleDetail } from "src/entities/ScheduleDetails";
import { TimeKeepingConfig } from "src/entities/TimeKeepingConfig";
import { SyncLog } from "src/entities/SyncLog";
import { PayrollDetails } from "src/entities/PayrollDetails";
import { StaffSalary } from "src/entities/StaffSalary";
import { CommonUtilitiesService } from "../../../services/common-utilities.service";
import { ActionLogsService } from "src/modules/actions/services/action-logs.service";
import { buildReqTransHeaderGroupKey } from "src/config/cache.config";

@Injectable()
export class StaffPayrollService {
  constructor(
    @InjectRepository(PayrollHeader)
    private payrollHeaderRepository: Repository<PayrollHeader>,
    @InjectRepository(PayrollDetails)
    private payrollDetailRepository: Repository<PayrollDetails>,
    @InjectRepository(TimeKeepingConfig)
    private timeKeepingRepository: Repository<TimeKeepingConfig>,
    @InjectRepository(StaffWarehouse)
    private staffWarehouseRepository: Repository<StaffWarehouse>,
    @InjectRepository(ScheduleHeader)
    private scheduleHeaderRepository: Repository<ScheduleHeader>,
    @InjectRepository(ScheduleDetail)
    private scheduleDetailRepository: Repository<ScheduleDetail>,
    @InjectRepository(SyncLog)
    private syncLogRepository: Repository<SyncLog>,
    @InjectRepository(StaffSalary)
    private staffSalaryRepository: Repository<StaffSalary>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private commonUtilitiesService: CommonUtilitiesService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
    private actionLogsService: ActionLogsService,
  ) {}

  private readonly module_name = "STAFF PAYROLL";

  async findAll(statusId?: number[], accessKeyId?: number): Promise<any[]> {
    try {
      const where: any = {
        status_id: STATUS_IDS.ACTIVE,
      };

      if (statusId && statusId.length > 0) {
        where.status_id = In(statusId);
      }

      if (accessKeyId !== undefined && accessKeyId !== null) {
        where.access_key_id = accessKeyId;
      }

      const payrollHeaders = await this.payrollHeaderRepository.find({
        where,
        relations: ["status", "createdBy", "updatedBy"],
      });

      return this.responseMapperService.mapEntitiesToResponse(payrollHeaders);
    } catch (error) {
      console.error("Error fetching payroll header:", error);

      throw new Error(
        `Failed to fetch payroll header: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async findStaffPayrollDetails(
    accessKeyId: number,
    findStaffPayrollDetails: FindStaffPayrollDetailsDto,
  ): Promise<any> {
    try {
      const { date_from, date_to, location_ids, vendor_ids } =
        findStaffPayrollDetails;

      const where: any = {
        scheduleHeader: {
          access_key_id: accessKeyId,
        },
        attendance_status_id: STATUS_IDS.VALIDATED,
      };

      if (location_ids?.length) {
        where.location_id = In(location_ids);
      }

      if (vendor_ids?.length) {
        where.vendor_id = In(vendor_ids);
      }

      // Filter using schedule_headers.schedule_date
      if (date_from && date_to) {
        where.scheduleHeader = {
          access_key_id: accessKeyId,
          schedule_date: Between(date_from, date_to),
        };
      }

      // Get all matching schedule details first
      const allScheduleDetails = await this.scheduleDetailRepository.find({
        where,
        relations: [
          "scheduleHeader",
          "staff",
          "warehouse",
          "vendor",
          "workingDays",
        ],
      });

      // Check if there is at least one detail that is not yet computed
      const hasCronComputed = allScheduleDetails.some(
        (detail) => detail.cron_computed !== true,
      );

      if (hasCronComputed) {
        return {
          message:
            "Note: Some line items for this payroll filters were not yet sync for computation. Please wait for a minute.",
          data: [],
        };
      }

      // Only get records with cron_computed = true
      const scheduleDetails = allScheduleDetails.filter(
        (detail) => detail.cron_computed === true,
      );

      // Sort warehouse alphabetically
      scheduleDetails.sort((a, b) =>
        (a.warehouse?.warehouse_name || "").localeCompare(
          b.warehouse?.warehouse_name || "",
        ),
      );

      return this.responseMapperService.mapEntitiesToResponse(scheduleDetails);
    } catch (error) {
      console.error("Error fetching payroll details:", error);
      throw new Error("Failed to fetch payroll details");
    }
  }

  async computePayroll(
    accessKeyId: number,
    createPayroll: CreatePayrollHeaderDto,
    userId: number,
  ): Promise<any> {
    try {
      const {
        payroll_date_from,
        payroll_date_to,
        location_ids,
        vendor_ids,
        reason,
        remarks,
      } = createPayroll;

      // ============================================================
      // 1. BUILD SCHEDULE DETAIL FILTER
      // ============================================================

      const where: any = {
        scheduleHeader: {
          access_key_id: accessKeyId,
        },
        attendance_status_id: STATUS_IDS.VALIDATED,
        cron_computed: true,
      };

      // Filter by location
      if (location_ids?.length) {
        where.location_id = In(location_ids);
      }

      // Filter by vendor / agency
      if (vendor_ids?.length) {
        where.vendor_id = In(vendor_ids);
      }

      // Filter by schedule date
      if (payroll_date_from && payroll_date_to) {
        where.scheduleHeader = {
          access_key_id: accessKeyId,
          schedule_date: Between(payroll_date_from, payroll_date_to),
        };
      }

      // ============================================================
      // 2. GET ALL COMPUTED + VALIDATED SCHEDULE DETAILS
      // ============================================================

      const scheduleDetails = await this.scheduleDetailRepository.find({
        where,
        relations: [
          "scheduleHeader",
          "staff",
          "warehouse",
          "vendor",
          "location",
          "workingDays",
          "actualLogsDetail",
        ],
      });

      if (!scheduleDetails.length) {
        return {
          message:
            "No validated and computed schedule details found for payroll generation.",
          data: [],
        };
      }

      // ============================================================
      // 3. GROUP BY VENDOR + LOCATION
      // ============================================================

      const groupedDetails = new Map<string, typeof scheduleDetails>();

      for (const detail of scheduleDetails) {
        const groupKey = `${detail.vendor_id}-${detail.location_id}`;

        if (!groupedDetails.has(groupKey)) {
          groupedDetails.set(groupKey, []);
        }

        groupedDetails.get(groupKey)!.push(detail);
      }

      // ============================================================
      // 4. CREATE PAYROLL HEADER + PAYROLL DETAILS
      // ============================================================

      const generatedPayrolls: any[] = [];

      for (const [groupKey, details] of groupedDetails.entries()) {
        if (!details.length) {
          continue;
        }

        const firstDetail = details[0];

        const agencyCode = firstDetail.vendor?.service_provider_code ?? "";

        const locationAbbr = firstDetail.location?.location_abbr;

        const payrollInvoice =
          await this.commonUtilitiesService.generateTransactionNumber({
            transaction_type: "PAYROLL INVOICE NUMBER",
            vendor_id: firstDetail.vendor_id,
            location_id: firstDetail.location_id,
            access_key_id: accessKeyId,
            format: "{abbr}{year}-{seq:6}",
            reset_per_year: true,
            currentDate: new Date(),
            abbr: `${agencyCode}${locationAbbr}`,
          });

        // ========================================================
        // Create Payroll Header
        // ========================================================

        const payrollHeader = this.payrollHeaderRepository.create({
          payroll_date_from: new Date(payroll_date_from),
          payroll_date_to: new Date(payroll_date_to),
          reason: reason || "",
          remarks: remarks || "",
          payroll_invoice: payrollInvoice,
          access_key_id: accessKeyId,
          status_id: STATUS_IDS.PENDING,
          created_by: userId,
        });

        const savedPayrollHeader =
          await this.payrollHeaderRepository.save(payrollHeader);

        // ========================================================
        // Create Payroll Details
        // ========================================================

        const payrollDetails = details.map((scheduleDetail) => {
          return this.payrollDetailRepository.create({
            payroll_header_id: savedPayrollHeader.id,

            schedule_detail_id: scheduleDetail.id,

            staff_id: scheduleDetail.staff_id,

            staff_code: scheduleDetail.staff?.staff_code || "",

            vendor_id: scheduleDetail.vendor_id,

            location_id: scheduleDetail.location_id,

            warehouse_id: scheduleDetail.warehouse_id,

            warehouse_ifs: scheduleDetail.warehouse?.warehouse_ifs || "",

            duty_start_time: scheduleDetail.duty_start_time,

            duty_end_time: scheduleDetail.duty_end_time,

            planned_duty_start_time: scheduleDetail.planned_duty_start_time,

            planned_duty_end_time: scheduleDetail.planned_duty_end_time,

            just_time_in: scheduleDetail.just_time_in,

            overtime_in: scheduleDetail.actualLogsDetail?.overtime_in,
            overtime_out: scheduleDetail.actualLogsDetail?.overtime_out,
            just_time_out: scheduleDetail.just_time_out,
            just_break_out: scheduleDetail.just_break_out,
            just_break_in: scheduleDetail.just_break_in,
            actual_time_in: scheduleDetail.actualLogsDetail?.time_in,
            actual_time_out: scheduleDetail.actualLogsDetail?.time_out,
            actual_break_in: scheduleDetail.actualLogsDetail?.break_in,
            actual_break_out: scheduleDetail.actualLogsDetail?.break_out,
            add_ot: scheduleDetail.add_ot,
            working_day_id: scheduleDetail.working_day_id,
            status_id: STATUS_IDS.ACTIVE,
            attendance_status_id: scheduleDetail.attendance_status_id,

            just_remarks: scheduleDetail.just_remarks,

            regular: scheduleDetail.regular,

            overtime: scheduleDetail.overtime,

            twh: scheduleDetail.twh,

            break: scheduleDetail.break,

            payroll_remarks: scheduleDetail.payroll_remarks,

            regular_hours: scheduleDetail.regular_hours,

            overtime_hours: scheduleDetail.overtime_hours,

            twh_hours: scheduleDetail.twh_hours,

            break_hours: scheduleDetail.break_hours,

            created_by: userId,
          });
        });

        const savedPayrollDetails =
          await this.payrollDetailRepository.save(payrollDetails);

        await this.scheduleDetailRepository.update(
          {
            id: In(details.map((detail) => detail.id)),
          },
          {
            attendance_status_id: STATUS_IDS.COMPUTED,
            updated_by: userId,
          },
        );

        // ========================================================
        // RESULT
        // ========================================================

        await this.userAuditTrailCreateService.create(
          {
            service: "StaffPayrollService",
            method: "create",
            raw_data: JSON.stringify(savedPayrollHeader),
            description: `Created payroll ${payrollInvoice}`,
            status_id: 1,
          },
          userId,
        );

        const payrollWithRelations = await this.payrollHeaderRepository.findOne(
          {
            where: {
              id: savedPayrollHeader.id,
            },
            relations: [
              "status",
              "createdBy",
              "updatedBy",
              "details",
              "details.staff",
              "details.vendor",
              "details.location",
              "details.warehouse",
              "details.status",
            ],
          },
        );

        if (!payrollWithRelations) {
          throw new Error("Failed to retrieve created staff payroll");
        }

        try {
          await this.actionLogsService.logAction({
            module_name: this.module_name,
            ref_id: savedPayrollHeader.id,
            action_id: ACTION_IDS.ADD,
            description: `Add Payroll ${payrollInvoice}`,
            raw_data: JSON.stringify({
              savedPayrollHeader,
            }),
            created_by: userId,
          });
        } catch (err) {
          logger.error("Action log failed for Create Staff payroll:", err);
        }

        const response =
          this.responseMapperService.mapEntityToResponse(payrollWithRelations);

        try {
          this.sseEventEmitter.emitCreate(
            "staff_payroll",
            response.id,
            response,
          );
            this.sseEventEmitter.emitUpdate(
            "staff_attendance",
            response.id,
            response,
          );
        } catch (err) {
          logger.error("SSE event failed:", err);
        }

        generatedPayrolls.push(response);
      }

      return {
        message: "Payroll generated successfully.",
        data: generatedPayrolls,
      };
    } catch (error) {
      console.error("Error generating payroll:", error);

      throw new Error(
        error instanceof Error ? error.message : "Failed to generate payroll",
      );
    }
  }

  async autoComputationScheduleDetails(): Promise<any> {
    try {
      const where: any = {
        attendance_status_id: STATUS_IDS.VALIDATED,
        cron_computed: false,
      };

      const allScheduleDetails = await this.scheduleDetailRepository.find({
        where,
        relations: [
          "scheduleHeader",
          "staff",
          "warehouse",
          "vendor",
          "workingDays",
          "actualLogsDetail",
        ],
      });

      if (!allScheduleDetails.length) {
        return [];
      }

      /*
       * Cache full_duty_auto_break per access_key_id.
       *
       */
      const autoBreakCache = new Map<number, number>();

      const computedDetails = await Promise.all(
        allScheduleDetails.map(async (scheduleDetail) => {
          try {
            const actualLogs = scheduleDetail.actualLogsDetail;

            /*
             * =====================================================
             * TIME SOURCE PRIORITY
             * =====================================================
             *
             * TIME IN:
             * just_time_in
             *     -> actual_logs.time_in
             *     -> duty_start_time
             *
             * TIME OUT:
             * just_time_out
             *     -> actual_logs.time_out
             *     -> duty_end_time
             *
             * BREAK OUT:
             * just_break_out
             *     -> actual_logs.break_out
             *
             * BREAK IN:
             * just_break_in
             *     -> actual_logs.break_in
             *
             * OVERTIME:
             * actual logs ONLY
             */

            const timeIn =
              scheduleDetail.just_time_in ??
              actualLogs?.time_in ??
              scheduleDetail.duty_start_time ??
              null;

            const timeOut =
              scheduleDetail.just_time_out ??
              actualLogs?.time_out ??
              scheduleDetail.duty_end_time ??
              null;

            const breakOut =
              scheduleDetail.just_break_out ?? actualLogs?.break_out ?? null;

            const breakIn =
              scheduleDetail.just_break_in ?? actualLogs?.break_in ?? null;

            const overtimeIn = actualLogs?.overtime_in ?? null;

            const overtimeOut = actualLogs?.overtime_out ?? null;

            /*
             * If there is no time in AND no time out,
             * there is nothing to compute.
             */
            if (!timeIn && !timeOut) {
              return {
                schedule_detail_id: scheduleDetail.id,
                updated: false,
                reason:
                  "No justification, actual logs, or scheduled duty time found",
              };
            }

            /*
             * =====================================================
             * BREAK DETECTION
             * =====================================================
             *
             * A break exists ONLY if BOTH breakOut and breakIn
             * are available.
             *
             * If either one is missing, it is treated as
             * NO BREAK and full_duty_auto_break will be used.
             */
            const hasBreak = !!breakOut && !!breakIn;

            /*
             * =====================================================
             * BREAK HOURS
             * =====================================================
             */
            let breakSeconds = 0;

            if (hasBreak) {
              breakSeconds = await this.calculateTimeDifference(
                breakOut,
                breakIn,
              );
            }

            /*
             * =====================================================
             * REGULAR HOURS
             * =====================================================
             */
            let regularSeconds = 0;

            if (timeIn && timeOut) {
              if (hasBreak) {
                /*
                 * Actual/manual break exists.
                 *
                 * Regular =
                 *   timeIn -> breakOut
                 *   +
                 *   breakIn -> timeOut
                 */
                const firstWorkPeriod = await this.calculateTimeDifference(
                  timeIn,
                  breakOut,
                );

                const secondWorkPeriod = await this.calculateTimeDifference(
                  breakIn,
                  timeOut,
                );

                regularSeconds = firstWorkPeriod + secondWorkPeriod;
              } else {
                /*
                 * =================================================
                 * NO BREAK
                 * =================================================
                 *
                 * Get the automatic break from timeKeeping
                 * using scheduleHeader.access_key_id.
                 *
                 * full_duty_auto_break is stored in MINUTES.
                 */
                const accessKeyId =
                  scheduleDetail.scheduleHeader?.access_key_id;

                let fullDutyAutoBreakMinutes = 0;

                if (accessKeyId !== undefined && accessKeyId !== null) {
                  /*
                   * Check cache first.
                   */
                  if (autoBreakCache.has(accessKeyId)) {
                    fullDutyAutoBreakMinutes =
                      autoBreakCache.get(accessKeyId) ?? 0;
                  } else {
                    /*
                     * Query time keeping only once
                     * per access key.
                     *
                     * Adjust the where field here only if
                     * your timeKeeping entity uses a different
                     * column name.
                     */
                    const timeKeeping =
                      await this.timeKeepingRepository.findOne({
                        where: {
                          access_key_id: accessKeyId,
                        },
                      });

                    fullDutyAutoBreakMinutes = Number(
                      timeKeeping?.full_duty_auto_break ?? 0,
                    );

                    /*
                     * Save to cache.
                     */
                    autoBreakCache.set(accessKeyId, fullDutyAutoBreakMinutes);
                  }
                }

                /*
                 * Get gross duration using SQL
                 * TIMESTAMPDIFF.
                 */
                const grossSeconds = await this.calculateTimeDifference(
                  timeIn,
                  timeOut,
                );

                /*
                 * Convert automatic break from
                 * minutes -> seconds.
                 */
                const autoBreakSeconds = fullDutyAutoBreakMinutes * 60;

                /*
                 * Regular =
                 * gross duration - automatic break
                 */

                regularSeconds = grossSeconds - autoBreakSeconds;

                /*
                 * Prevent negative regular hours.
                 */
                if (regularSeconds < 0) {
                  regularSeconds = 0;
                }
              }
            }

            /*
             * =====================================================
             * OVERTIME
             * =====================================================
             *
             * Overtime comes ONLY from actual logs.
             *
             * If either overtime value is missing:
             * overtime = 0
             */
            let overtimeSeconds = 0;

            if (overtimeIn && overtimeOut) {
              overtimeSeconds = await this.calculateTimeDifference(
                overtimeIn,
                overtimeOut,
              );

              if (overtimeSeconds < 0) {
                overtimeSeconds = 0;
              }
            }

            /*
             * =====================================================
             * TOTAL WORKING HOURS
             * =====================================================
             *
             * TWH = regular + overtime
             */
            const totalWorkingSeconds = regularSeconds + overtimeSeconds;

            /*
             * =====================================================
             * DECIMAL HOURS
             * =====================================================
             *
             * Example:
             * 31,500 seconds / 3,600
             * = 8.75
             */
            const regularDecimal = this.secondsToDecimalHours(regularSeconds);

            const overtimeDecimal = this.secondsToDecimalHours(overtimeSeconds);

            const totalWorkingDecimal =
              this.secondsToDecimalHours(totalWorkingSeconds);

            const breakDecimal = this.secondsToDecimalHours(breakSeconds);

            /*
             * =====================================================
             * HH:MM HOURS
             * =====================================================
             *
             * Example:
             * 31,500 seconds
             * = 08:45
             */
            const regularHours = this.secondsToTime(regularSeconds);

            const overtimeHours = this.secondsToTime(overtimeSeconds);

            const totalWorkingHours = this.secondsToTime(totalWorkingSeconds);

            const breakHours = this.secondsToTime(breakSeconds);

            await this.scheduleDetailRepository.update(scheduleDetail.id, {
              regular: regularDecimal,
              overtime: overtimeDecimal,
              twh: totalWorkingDecimal,
              break: breakDecimal,
              regular_hours: regularHours,
              overtime_hours: overtimeHours,
              twh_hours: totalWorkingHours,
              break_hours: breakHours,
              cron_computed: true,
            });

            return {
              schedule_detail_id: scheduleDetail.id,
              access_key_id:
                scheduleDetail.scheduleHeader?.access_key_id ?? null,
              time_in: timeIn,
              time_out: timeOut,
              break_out: breakOut,
              break_in: breakIn,
              overtime_in: overtimeIn,
              overtime_out: overtimeOut,
              has_break: hasBreak,
              regular_seconds: regularSeconds,
              overtime_seconds: overtimeSeconds,
              total_working_seconds: totalWorkingSeconds,
              break_seconds: breakSeconds,
              regular: regularDecimal,
              overtime: overtimeDecimal,
              twh: totalWorkingDecimal,
              break: breakDecimal,
              regular_hours: regularHours,
              overtime_hours: overtimeHours,
              twh_hours: totalWorkingHours,
              break_hours: breakHours,
              cron_computed: true,

              updated: true,
            };
          } catch (detailError) {
            console.error(
              `Error computing schedule detail ${scheduleDetail.id}:`,
              detailError,
            );

            // Store computation error for this specific schedule detail only
            try {
              await this.syncLogRepository.save({
                module: "Staff Payroll Computation",
                type: "error",
                action: "data computation",
                message:
                  detailError instanceof Error
                    ? detailError.message
                    : String(detailError),
                row_data: JSON.stringify({
                  schedule_detail_id: scheduleDetail.id,
                  staff_id: scheduleDetail.staff?.id ?? null,
                  schedule_header_id: scheduleDetail.scheduleHeader?.id ?? null,
                  time_in:
                    scheduleDetail.just_time_in ??
                    scheduleDetail.actualLogsDetail?.time_in ??
                    scheduleDetail.duty_start_time ??
                    null,
                  time_out:
                    scheduleDetail.just_time_out ??
                    scheduleDetail.actualLogsDetail?.time_out ??
                    scheduleDetail.duty_end_time ??
                    null,
                  break_out:
                    scheduleDetail.just_break_out ??
                    scheduleDetail.actualLogsDetail?.break_out ??
                    null,
                  break_in:
                    scheduleDetail.just_break_in ??
                    scheduleDetail.actualLogsDetail?.break_in ??
                    null,
                  overtime_in:
                    scheduleDetail.actualLogsDetail?.overtime_in ?? null,
                  overtime_out:
                    scheduleDetail.actualLogsDetail?.overtime_out ?? null,
                }),
              });
            } catch (logErr) {
              // Ignore logging failure so it does not stop computation of other details
            }

            return {
              schedule_detail_id: scheduleDetail.id,
              updated: false,
              error:
                detailError instanceof Error
                  ? detailError.message
                  : String(detailError),
            };
          }
        }),
      );

      return computedDetails;
    } catch (error) {
      console.error("Error computing schedule details:", error);

      throw new Error("Failed to compute schedule details");
    }
  }

  private async calculateTimeDifference(
    start: string | Date,
    end: string | Date,
  ): Promise<number> {
    const result = await this.scheduleDetailRepository.query(
      `
        SELECT TIMESTAMPDIFF(
          SECOND,
          ?,
          ?
        ) AS difference
      `,
      [start, end],
    );

    return Number(result[0]?.difference ?? 0);
  }

  private secondsToDecimalHours(seconds: number): number {
    return Number((seconds / 3600).toFixed(2));
  }

  private secondsToTime(seconds: number): string {
    if (!seconds || seconds < 0) {
      return "00:00";
    }

    const totalMinutes = Math.floor(seconds / 60);

    const hours = Math.floor(totalMinutes / 60);

    const minutes = totalMinutes % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0",
    )}`;
  }

  async autoPayrollComputation(): Promise<any> {
    try {
      const postedPayrollDetails = await this.payrollDetailRepository.find({
        where: {
          payrollHeader: {
            status_id: STATUS_IDS.POSTED,
          },
        },
        relations: [
          "payrollHeader",
          "scheduleDetail",
          "staff",
          "warehouse",
          "location",
          "vendor",
          "workingDays",
        ],
        order: {
          payroll_header_id: "ASC",
          id: "ASC",
        },
      });

      if (!postedPayrollDetails.length) {
        return {
          success: true,
          total: 0,
        };
      }

      const groupedByHeader = new Map<number, PayrollDetails[]>();

      for (const payrollDetail of postedPayrollDetails) {
        const payrollHeaderId = payrollDetail.payroll_header_id;

        if (!payrollHeaderId) {
          continue;
        }

        if (!groupedByHeader.has(payrollHeaderId)) {
          groupedByHeader.set(payrollHeaderId, []);
        }

        groupedByHeader.get(payrollHeaderId)!.push(payrollDetail);
      }

      for (const [
        payrollHeaderId,
        payrollDetails,
      ] of groupedByHeader.entries()) {
        const payrollHeader = payrollDetails[0]?.payrollHeader ?? null;

        if (!payrollHeader) {
          continue;
        }

        for (const detail of payrollDetails) {
          const salary = await this.staffSalaryRepository.findOne({
            where: {
              staff_id: detail.staff_id,
              access_key_id: payrollHeader.access_key_id,
              status_id: STATUS_IDS.ACTIVE,
            },
          });

          if (!salary) {
            continue;
          }

          const salaryRate = Number(salary.salary_rate) || 0;
          const regular = Number(detail.regular) || 0;
          const overtime = Number(detail.overtime) || 0;

          const regularAmount = (regular * salaryRate) / 8;

          const overtimeAmount = (overtime * salaryRate) / 8;

          detail.regular_amount = regularAmount;
          detail.overtime_amount = overtimeAmount;

          await this.payrollDetailRepository.save(detail);
        }
      }

      return {
        success: true,
        message: "Payroll computation completed successfully.",
      };
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to fetch posted payroll details.",
      );
    }
  }

  async postPayroll(
      updatePayrollDto: UpdatePayrollHeaderDto,
      userId: number,
    ): Promise<any> {
      try {
        const payrollIds = updatePayrollDto.id;
  
        if (!payrollIds?.length) {
          throw new BadRequestException(
            "At least one Payroll Header ID is required.",
          );
        }
  
        const payrollHeaders = await this.payrollHeaderRepository.find({
          where: {
            id: In(payrollIds),
          },
          relations: ["status", "createdBy", "updatedBy"],
        });
  
        const foundIds = payrollHeaders.map((payroll) => payroll.id);
  
        const missingIds = payrollIds.filter(
          (payrollId) => !foundIds.includes(payrollId),
        );
  
        if (missingIds.length > 0) {
          throw new NotFoundException(
            `Payroll Header(s) with ID(s) ${missingIds.join(", ")} not found`,
          );
        }
  
        const updatedPayrollHeaders =
        await this.payrollHeaderRepository.manager.transaction(
          async (transactionalEntityManager) => {
            // Update Schedule Headers
            await transactionalEntityManager.update(
              PayrollHeader,
              {
                id: In(payrollIds),
              },
              {
                status_id: STATUS_IDS.POSTED,
                updated_by: userId,
                modified_at: new Date(),
              },
            );
  
            const updatedHeaders = await transactionalEntityManager.find(
              PayrollHeader,
              {
                where: {
                  id: In(payrollIds),
                },
                relations: ["status", "createdBy", "updatedBy"],
              },
            );
  
            return updatedHeaders;
          },
        );
  
        await this.userAuditTrailCreateService.create(
          {
            service: "Staff Payroll Service",
            method: "",
            raw_data: JSON.stringify(updatedPayrollHeaders),
            description: `Posted Payroll Headers: ${payrollIds.join(", ")}`,
            status_id: 1,
          },
          userId,
        );
  
        const responses = updatedPayrollHeaders.map((schedule) =>
          this.responseMapperService.mapEntityToResponse(schedule),
        );
  
        try {
          for (const payroll of updatedPayrollHeaders) {
            await this.actionLogsService.logAction({
              module_name: this.module_name,
              ref_id: payroll.id,
              action_id: ACTION_IDS.POST,
              description: `Post Payroll`,
              raw_data: JSON.stringify(payroll),
              created_by: userId,
            });
          }
        } catch (err) {
          logger.error("Action log failed for Post Payroll:", err);
        }
  
        for (const response of responses) {
          try {
            this.sseEventEmitter.emitUpdate(
              "staff_attendance",
              response.id,
              response,
            );
            this.sseEventEmitter.emitUpdate(
              "staff_payroll",
              response.id,
              response,
            );
          } catch (err) {
            logger.error("SSE event failed:", err);
          }
        }
  
        return responses;
      } catch (error) {
        if (
          error instanceof NotFoundException ||
          error instanceof BadRequestException
        ) {
          throw error;
        }
  
        logger.error("Failed to post payroll headers:", error);
  
        throw new Error("Failed to post payroll headers");
      }
    }

  async revertPayroll(
      updatePayrollDto: UpdatePayrollHeaderDto,
      userId: number,
    ): Promise<any> {
      try {
        const payrollIds = updatePayrollDto.id;
  
        if (!payrollIds?.length) {
          throw new BadRequestException(
            "At least one Payroll Header ID is required.",
          );
        }
  
        const payrollHeaders = await this.payrollHeaderRepository.find({
          where: {
            id: In(payrollIds),
          },
          relations: ["status", "createdBy", "updatedBy"],
        });
  
        const foundIds = payrollHeaders.map((payroll) => payroll.id);
  
        const missingIds = payrollIds.filter(
          (payrollId) => !foundIds.includes(payrollId),
        );
  
        if (missingIds.length > 0) {
          throw new NotFoundException(
            `Payroll Header(s) with ID(s) ${missingIds.join(", ")} not found`,
          );
        }
  
        const updatedPayrollHeaders =
        await this.payrollHeaderRepository.manager.transaction(
          async (transactionalEntityManager) => {
            // Update Payroll Headers
            await transactionalEntityManager.update(
              PayrollHeader,
              {
                id: In(payrollIds),
              },
              {
                status_id: STATUS_IDS.PENDING,
                updated_by: userId,
                modified_at: new Date(),
              },
            );
  
            const updatedHeaders = await transactionalEntityManager.find(
              PayrollHeader,
              {
                where: {
                  id: In(payrollIds),
                },
                relations: ["status", "createdBy", "updatedBy"],
              },
            );
  
            return updatedHeaders;
          },
        );
  
        await this.userAuditTrailCreateService.create(
          {
            service: "Staff Payroll Service",
            method: "",
            raw_data: JSON.stringify(updatedPayrollHeaders),
            description: `Revert Payroll Remarks: ${updatePayrollDto.remarks}`,
            status_id: 1,
          },
          userId,
        );
  
        const responses = updatedPayrollHeaders.map((schedule) =>
          this.responseMapperService.mapEntityToResponse(schedule),
        );
  
        try {
          for (const payroll of updatedPayrollHeaders) {
            await this.actionLogsService.logAction({
              module_name: this.module_name,
              ref_id: payroll.id,
              action_id: ACTION_IDS.REVERT,
              description: `Revert Payroll Remarks: ${updatePayrollDto.remarks}`,
              raw_data: JSON.stringify(payroll),
              created_by: userId,
            });
          }
        } catch (err) {
          logger.error("Action log failed for Revert Payroll:", err);
        }
  
        for (const response of responses) {
          try {
            this.sseEventEmitter.emitUpdate(
              "staff_attendance",
              response.id,
              response,
            );
            this.sseEventEmitter.emitUpdate(
              "staff_payroll",
              response.id,
              response,
            );
          } catch (err) {
            logger.error("SSE event failed:", err);
          }
        }
  
        return responses;
      } catch (error) {
        if (
          error instanceof NotFoundException ||
          error instanceof BadRequestException
        ) {
          throw error;
        }
  
        logger.error("Failed to revert payroll headers:", error);
  
        throw new Error("Failed to revert payroll headers");
      }
    }

  async cancelPayroll(
      updatePayrollDto: UpdatePayrollHeaderDto,
      userId: number,
    ): Promise<any> {
      try {
        const payrollIds = updatePayrollDto.id;
  
        if (!payrollIds?.length) {
          throw new BadRequestException(
            "At least one Payroll Header ID is required.",
          );
        }
  
        const payrollHeaders = await this.payrollHeaderRepository.find({
          where: {
            id: In(payrollIds),
          },
          relations: ["status", "createdBy", "updatedBy"],
        });
  
        const foundIds = payrollHeaders.map((payroll) => payroll.id);
  
        const missingIds = payrollIds.filter(
          (payrollId) => !foundIds.includes(payrollId),
        );
  
        if (missingIds.length > 0) {
          throw new NotFoundException(
            `Payroll Header(s) with ID(s) ${missingIds.join(", ")} not found`,
          );
        }
  
        const updatedPayrollHeaders =
        await this.payrollHeaderRepository.manager.transaction(
          async (transactionalEntityManager) => {
            // Update Payroll Headers
            await transactionalEntityManager.update(
              PayrollHeader,
              {
                id: In(payrollIds),
              },
              {
                status_id: STATUS_IDS.CANCELLED,
                updated_by: userId,
                modified_at: new Date(),
              },
            );
  
            const updatedHeaders = await transactionalEntityManager.find(
              PayrollHeader,
              {
                where: {
                  id: In(payrollIds),
                },
                relations: ["status", "createdBy", "updatedBy"],
              },
            );
  
            return updatedHeaders;
          },
        );
  
        await this.userAuditTrailCreateService.create(
          {
            service: "Staff Payroll Service",
            method: "",
            raw_data: JSON.stringify(updatedPayrollHeaders),
            description: `Cancelled Payroll Remarks: ${updatePayrollDto.remarks}`,
            status_id: 1,
          },
          userId,
        );
  
        const responses = updatedPayrollHeaders.map((schedule) =>
          this.responseMapperService.mapEntityToResponse(schedule),
        );
  
        try {
          for (const payroll of updatedPayrollHeaders) {
            await this.actionLogsService.logAction({
              module_name: this.module_name,
              ref_id: payroll.id,
              action_id: ACTION_IDS.CANCEL,
              description: `Cancel Payroll Remarks: ${updatePayrollDto.remarks}`,
              raw_data: JSON.stringify(payroll),
              created_by: userId,
            });
          }
        } catch (err) {
          logger.error("Action log failed for cancel Payroll:", err);
        }
  
        for (const response of responses) {
          try {
            this.sseEventEmitter.emitUpdate(
              "staff_attendance",
              response.id,
              response,
            );
            this.sseEventEmitter.emitUpdate(
              "staff_payroll",
              response.id,
              response,
            );
          } catch (err) {
            logger.error("SSE event failed:", err);
          }
        }
  
        return responses;
      } catch (error) {
        if (
          error instanceof NotFoundException ||
          error instanceof BadRequestException
        ) {
          throw error;
        }
  
        logger.error("Failed to cancel payroll headers:", error);
  
        throw new Error("Failed to cancel payroll headers");
      }
    }

    async findOneHistory(ref_id: number) {
    return this.actionLogsService.findPerModuleRefID(this.module_name, ref_id);
  }

    async findPayrollHeaderDetails(
    payrollHeaderId?: number,
    accessKeyId?: number,
  ): Promise<any[]> {
    try {
      const where: any = {};

      if (payrollHeaderId !== undefined) {
        where.payroll_header_id = payrollHeaderId;
      }

      if (accessKeyId !== undefined) {
        where.payrollHeader = {
          access_key_id: accessKeyId,
        };
      }

      const payrollDetail = await this.payrollDetailRepository.find({
        where,
        relations: [
          "payrollHeader",
          "staff",
          "vendor",
          "location",
          "warehouse",
          "status",
          "createdBy",
          "updatedBy",
          "scheduleDetail",
        ],
        order: {
          id: "ASC",
        },
      });
      return this.responseMapperService.mapEntitiesToResponse(payrollDetail);
    } catch (error) {
      console.error("Error fetching payroll details:", error);
      throw new Error("Failed to fetch payroll details");
    }
  }

}
