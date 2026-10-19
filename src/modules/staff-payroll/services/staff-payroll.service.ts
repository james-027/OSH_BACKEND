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
import {
  STATUS_IDS,
  ACTION_IDS,
  WORKING_DAY_IDS,
} from "src/constants/customConstants";
import { StaffWarehouse } from "src/entities/StaffWarehouse";
import { FindStaffPayrollDetailsDto } from "src/modules/staff-payroll/dto/FindStaffPayrollDetailsDto";
import { ScheduleHeader } from "src/entities/ScheduleHeader";
import { ScheduleDetail } from "src/entities/ScheduleDetails";
import { TimeKeepingConfig } from "src/entities/TimeKeepingConfig";
import { SyncLog } from "src/entities/syncLog";
import { PayrollDetails } from "src/entities/PayrollDetails";
import { StaffSalary } from "src/entities/StaffSalary";
import { CommonUtilitiesService } from "../../../services/common-utilities.service";
import { ActionLogsService } from "src/modules/actions/services/action-logs.service";
import { StaffSchedulingService } from "src/modules/staff-scheduling/services/staff-scheduling.service";
import { PayrollComputationService } from "src/modules/staff-payroll/services/payroll-computation.service";
import { buildReqTransHeaderGroupKey } from "src/config/cache.config";
import { SssConfigs } from "src/entities/SssConfig";
import { StaffVendorSalary } from "src/entities/StaffVendorSalary";
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const customParseFormat = require("dayjs/plugin/customParseFormat");

dayjs.extend(utc);
dayjs.extend(customParseFormat);

import * as ExcelJS from "exceljs";

// --- Shared Style Constants ---
const borderThin: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF000000" } },
  left: { style: "thin", color: { argb: "FF000000" } },
  bottom: { style: "thin", color: { argb: "FF000000" } },
  right: { style: "thin", color: { argb: "FF000000" } },
};

const S_CYAN_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF9CD6F0" },
};

const S_GREEN_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF76D776" },
};

const S_YELLOW_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFAFD32" },
};

const S_OFF_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF7F7F7F" },
};

const parseNum = (val: any): number => {
  if (val === null || val === undefined || val === "" || isNaN(Number(val)))
    return 0;
  return Number(val);
};

const fmtMoney = (val: any): string => {
  const n = parseNum(val);
  return n === 0
    ? "-"
    : n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
};

const fmtHours = (val: any): string => {
  const n = parseNum(val);
  return n === 0 ? "-" : n.toFixed(2);
};

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
    @InjectRepository(SssConfigs)
    private sssConfigRepository: Repository<SssConfigs>,
    @InjectRepository(StaffVendorSalary)
    private staffVendorSalaryRepository: Repository<StaffVendorSalary>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private commonUtilitiesService: CommonUtilitiesService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
    private actionLogsService: ActionLogsService,
    private payrollComputationService: PayrollComputationService,
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
        relations: ["status", "createdBy", "updatedBy", "details"],
      });

      const headersWithCount = payrollHeaders.map((header) => ({
        ...header,
        no_of_entries: header.details ? header.details.length : 0,
      }));

      return this.responseMapperService.mapEntitiesToResponse(headersWithCount);
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

            schedule_date: scheduleDetail.scheduleHeader?.schedule_date,

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
            night_shift_hrs: scheduleDetail.night_shift_hrs,
            night_shift: scheduleDetail.night_shift,

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

        // await this.scheduleDetailRepository.update(
        //   {
        //     id: In(details.map((detail) => detail.id)),
        //   },
        //   {
        //     attendance_status_id: STATUS_IDS.COMPUTED,
        //     updated_by: userId,
        //   },
        // );

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

      // ============================================================
      // UPDATE SCHEDULE HEADERS PAYROLL AUDIT FIELDS
      // ============================================================

      const scheduleHeaderIds = [
        ...new Set(
          scheduleDetails
            .map((detail) => detail.scheduleHeader?.id)
            .filter((id): id is number => id !== undefined && id !== null),
        ),
      ];

      if (scheduleHeaderIds.length > 0) {
        await this.scheduleHeaderRepository.update(
          {
            id: In(scheduleHeaderIds),
          },
          {
            payroll_ts: new Date(),
            payroll_updated_by: userId,
          },
        );
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
        attendance_status_id: In([
          STATUS_IDS.VALIDATED,
          STATUS_IDS.FOR_REVIEW,
        ]),
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
        return {
          message: "No schedule details found for computation.",
          computed: 0,
          details: [],
        };
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

            const scheduleDate = scheduleDetail.scheduleHeader?.schedule_date;

            const { night_shift_hrs, night_shift } =
              await this.calculateNightShift(timeIn, timeOut, scheduleDate);

            const breakOut =
              scheduleDetail.just_break_out ?? actualLogs?.break_out ?? null;

            const breakIn =
              scheduleDetail.just_break_in ?? actualLogs?.break_in ?? null;

            const overtimeIn = scheduleDetail.overtime_in ?? null;
            const overtimeOut = scheduleDetail.overtime_out ?? null;

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

            const totalEligibleSeconds = Math.max(regularSeconds, 0);
            const eightHoursInSeconds = 8 * 60 * 60;

            regularSeconds = Math.min(
              totalEligibleSeconds,
              eightHoursInSeconds,
            );

            let overtimeSeconds = 0;

            if (overtimeIn && overtimeOut) {
              // Use the recorded overtime interval from ScheduleDetail.
              overtimeSeconds = await this.calculateTimeDifference(
                overtimeIn,
                overtimeOut,
              );

              // Cap regular hours at 8 hours when recorded OT exists.
              regularSeconds = Math.min(
                totalEligibleSeconds,
                eightHoursInSeconds,
              );
            } else {
              // Fall back to automatically calculating overtime beyond 8 hours.
              regularSeconds = Math.min(
                totalEligibleSeconds,
                eightHoursInSeconds,
              );

              overtimeSeconds = Math.max(
                totalEligibleSeconds - eightHoursInSeconds,
                0,
              );
            }

            overtimeSeconds = Math.max(overtimeSeconds, 0);

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
              night_shift: night_shift,
              night_shift_hrs: night_shift_hrs,
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
              night_shift,
              night_shift_hrs,
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
            cron_computed: false,
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
        logger.info(
          "[PayrollComputation] No posted and computed post header found",
        );
      }

      const staffIds = [
        ...new Set(
          postedPayrollDetails
            .map((detail) => detail.staff_id)
            .filter((id) => id !== null && id !== undefined),
        ),
      ];

      const accessKeyIds = [
        ...new Set(
          postedPayrollDetails
            .map((detail) => detail.payrollHeader?.access_key_id)
            .filter((id) => id !== null && id !== undefined),
        ),
      ];

      /**
       * ============================================================
       * STAFF VENDOR SALARIES
       * ============================================================
       */
      const staffVendorSalaries = await this.staffVendorSalaryRepository.find({
        where: {
          staff_id: In(staffIds),
          access_key_id: In(accessKeyIds),
          status_id: STATUS_IDS.ACTIVE,
        },
      });

      const staffVendorMap = new Map<string, any>();

      for (const staffVendor of staffVendorSalaries) {
        staffVendorMap.set(
          `${staffVendor.staff_id}-${staffVendor.vendor_id}-${staffVendor.location_id}`,
          staffVendor,
        );
      }

      /**
       * ============================================================
       * STAFF SALARIES
       *
       * staff_salaries.staff_vendor_id
       *      -> staff_vendor_salaries.id
       * ============================================================
       */
      const staffVendorIds = [
        ...new Set(
          staffVendorSalaries
            .map((staffVendor) => staffVendor.id)
            .filter((id) => id !== null && id !== undefined),
        ),
      ];

      const staffSalaries = await this.staffSalaryRepository.find({
        where: {
          staff_vendor_id: In(staffVendorIds),
          status_id: STATUS_IDS.ACTIVE,
        },
      });

      const staffSalaryMap = new Map<number, any>();

      for (const staffSalary of staffSalaries) {
        staffSalaryMap.set(staffSalary.staff_vendor_id, staffSalary);
      }

      /**
       * ============================================================
       * SSS CONFIG
       * ============================================================
       */
      const sssConfigs = await this.sssConfigRepository.find();

      /**
       * ============================================================
       * TIME KEEPING CONFIG
       * ============================================================
       */
      const timeKeepingConfigs = await this.timeKeepingRepository.find({
        where: {
          access_key_id: In(accessKeyIds),
        },
      });

      const timeKeepingMap = new Map<number, any>();

      for (const timeKeeping of timeKeepingConfigs) {
        timeKeepingMap.set(timeKeeping.access_key_id, timeKeeping);
      }

      /**
       * ============================================================
       * COMPUTATION
       * ============================================================
       */
      const computedDetailsByHeader = new Map<number, PayrollDetails[]>();

      let computedCount = 0;

      for (const detail of postedPayrollDetails) {
        const payrollHeader = detail.payrollHeader;

        if (!payrollHeader) {
          continue;
        }

        const staffId = detail.staff_id;

        if (!staffId) {
          continue;
        }

        const accessKeyId = payrollHeader.access_key_id;

        /**
         * ----------------------------------------------------------
         * FIND STAFF VENDOR
         * ----------------------------------------------------------
         */
        const staffVendorKey = `${staffId}-${detail.vendor_id}-${detail.location_id}`;

        const staffVendor = staffVendorMap.get(staffVendorKey);

        if (!staffVendor) {
          logger.warn(
            `[PayrollComputation] No active staff vendor salary found for staff_id=${staffId}, vendor_id=${detail.vendor_id}, location_id=${detail.location_id}`,
          );

          continue;
        }

        /**
         * ----------------------------------------------------------
         * FIND STAFF SALARY
         *
         * StaffSalary.staff_vendor_id
         *          =
         * StaffVendorSalary.id
         * ----------------------------------------------------------
         */
        const staffSalary = staffSalaryMap.get(staffVendor.id);

        if (!staffSalary) {
          logger.warn(
            `[PayrollComputation] No active staff salary found for staff_vendor_id=${staffVendor.id}, staff_id=${staffId}`,
          );

          continue;
        }

        /**
         * ----------------------------------------------------------
         * SALARY RATE
         * ----------------------------------------------------------
         */
        const salaryRate = Number(staffSalary.salary_rate) || 0;

        if (!salaryRate) {
          continue;
        }

        /**
         * ----------------------------------------------------------
         * TIME KEEPING
         * ----------------------------------------------------------
         */
        const timeKeeping = timeKeepingMap.get(accessKeyId);

        /**
         * ----------------------------------------------------------
         * COMPUTE PAYROLL DETAIL
         * ----------------------------------------------------------
         */
        const computedValues =
          this.payrollComputationService.computePayrollDetail({
            detail,
            payrollHeader,
            salaryRate,
            staffSalary,
            sssConfigs,
            timeKeeping,
          });

        if (!computedValues) {
          continue;
        }

        Object.assign(detail, computedValues);

        payrollHeader.cron_computed = true;

        await this.payrollDetailRepository.save(detail);

        const headerId = detail.payroll_header_id;

        if (!computedDetailsByHeader.has(headerId)) {
          computedDetailsByHeader.set(headerId, []);
        }

        computedDetailsByHeader.get(headerId)!.push(detail);

        computedCount++;
      }

      /**
       * ============================================================
       * COMPUTE PAYROLL HEADER TOTALS
       * ============================================================
       */
      for (const [headerId, details] of computedDetailsByHeader) {
        const payrollHeader = postedPayrollDetails.find(
          (detail) => detail.payroll_header_id === headerId,
        )?.payrollHeader;

        if (!payrollHeader) {
          continue;
        }

        const headerTotals =
          this.payrollComputationService.computePayrollHeaderTotals(details);

        Object.assign(payrollHeader, headerTotals);

        await this.payrollHeaderRepository.save(payrollHeader);
      }

      return {
        success: true,
        message: "Payroll computation completed successfully.",
        total: computedCount,
      };
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to compute posted payroll details.",
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
            // Update Payroll Headers to POSTED
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

            // Get schedule detail IDs associated with the selected payroll headers
            const payrollDetails = await transactionalEntityManager.find(
              PayrollDetails,
              {
                where: {
                  payroll_header_id: In(payrollIds),
                },
                select: ["id", "schedule_detail_id"],
              },
            );

            const scheduleDetailIds = [
              ...new Set(
                payrollDetails
                  .map((detail) => detail.schedule_detail_id)
                  .filter(
                    (id): id is number => id !== undefined && id !== null,
                  ),
              ),
            ];

            // Update associated Schedule Details to COMPUTED
            if (scheduleDetailIds.length > 0) {
              await transactionalEntityManager.update(
                ScheduleDetail,
                {
                  id: In(scheduleDetailIds),
                },
                {
                  attendance_status_id: STATUS_IDS.COMPUTED,
                  updated_by: userId,
                },
              );
            }

            // Retrieve updated Payroll Headers
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

      const responses = updatedPayrollHeaders.map((payroll) =>
        this.responseMapperService.mapEntityToResponse(payroll),
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
                cron_computed: false,
                updated_by: userId,
                modified_at: new Date(),
              },
            );

            // Get schedule detail IDs from the selected payroll details
            const payrollDetails = await transactionalEntityManager.find(
              PayrollDetails,
              {
                where: {
                  payroll_header_id: In(payrollIds),
                },
                select: ["schedule_detail_id"],
              },
            );

            const scheduleDetailIds = [
              ...new Set(
                payrollDetails
                  .map((detail) => detail.schedule_detail_id)
                  .filter((id) => id != null),
              ),
            ];

            // Reset attendance status to VALIDATED for the related schedule details
            if (scheduleDetailIds.length > 0) {
              await transactionalEntityManager.update(
                ScheduleDetail,
                {
                  id: In(scheduleDetailIds),
                },
                {
                  attendance_status_id: STATUS_IDS.VALIDATED,
                  cron_computed: false,
                  updated_by: userId,
                  modified_at: new Date(),
                },
              );
            }

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
                cron_computed: false,
                updated_by: userId,
                modified_at: new Date(),
              },
            );

                        // Get schedule detail IDs from the selected payroll details
            const payrollDetails = await transactionalEntityManager.find(
              PayrollDetails,
              {
                where: {
                  payroll_header_id: In(payrollIds),
                },
                select: ["schedule_detail_id"],
              },
            );

            const scheduleDetailIds = [
              ...new Set(
                payrollDetails
                  .map((detail) => detail.schedule_detail_id)
                  .filter((id) => id != null),
              ),
            ];

            // Reset attendance status to VALIDATED for the related schedule details
            if (scheduleDetailIds.length > 0) {
              await transactionalEntityManager.update(
                ScheduleDetail,
                {
                  id: In(scheduleDetailIds),
                },
                {
                  attendance_status_id: STATUS_IDS.VALIDATED,
                  cron_computed: false,
                  updated_by: userId,
                  modified_at: new Date(),
                },
              );
            }

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

  public async calculateNightShift(
    startTime: Date | null | undefined,
    endTime: Date | null | undefined,
    scheduleDate: Date,
  ): Promise<{
    night_shift_hrs: string;
    night_shift: number;
  }> {
    if (!startTime || !endTime) {
      return {
        night_shift_hrs: "00:00:00",
        night_shift: 0,
      };
    }

    const start = dayjs(startTime);
    let end = dayjs(endTime);

    if (!start.isValid() || !end.isValid()) {
      return {
        night_shift_hrs: "00:00:00",
        night_shift: 0,
      };
    }

    if (!end.isAfter(start)) {
      end = end.add(1, "day");
    }

    const scheduleDay = dayjs(scheduleDate).startOf("day");

    // Night shift: 10:00 PM to 6:00 AM.
    const nightStartHour = 22;
    const nightEndHour = 6;

    let totalSeconds = 0;

    // Check night-shift windows across the dates covered by the duty.
    let currentDay = start.startOf("day").subtract(1, "day");
    const lastDay = end.startOf("day");

    while (currentDay.isBefore(lastDay) || currentDay.isSame(lastDay, "day")) {
      const windowStart = currentDay
        .hour(nightStartHour)
        .minute(0)
        .second(0)
        .millisecond(0);

      const windowEnd = currentDay
        .add(1, "day")
        .hour(nightEndHour)
        .minute(0)
        .second(0)
        .millisecond(0);

      // Only count night hours belonging to the schedule date's
      // night window and the following morning.
      const nextMorning = scheduleDay.add(1, "day");

      const isRelevantWindow =
        windowStart.isSame(scheduleDay, "day") ||
        windowStart.isSame(nextMorning, "day");

      if (isRelevantWindow) {
        const overlapStart = start.isAfter(windowStart) ? start : windowStart;

        const overlapEnd = end.isBefore(windowEnd) ? end : windowEnd;

        if (overlapEnd.isAfter(overlapStart)) {
          totalSeconds += overlapEnd.diff(overlapStart, "second");
        }
      }

      currentDay = currentDay.add(1, "day");
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      night_shift_hrs: [
        String(hours).padStart(2, "0"),
        String(minutes).padStart(2, "0"),
        String(seconds).padStart(2, "0"),
      ].join(":"),

      night_shift: Number((totalSeconds / 3600).toFixed(2)),
    };
  }

  async generatePayrollReport(
    accessKeyId?: number,
    dateFrom?: string,
    dateTo?: string,
    vendorIds?: number[],
    locationIds?: number[],
  ): Promise<any> {
    try {
      const query = this.payrollDetailRepository
        .createQueryBuilder("payrollDetail")
        .innerJoin("payrollDetail.payrollHeader", "payrollHeader")
        .leftJoin("payrollDetail.staff", "staff")
        .leftJoin("payrollDetail.vendor", "vendor")
        .leftJoin("payrollDetail.warehouse", "warehouse");

      query.select([
        "payrollDetail.id",
        "payrollDetail.payroll_header_id",
        "payrollDetail.schedule_detail_id",
        "payrollDetail.staff_id",
        "payrollDetail.staff_code",
        "payrollDetail.vendor_id",
        "payrollDetail.location_id",
        "payrollDetail.warehouse_id",
        "payrollDetail.warehouse_ifs",
        "payrollDetail.schedule_date",
        "payrollDetail.duty_start_time",
        "payrollDetail.duty_end_time",
        "payrollDetail.planned_duty_start_time",
        "payrollDetail.planned_duty_end_time",
        "payrollDetail.just_time_in",
        "payrollDetail.just_time_out",
        "payrollDetail.overtime_in",
        "payrollDetail.overtime_out",
        "payrollDetail.just_break_in",
        "payrollDetail.just_break_out",
        "payrollDetail.actual_time_in",
        "payrollDetail.actual_time_out",
        "payrollDetail.actual_break_in",
        "payrollDetail.actual_break_out",
        "payrollDetail.working_day_id",
        "payrollDetail.status_id",
        "payrollDetail.attendance_status_id",
        "payrollDetail.regular",
        "payrollDetail.overtime",
        "payrollDetail.twh",
        "payrollDetail.break",
        "payrollDetail.regular_hours",
        "payrollDetail.overtime_hours",
        "payrollDetail.twh_hours",
        "payrollDetail.break_hours",
        "payrollDetail.shift_type",
        "payrollDetail.night_shift_hrs",
        "payrollDetail.night_shift",
        "payrollDetail.night_shift_amount",
        "payrollDetail.regular_amount",
        "payrollDetail.regular_day_amount",
        "payrollDetail.rest_day_amount",
        "payrollDetail.special_holiday_amount",
        "payrollDetail.regular_holiday_amount",
        "payrollDetail.regular_holiday_off_amount",
        "payrollDetail.rd_regular_holiday_amount",
        "payrollDetail.rd_special_holiday_amount",
        "payrollDetail.overtime_amount",
        "payrollDetail.ot_regular_amount",
        "payrollDetail.ot_rest_day_amount",
        "payrollDetail.ot_special_holiday_amount",
        "payrollDetail.ot_regular_holiday_amount",
        "payrollDetail.ot_rd_regular_holiday_amount",
        "payrollDetail.ot_rd_special_holiday_amount",
        "payrollDetail.net_amt_diser",
        "payrollDetail.salary_rate",
        "payrollDetail.hour_rate",
        "payrollDetail.regular_day",
        "payrollDetail.special_holiday",
        "payrollDetail.regular_holiday",
        "payrollDetail.rest_day",
        "payrollDetail.total_day_work",
        "payrollDetail.ot_regular_day",
        "payrollDetail.ot_special_holiday",
        "payrollDetail.ot_regular_holiday",
        "payrollDetail.ot_rest_day",
        "payrollDetail.total_ot_day_work",
        "payrollDetail.gross_pay",
        "payrollDetail.thirteen_month_pay",
        "payrollDetail.sss_share",
        "payrollDetail.pag_ibig_share",
        "payrollDetail.phil_health_share",
        "payrollDetail.total_govt_share",
        "payrollDetail.total_payroll",
        "payrollDetail.asf",
        "payrollDetail.total_asf",
        "payrollDetail.allowance",
        "payrollDetail.total_allowance",
        "payrollDetail.vat",
        "payrollDetail.total_with_vat",
        "payrollDetail.tax",
        "payrollDetail.net_of_tax",
        "payrollDetail.cash_bond",
        "payrollDetail.total_billing",
        "payrollDetail.ec",
        "staff.id",
        "staff.first_name",
        "staff.last_name",
        "staff.staff_code",
        "staff.old_dws_code",
        "staff.contact_number",
        "vendor.id",
        "vendor.service_provider_name",
        "vendor.service_provider_code",
        "vendor.vendor_code",
        "warehouse.id",
        "warehouse.warehouse_name",
        "warehouse.warehouse_code",
        "warehouse.warehouse_ifs",
      ]);

      query.andWhere("payrollHeader.status_id = :postedStatus", {
        postedStatus: STATUS_IDS.POSTED,
      });

      if (accessKeyId) {
        query.andWhere("payrollHeader.access_key_id = :accessKeyId", {
          accessKeyId,
        });
      }

      if (dateFrom) {
        query.andWhere("DATE(payrollDetail.schedule_date) >= :dateFrom", {
          dateFrom,
        });
      }

      if (dateTo) {
        query.andWhere("DATE(payrollDetail.schedule_date) <= :dateTo", {
          dateTo,
        });
      }

      if (vendorIds?.length) {
        query.andWhere("payrollDetail.vendor_id IN (:...vendorIds)", {
          vendorIds,
        });
      }

      if (locationIds?.length) {
        query.andWhere("payrollDetail.location_id IN (:...locationIds)", {
          locationIds,
        });
      }

      query
        .orderBy("vendor.id", "ASC")
        .addOrderBy("payrollDetail.schedule_date", "ASC")
        .addOrderBy("warehouse.id", "ASC")
        .addOrderBy("staff.id", "ASC")
        .addOrderBy("payrollDetail.id", "ASC");

      const details = await query.getMany();

      const vendorMap = new Map<number, any>();
      const periodWarehouseMap = new Map<string, any>();

      const round2 = (value: number | string | null | undefined): number =>
        Number(Number(value ?? 0).toFixed(2));

      for (const detail of details) {
        const vendorId = detail.vendor?.id ?? detail.vendor_id;

        const scheduleDate = detail.schedule_date
          ? new Date(detail.schedule_date).toISOString().split("T")[0]
          : null;

        const warehouseId = detail.warehouse?.id ?? detail.warehouse_id;
        const staffId = detail.staff?.id ?? detail.staff_id;

        if (vendorId == null) {
          continue;
        }

        const actualHours = Number(detail.regular ?? 0);
        const overtimeHours = Number(detail.overtime ?? 0);
        const totalDays = Number(detail.total_day_work ?? 0);
        const workingDayId = Number(detail.working_day_id ?? 0);

        const periodStaffKey = `${vendorId}-${warehouseId ?? "no-warehouse"}-${staffId ?? `no-staff-${detail.id}`}`;

        if (!periodWarehouseMap.has(periodStaffKey)) {
          periodWarehouseMap.set(periodStaffKey, {
            vendor_id: vendorId,
            vendor_name: detail.vendor?.service_provider_name ?? null,
            vendor_code:
              detail.vendor?.vendor_code ||
              detail.vendor?.service_provider_code ||
              null,
            warehouse_id: warehouseId,
            warehouse_name: detail.warehouse?.warehouse_name ?? null,
            warehouse_code: detail.warehouse?.warehouse_code ?? null,
            warehouse_ifs: detail.warehouse?.warehouse_ifs ?? null,
            staff_id: staffId,
            staff_name: detail.staff
              ? `${detail.staff.first_name ?? ""} ${detail.staff.last_name ?? ""}`.trim()
              : null,
            staff_code: detail.staff_code ?? null,
            old_dws_code: detail.staff?.old_dws_code ?? null,
            contact_number: detail.staff?.contact_number ?? null,
            total_hours: 0,
            total_ot_hours: 0,
            total_number_of_days: 0,
            total_special_holiday_hours: 0,
            total_regular_holiday_hours: 0,
            total_lates: 0,
          });
        }

        const periodStaff = periodWarehouseMap.get(periodStaffKey);

        periodStaff.total_hours += actualHours;
        periodStaff.total_ot_hours += overtimeHours;
        periodStaff.total_number_of_days += totalDays;

        if (
          (
            [
              WORKING_DAY_IDS.SPECIAL_HOLIDAY,
              WORKING_DAY_IDS.REST_DAY_SPECIAL_HOLIDAY,
            ] as number[]
          ).includes(workingDayId)
        ) {
          periodStaff.total_special_holiday_hours += actualHours;
        }

        if (
          (
            [
              WORKING_DAY_IDS.REGULAR_HOLIDAY,
              WORKING_DAY_IDS.REST_DAY_REGULAR_HOLIDAY,
            ] as number[]
          ).includes(workingDayId)
        ) {
          periodStaff.total_regular_holiday_hours += actualHours;
        }

        if (!vendorMap.has(vendorId)) {
          vendorMap.set(vendorId, {
            vendor_id: vendorId,
            vendor_name: detail.vendor?.service_provider_name ?? null,
            vendor_code:
              detail.vendor?.vendor_code ||
              detail.vendor?.service_provider_code ||
              null,
            dates: [],
            _dateMap: new Map(),
          });
        }

        const vendorGroup = vendorMap.get(vendorId);

        if (!vendorGroup._dateMap.has(scheduleDate)) {
          vendorGroup._dateMap.set(scheduleDate, {
            schedule_date: scheduleDate,
            schedule_day: scheduleDate
              ? new Date(`${scheduleDate}T12:00:00`).toLocaleDateString(
                  "en-GB",
                  {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  },
                )
              : null,
            warehouses: [],
            _warehouseMap: new Map(),
          });
        }

        const dateGroup = vendorGroup._dateMap.get(scheduleDate);
        const warehouseKey = warehouseId ?? `no-warehouse-${scheduleDate}`;

        if (!dateGroup._warehouseMap.has(warehouseKey)) {
          dateGroup._warehouseMap.set(warehouseKey, {
            warehouse_id: warehouseId,
            warehouse_name: detail.warehouse?.warehouse_name ?? null,
            warehouse_code: detail.warehouse?.warehouse_code ?? null,
            warehouse_ifs: detail.warehouse?.warehouse_ifs ?? null,
            total_actual_hours: 0,
            total_hours: 0,
            total_number_of_days: 0,
            total_ot_hours: 0,
            total_special_holiday_hours: 0,
            total_regular_holiday_hours: 0,
            total_lates: 0,
            total_staff_count: 0,
            budget_hours: 0,
            staff: [],
            _staffMap: new Map(),
          });
        }

        const warehouseGroup = dateGroup._warehouseMap.get(warehouseKey);
        const staffKey = staffId ?? `no-staff-${detail.id}`;

        if (!warehouseGroup._staffMap.has(staffKey)) {
          warehouseGroup._staffMap.set(staffKey, {
            staff_id: staffId,
            staff_name: detail.staff
              ? `${detail.staff.first_name ?? ""} ${detail.staff.last_name ?? ""}`.trim()
              : null,
            staff_code: detail.staff_code ?? null,
            old_dws_code: detail.staff?.old_dws_code ?? null,
            contact_number: detail.staff?.contact_number ?? null,
            details: [],
          });

          warehouseGroup.total_staff_count += 1;
        }

        const staffGroup = warehouseGroup._staffMap.get(staffKey);
        const budgethours = 24; // HARD-CODED BUDGET HOURS FOR NOW - For Sir Alj

        warehouseGroup.total_actual_hours += actualHours;
        warehouseGroup.total_hours += actualHours;
        warehouseGroup.total_number_of_days += totalDays;
        warehouseGroup.total_ot_hours += overtimeHours;

        if (
          (
            [
              WORKING_DAY_IDS.SPECIAL_HOLIDAY,
              WORKING_DAY_IDS.REST_DAY_SPECIAL_HOLIDAY,
            ] as number[]
          ).includes(workingDayId)
        ) {
          warehouseGroup.total_special_holiday_hours += actualHours;
        }

        if (
          (
            [
              WORKING_DAY_IDS.REGULAR_HOLIDAY,
              WORKING_DAY_IDS.REST_DAY_REGULAR_HOLIDAY,
            ] as number[]
          ).includes(workingDayId)
        ) {
          warehouseGroup.total_regular_holiday_hours += actualHours;
        }

        warehouseGroup.budget_hours = budgethours;

        staffGroup.details.push({
          id: detail.id,
          payroll_header_id: detail.payroll_header_id,
          schedule_detail_id: detail.schedule_detail_id,
          schedule_date: detail.schedule_date,

          duty_start_time: detail.duty_start_time,
          duty_end_time: detail.duty_end_time,
          planned_duty_start_time: detail.planned_duty_start_time,
          planned_duty_end_time: detail.planned_duty_end_time,

          just_time_in: detail.just_time_in,
          just_time_out: detail.just_time_out,
          overtime_in: detail.overtime_in,
          overtime_out: detail.overtime_out,
          just_break_in: detail.just_break_in,
          just_break_out: detail.just_break_out,

          actual_time_in: detail.actual_time_in,
          actual_time_out: detail.actual_time_out,
          actual_break_in: detail.actual_break_in,
          actual_break_out: detail.actual_break_out,

          working_day_id: detail.working_day_id,
          status_id: detail.status_id,
          attendance_status_id: detail.attendance_status_id,

          regular: round2(detail.regular),
          overtime: round2(detail.overtime),
          twh: round2(detail.twh),
          break: round2(detail.break),

          regular_hours: round2(detail.regular_hours),
          overtime_hours: round2(detail.overtime_hours),
          twh_hours: round2(detail.twh_hours),
          break_hours: round2(detail.break_hours),

          shift_type: detail.shift_type,
          night_shift_hrs: round2(detail.night_shift_hrs),
          night_shift: detail.night_shift,
          night_shift_amount: round2(detail.night_shift_amount),

          regular_amount: round2(detail.regular_amount),
          regular_day_amount: round2(detail.regular_day_amount),
          rest_day_amount: round2(detail.rest_day_amount),
          special_holiday_amount: round2(detail.special_holiday_amount),
          regular_holiday_amount: round2(detail.regular_holiday_amount),
          regular_holiday_off_amount: round2(detail.regular_holiday_off_amount),
          rd_regular_holiday_amount: round2(detail.rd_regular_holiday_amount),
          rd_special_holiday_amount: round2(detail.rd_special_holiday_amount),
          net_amt_diser: round2(detail.net_amt_diser),

          overtime_amount: round2(detail.overtime_amount),
          ot_regular_amount: round2(detail.ot_regular_amount),
          ot_rest_day_amount: round2(detail.ot_rest_day_amount),
          ot_special_holiday_amount: round2(detail.ot_special_holiday_amount),
          ot_regular_holiday_amount: round2(detail.ot_regular_holiday_amount),
          ot_rd_regular_holiday_amount: round2(
            detail.ot_rd_regular_holiday_amount,
          ),
          ot_rd_special_holiday_amount: round2(
            detail.ot_rd_special_holiday_amount,
          ),

          salary_rate: round2(detail.salary_rate),
          hour_rate: round2(detail.hour_rate),

          regular_day: round2(detail.regular_day),
          special_holiday: round2(detail.special_holiday),
          regular_holiday: round2(detail.regular_holiday),
          rest_day: round2(detail.rest_day),
          total_day_work: round2(detail.total_day_work),

          ot_regular_day: round2(detail.ot_regular_day),
          ot_special_holiday: round2(detail.ot_special_holiday),
          ot_regular_holiday: round2(detail.ot_regular_holiday),
          ot_rest_day: round2(detail.ot_rest_day),
          total_ot_day_work: round2(detail.total_ot_day_work),

          gross_pay: round2(detail.gross_pay),
          thirteen_month_pay: round2(detail.thirteen_month_pay),
          sss_share: round2(detail.sss_share),
          pag_ibig_share: round2(detail.pag_ibig_share),
          phil_health_share: round2(detail.phil_health_share),
          total_govt_share: round2(detail.total_govt_share),
          total_payroll: round2(detail.total_payroll),

          ec_er: round2(detail.ec),

          asf: round2(detail.asf),
          total_asf: round2(detail.total_asf),
          allowance: round2(detail.allowance),
          total_allowance: round2(detail.total_allowance),
          vat: round2(detail.vat),
          total_with_vat: round2(detail.total_with_vat),
          tax: round2(detail.tax),
          net_of_tax: round2(detail.net_of_tax),
          cash_bond: round2(detail.cash_bond),
          total_billing: round2(detail.total_billing),
        });
      }

      for (const periodStaff of periodWarehouseMap.values()) {
        periodStaff.total_hours = round2(periodStaff.total_hours);
        periodStaff.total_ot_hours = round2(periodStaff.total_ot_hours);
        periodStaff.total_number_of_days = round2(
          periodStaff.total_number_of_days,
        );
        periodStaff.total_special_holiday_hours = round2(
          periodStaff.total_special_holiday_hours,
        );
        periodStaff.total_regular_holiday_hours = round2(
          periodStaff.total_regular_holiday_hours,
        );
        periodStaff.total_lates = round2(
          Math.max(
            0,
            8 * periodStaff.total_number_of_days - periodStaff.total_hours,
          ),
        );
      }

      const periodTotals = Array.from(periodWarehouseMap.values());

      const vendors = Array.from(vendorMap.values()).map((vendorGroup) => {
        const dates = Array.from(vendorGroup._dateMap.values()).map(
          (dateGroup: any) => {
            const warehouses = Array.from(dateGroup._warehouseMap.values()).map(
              (warehouseGroup: any) => {
                warehouseGroup.staff = Array.from(
                  warehouseGroup._staffMap.values(),
                );

                warehouseGroup.total_actual_hours = round2(
                  warehouseGroup.total_actual_hours,
                );
                warehouseGroup.total_hours = round2(warehouseGroup.total_hours);
                warehouseGroup.total_number_of_days = round2(
                  warehouseGroup.total_number_of_days,
                );
                warehouseGroup.total_ot_hours = round2(
                  warehouseGroup.total_ot_hours,
                );
                warehouseGroup.total_special_holiday_hours = round2(
                  warehouseGroup.total_special_holiday_hours,
                );
                warehouseGroup.total_regular_holiday_hours = round2(
                  warehouseGroup.total_regular_holiday_hours,
                );
                warehouseGroup.total_lates = round2(
                  Math.max(
                    0,
                    8 * warehouseGroup.total_number_of_days -
                      warehouseGroup.total_hours,
                  ),
                );
                warehouseGroup.budget_hours = round2(
                  warehouseGroup.budget_hours,
                );

                delete warehouseGroup._staffMap;

                return warehouseGroup;
              },
            );

            dateGroup.warehouses = warehouses;
            delete dateGroup._warehouseMap;

            return dateGroup;
          },
        );

        vendorGroup.dates = dates;
        delete vendorGroup._dateMap;

        return vendorGroup;
      });

      return {
        date_from: dateFrom ?? null,
        date_to: dateTo ?? null,
        vendors,
        period_totals: periodTotals,
        total_details: details.length,
      };
    } catch (error) {
      throw error;
    }
  }

  // Inside StaffPayrollService:

  async exportPayrollReportToExcel(
    accessKeyId?: number,
    dateFrom?: string,
    dateTo?: string,
    vendorIds?: number[],
    locationIds?: number[],
  ): Promise<ExcelJS.Workbook> {
    const reportData = await this.generatePayrollReport(
      accessKeyId,
      dateFrom,
      dateTo,
      vendorIds,
      locationIds,
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SWP Payroll System";
    workbook.created = new Date();

    const vendors = reportData?.vendors || [];
    if (vendors.length === 0) {
      const ws = workbook.addWorksheet("No Data");
      ws.addRow(["No payroll data found for the selected criteria."]);
      return workbook;
    }

    // 1. Collect and sort all distinct dates across vendors
    const dateMap = new Map<string, string>();
    vendors.forEach((v: any) => {
      v.dates?.forEach((d: any) => {
        if (d.schedule_date) {
          dateMap.set(
            d.schedule_date,
            d.schedule_day ||
              dayjs(d.schedule_date).format("dddd").toUpperCase(),
          );
        }
      });
    });

    const allDateKeys = Array.from(dateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, day]) => ({ date, day }));

    // 2. Iterate each vendor and build a sheet per warehouse
    vendors.forEach((vendor: any) => {
      const warehouseMap = new Map<number, any>();

      vendor.dates?.forEach((d: any) => {
        d.warehouses?.forEach((wh: any) => {
          if (!warehouseMap.has(wh.warehouse_id)) {
            warehouseMap.set(wh.warehouse_id, {
              warehouse_id: wh.warehouse_id,
              warehouse_name: wh.warehouse_name,
              warehouse_code: wh.warehouse_code,
              warehouse_ifs: wh.warehouse_ifs,
              staff: [],
              dailySummaries: new Map<string, any>(),
            });
          }
          const targetWh = warehouseMap.get(wh.warehouse_id);

          if (!targetWh.dailySummaries.has(d.schedule_date)) {
            targetWh.dailySummaries.set(d.schedule_date, {
              total_actual_hours: wh.total_actual_hours ?? d.total_actual_hours,
              total_staff_count: wh.total_staff_count ?? d.total_staff_count,
              total_budget_hours: wh.total_budget_hours ?? d.total_budget_hours,
            });
          }

          wh.staff?.forEach((st: any) => {
            let existingStaff = targetWh.staff.find(
              (s: any) => s.staff_id === st.staff_id,
            );
            if (!existingStaff) {
              existingStaff = {
                staff_id: st.staff_id,
                staff_name: st.staff_name,
                staff_code: st.staff_code,
                old_dws_code: st.old_dws_code,
                contact_number: st.contact_number,
                details: [],
              };
              targetWh.staff.push(existingStaff);
            }
            if (st.details) {
              existingStaff.details.push(...st.details);
            }
          });
        });
      });

      // 3. Render worksheets
      warehouseMap.forEach((warehouse: any) => {
        const cleanSheetName = (
          warehouse.warehouse_code || `Store_${warehouse.warehouse_id}`
        )
          .substring(0, 31)
          .replace(/[\\/?*[\]]/g, "");

        const ws = workbook.addWorksheet(cleanSheetName, {
          views: [{ showGridLines: true }],
        });

        const staffList: any[] = warehouse.staff || [];
        const numStaffCols = Math.max(staffList.length, 4);
        const totalCols = 2 + numStaffCols + 3;
        const cTotHours = 2 + numStaffCols; // 0-based col index + 1 for ExcelJS (1-based: cTotHours + 1)
        const cBudget = cTotHours + 1;
        const cTotStaff = cBudget + 1;

        // Helper function to set styled cells
        const setCell = (
          r: number,
          c: number,
          value: any,
          font?: Partial<ExcelJS.Font>,
          alignment?: Partial<ExcelJS.Alignment>,
          fill?: ExcelJS.FillPattern,
          border: boolean = true,
        ) => {
          const cell = ws.getCell(r, c);
          cell.value = value;
          if (font) cell.font = font;
          if (alignment) cell.alignment = alignment;
          if (fill) cell.fill = fill;
          if (border) cell.border = borderThin;
        };

        // --- ROW 1: TITLE ---
        ws.mergeCells(1, 5, 1, 7);
        setCell(
          1,
          5,
          "SWP PAYROLL REPORT",
          { name: "Arial", size: 14, bold: true },
          { horizontal: "center", vertical: "middle" },
          undefined,
          false,
        );

        // --- ROWS 3-5: METADATA 1 ---
        const fromStr = `FROM : ${dayjs(dateFrom).format("MMMM DD, YYYY").toUpperCase()}`;
        const toStr = `TO: ${dayjs(dateTo).format("MMMM DD, YYYY").toUpperCase()}`;

        setCell(
          3,
          1,
          "PERIOD COVERED:",
          { name: "Arial", size: 9, bold: true },
          { vertical: "middle" },
          undefined,
          false,
        );
        setCell(
          3,
          2,
          fromStr,
          { name: "Arial", size: 9, bold: true },
          { vertical: "middle" },
          undefined,
          false,
        );
        setCell(
          3,
          3,
          toStr,
          { name: "Arial", size: 9, bold: true },
          { vertical: "middle" },
          undefined,
          false,
        );

        setCell(
          4,
          1,
          "AGENCY & CODE:",
          { name: "Arial", size: 9, bold: true },
          { vertical: "middle" },
          undefined,
          false,
        );
        setCell(
          4,
          2,
          String(vendor.vendor_code || ""),
          { name: "Arial", size: 9, bold: true },
          { vertical: "middle" },
          undefined,
          false,
        );
        setCell(
          4,
          3,
          String(vendor.vendor_name || ""),
          { name: "Arial", size: 9, bold: true },
          { vertical: "middle" },
          undefined,
          false,
        );

        setCell(
          5,
          1,
          "SHIP TO & CODE:",
          { name: "Arial", size: 9, bold: true },
          { vertical: "middle" },
          undefined,
          false,
        );
        setCell(
          5,
          2,
          String(warehouse.warehouse_code || ""),
          { name: "Arial", size: 9, bold: true },
          { vertical: "middle" },
          undefined,
          false,
        );
        setCell(
          5,
          3,
          String(warehouse.warehouse_name || ""),
          { name: "Arial", size: 9, bold: true },
          { vertical: "middle" },
          undefined,
          false,
        );

        // --- ROWS 7-9: TABLE 1 HEADERS ---
        const rH1 = 7;
        const rH2 = 8;
        const rH3 = 9;

        setCell(
          rH1,
          2,
          "EMPLOYEE NAME:",
          { name: "Arial", size: 8.5, bold: true },
          { horizontal: "center", vertical: "middle", wrapText: true },
          S_CYAN_FILL,
        );
        setCell(
          rH2,
          2,
          "ID NO:",
          { name: "Arial", size: 8.5, bold: true },
          { horizontal: "center", vertical: "middle", wrapText: true },
          S_CYAN_FILL,
        );
        setCell(
          rH3,
          2,
          "DWS NO:",
          { name: "Arial", size: 8.5, bold: true },
          { horizontal: "center", vertical: "middle", wrapText: true },
          S_CYAN_FILL,
        );

        setCell(rH1, 1, "", undefined, undefined, S_CYAN_FILL);
        setCell(rH2, 1, "", undefined, undefined, S_CYAN_FILL);
        setCell(rH3, 1, "", undefined, undefined, S_CYAN_FILL);

        for (let i = 0; i < numStaffCols; i++) {
          const col = 3 + i;
          const st = staffList[i];
          setCell(
            rH1,
            col,
            st ? st.staff_name : `DISER ${i + 1}`,
            { name: "Arial", size: 8.5, bold: true },
            { horizontal: "center", vertical: "middle", wrapText: true },
            S_CYAN_FILL,
          );
          setCell(
            rH2,
            col,
            st ? st.old_dws_code : "",
            { name: "Arial", size: 8.5, bold: true },
            { horizontal: "center", vertical: "middle", wrapText: true },
            S_CYAN_FILL,
          );
          setCell(
            rH3,
            col,
            st ? st.contact_number || "--" : "",
            { name: "Arial", size: 8.5, bold: true },
            { horizontal: "center", vertical: "middle", wrapText: true },
            S_CYAN_FILL,
          );
        }

        setCell(
          rH1,
          cTotHours + 1,
          "TOTAL ACTUAL STAFFING",
          { name: "Arial", size: 8.5, bold: true },
          { horizontal: "center", vertical: "middle", wrapText: true },
          S_CYAN_FILL,
        );
        setCell(
          rH2,
          cTotHours + 1,
          "HOURS",
          { name: "Arial", size: 8.5, bold: true },
          { horizontal: "center", vertical: "middle", wrapText: true },
          S_CYAN_FILL,
        );
        setCell(rH3, cTotHours + 1, "", undefined, undefined, S_CYAN_FILL);
        ws.mergeCells(rH1, cTotHours + 1, rH2, cTotHours + 1);

        setCell(
          rH1,
          cBudget + 1,
          "BUDGET TOTAL STAFFING",
          { name: "Arial", size: 8.5, bold: true },
          { horizontal: "center", vertical: "middle", wrapText: true },
          S_CYAN_FILL,
        );
        setCell(
          rH2,
          cBudget + 1,
          "HOURS",
          { name: "Arial", size: 8.5, bold: true },
          { horizontal: "center", vertical: "middle", wrapText: true },
          S_CYAN_FILL,
        );
        setCell(rH3, cBudget + 1, "", undefined, undefined, S_CYAN_FILL);
        ws.mergeCells(rH1, cBudget + 1, rH2, cBudget + 1);

        setCell(
          rH1,
          cTotStaff + 1,
          "TOTAL",
          { name: "Arial", size: 8.5, bold: true },
          { horizontal: "center", vertical: "middle", wrapText: true },
          S_CYAN_FILL,
        );
        setCell(rH2, cTotStaff + 1, "", undefined, undefined, S_CYAN_FILL);
        setCell(rH3, cTotStaff + 1, "", undefined, undefined, S_CYAN_FILL);
        ws.mergeCells(rH1, cTotStaff + 1, rH3, cTotStaff + 1);

        // --- TABLE 1: SCHEDULE ROWS ---
        let curRow = 10;
        allDateKeys.forEach((dKey, dIdx) => {
          setCell(
            curRow,
            1,
            dIdx + 1,
            { name: "Arial", size: 8 },
            { horizontal: "center", vertical: "middle" },
          );
          setCell(
            curRow,
            2,
            dKey.day,
            { name: "Arial", size: 8 },
            { horizontal: "left", vertical: "middle" },
          );

          for (let i = 0; i < numStaffCols; i++) {
            const col = 3 + i;
            const st = staffList[i];
            const det = st?.details?.find(
              (item: any) => item.schedule_date === dKey.date,
            );

            if (det && det.duty_start_time && det.duty_end_time) {
              const tIn = dayjs(det.duty_start_time).format("h:mm A");
              const tOut = dayjs(det.duty_end_time).format("h:mm A");
              setCell(
                curRow,
                col,
                `${tIn}\n${tOut}`,
                { name: "Arial", size: 8 },
                { horizontal: "center", vertical: "middle", wrapText: true },
              );
            } else {
              setCell(
                curRow,
                col,
                "OFF",
                {
                  name: "Arial",
                  size: 8,
                  bold: true,
                  color: { argb: "FFFFFFFF" },
                },
                { horizontal: "center", vertical: "middle" },
                S_OFF_FILL,
              );
            }
          }

          const dateSummary = warehouse.dailySummaries?.get(dKey.date);
          const actualHours =
            dateSummary?.total_actual_hours !== undefined
              ? fmtHours(dateSummary.total_actual_hours)
              : "-";
          const staffCount =
            dateSummary?.total_staff_count !== undefined
              ? dateSummary.total_staff_count
              : 0;
          const budgetHours =
            dateSummary?.total_budget_hours !== undefined
              ? dateSummary.total_budget_hours
              : 0;

          setCell(
            curRow,
            cTotHours + 1,
            actualHours,
            { name: "Arial", size: 8 },
            { horizontal: "right", vertical: "middle" },
          );
          setCell(
            curRow,
            cBudget + 1,
            budgetHours,
            { name: "Arial", size: 8 },
            { horizontal: "right", vertical: "middle" },
          );
          setCell(
            curRow,
            cTotStaff + 1,
            staffCount,
            { name: "Arial", size: 8 },
            { horizontal: "center", vertical: "middle" },
          );

          curRow++;
        });

        // 3 Blank bordered rows
        for (let k = 0; k < 3; k++) {
          for (let c = 1; c <= totalCols; c++) {
            setCell(curRow, c, "", undefined, undefined, undefined, true);
          }
          curRow++;
        }
        curRow += 2; // Spacing

        // --- SECTION 2: METADATA 2 ---
        setCell(
          curRow,
          1,
          "PERIOD COVERED:",
          { name: "Arial", size: 9, bold: true },
          { vertical: "middle" },
          undefined,
          false,
        );
        setCell(
          curRow,
          2,
          fromStr,
          { name: "Arial", size: 9, bold: true },
          { vertical: "middle" },
          undefined,
          false,
        );
        setCell(
          curRow,
          3,
          toStr,
          { name: "Arial", size: 9, bold: true },
          { vertical: "middle" },
          undefined,
          false,
        );
        curRow++;

        setCell(
          curRow,
          1,
          "AGENCY & CODE:",
          { name: "Arial", size: 9, bold: true },
          { vertical: "middle" },
          undefined,
          false,
        );
        setCell(
          curRow,
          2,
          String(vendor.vendor_code || ""),
          { name: "Arial", size: 9, bold: true },
          { vertical: "middle" },
          undefined,
          false,
        );
        setCell(
          curRow,
          3,
          String(vendor.vendor_name || ""),
          { name: "Arial", size: 9, bold: true },
          { vertical: "middle" },
          undefined,
          false,
        );
        curRow++;

        setCell(
          curRow,
          1,
          "SHIP TO & CODE:",
          { name: "Arial", size: 9, bold: true },
          { vertical: "middle" },
          undefined,
          false,
        );
        setCell(
          curRow,
          2,
          String(warehouse.warehouse_code || ""),
          { name: "Arial", size: 9, bold: true },
          { vertical: "middle" },
          undefined,
          false,
        );
        setCell(
          curRow,
          3,
          String(warehouse.warehouse_name || ""),
          { name: "Arial", size: 9, bold: true },
          { vertical: "middle" },
          undefined,
          false,
        );
        curRow += 2;

        // --- TABLE 2: WORKING HOURS HEADERS ---
        const rT2_1 = curRow;
        const rT2_2 = curRow + 1;
        const rT2_3 = curRow + 2;

        setCell(
          rT2_1,
          1,
          "DISER NAME:",
          { name: "Arial", size: 8.5, bold: true },
          { horizontal: "center", vertical: "middle" },
          S_CYAN_FILL,
        );
        setCell(rT2_1, 2, "", undefined, undefined, S_CYAN_FILL);
        ws.mergeCells(rT2_1, 1, rT2_1, 2);

        setCell(
          rT2_2,
          1,
          "ID NO:",
          { name: "Arial", size: 8.5, bold: true },
          { horizontal: "center", vertical: "middle" },
          S_CYAN_FILL,
        );
        setCell(rT2_2, 2, "", undefined, undefined, S_CYAN_FILL);
        ws.mergeCells(rT2_2, 1, rT2_2, 2);

        setCell(
          rT2_3,
          1,
          "DWS NO:",
          { name: "Arial", size: 8.5, bold: true },
          { horizontal: "center", vertical: "middle" },
          S_CYAN_FILL,
        );
        setCell(rT2_3, 2, "", undefined, undefined, S_CYAN_FILL);
        ws.mergeCells(rT2_3, 1, rT2_3, 2);

        for (let i = 0; i < numStaffCols; i++) {
          const col = 3 + i;
          const st = staffList[i];
          setCell(
            rT2_1,
            col,
            st ? st.staff_name : `DISER ${i + 1}`,
            { name: "Arial", size: 8.5, bold: true },
            { horizontal: "center", vertical: "middle", wrapText: true },
            S_CYAN_FILL,
          );
          setCell(
            rT2_2,
            col,
            st ? st.old_dws_code : "",
            { name: "Arial", size: 8.5, bold: true },
            { horizontal: "center", vertical: "middle", wrapText: true },
            S_CYAN_FILL,
          );
          setCell(
            rT2_3,
            col,
            st ? st.contact_number || "--" : "",
            { name: "Arial", size: 8.5, bold: true },
            { horizontal: "center", vertical: "middle", wrapText: true },
            S_CYAN_FILL,
          );
        }

        setCell(
          rT2_1,
          cTotHours + 1,
          "TOTAL ACTUAL STAFFING",
          { name: "Arial", size: 8.5, bold: true },
          { horizontal: "center", vertical: "middle", wrapText: true },
          S_CYAN_FILL,
        );
        setCell(
          rT2_2,
          cTotHours + 1,
          "HOURS",
          { name: "Arial", size: 8.5, bold: true },
          { horizontal: "center", vertical: "middle", wrapText: true },
          S_CYAN_FILL,
        );
        setCell(rT2_3, cTotHours + 1, "", undefined, undefined, S_CYAN_FILL);
        ws.mergeCells(rT2_1, cTotHours + 1, rT2_3, cTotHours + 1);

        curRow += 3;

        // Table 2 Days
        allDateKeys.forEach((dKey, dIdx) => {
          setCell(
            curRow,
            1,
            dIdx + 1,
            { name: "Arial", size: 8 },
            { horizontal: "center", vertical: "middle" },
          );
          setCell(
            curRow,
            2,
            dKey.day,
            { name: "Arial", size: 8 },
            { horizontal: "left", vertical: "middle" },
          );

          let dayTot = 0;
          for (let i = 0; i < numStaffCols; i++) {
            const col = 3 + i;
            const st = staffList[i];
            const det = st?.details?.find(
              (item: any) => item.schedule_date === dKey.date,
            );
            const hrs = parseNum(det?.regular);

            if (hrs > 0) {
              setCell(
                curRow,
                col,
                hrs.toFixed(2),
                { name: "Arial", size: 8 },
                { horizontal: "center", vertical: "middle" },
              );
              dayTot += hrs;
            } else {
              setCell(
                curRow,
                col,
                "OFF",
                {
                  name: "Arial",
                  size: 8,
                  bold: true,
                  color: { argb: "FFFFFFFF" },
                },
                { horizontal: "center", vertical: "middle" },
                S_OFF_FILL,
              );
            }
          }

          setCell(
            curRow,
            cTotHours + 1,
            fmtHours(dayTot),
            { name: "Arial", size: 8 },
            { horizontal: "right", vertical: "middle" },
          );
          curRow++;
        });

        // 3 Blank rows
        for (let k = 0; k < 3; k++) {
          for (let c = 1; c <= cTotHours + 1; c++) {
            setCell(curRow, c, "", undefined, undefined, undefined, true);
          }
          curRow++;
        }
        curRow++;

        // Table 2 Summaries
        const summaryRows = [
          { label: "TOTAL HOURS", field: "regular", fmt: fmtHours },
          {
            label: "NUMBER OF DAYS",
            field: "total_day_work",
            fmt: (val: any) =>
              parseNum(val) === 0 ? "" : String(Math.round(parseNum(val))),
          },
          {
            label: "TOTAL OT HOURS",
            field: "overtime",
            fmt: fmtHours,
            green: true,
          },
          {
            label: "TOTAL SPH HOURS",
            field: "special_holiday",
            fmt: fmtHours,
            green: true,
          },
          {
            label: "TOTAL RH HOURS",
            field: "regular_holiday",
            fmt: fmtHours,
            green: true,
          },
          { label: "TOTAL LATES", field: "break", fmt: fmtHours },
        ];

        summaryRows.forEach((s) => {
          setCell(
            curRow,
            1,
            s.label,
            { name: "Arial", size: 8.5, bold: true },
            { horizontal: "center", vertical: "middle" },
            s.green ? S_GREEN_FILL : undefined,
          );
          setCell(
            curRow,
            2,
            "",
            undefined,
            undefined,
            s.green ? S_GREEN_FILL : undefined,
          );
          ws.mergeCells(curRow, 1, curRow, 2);

          let rowSum = 0;
          for (let i = 0; i < numStaffCols; i++) {
            const col = 3 + i;
            const st = staffList[i];
            const sum =
              st?.details?.reduce(
                (acc: number, item: any) => acc + parseNum(item[s.field]),
                0,
              ) || 0;
            const formattedVal =
              sum > 0
                ? s.field === "total_day_work"
                  ? String(Math.round(sum))
                  : sum.toFixed(2)
                : "";
            setCell(
              curRow,
              col,
              formattedVal,
              { name: "Arial", size: 8 },
              { horizontal: "right", vertical: "middle" },
            );
            rowSum += sum;
          }

          setCell(
            curRow,
            cTotHours + 1,
            s.fmt(rowSum),
            { name: "Arial", size: 8, bold: true },
            { horizontal: "right", vertical: "middle" },
          );
          curRow++;
        });
        curRow++;

        // --- TABLE 3: RATES & BILLING CALCULATION ---
        const rT3_1 = curRow;
        const rT3_2 = curRow + 1;
        const rT3_3 = curRow + 2;

        setCell(
          rT3_1,
          1,
          "DISER NAME:",
          { name: "Arial", size: 8.5, bold: true },
          { horizontal: "center", vertical: "middle" },
          S_CYAN_FILL,
        );
        setCell(rT3_1, 2, "", undefined, undefined, S_CYAN_FILL);
        ws.mergeCells(rT3_1, 1, rT3_1, 2);

        setCell(
          rT3_2,
          1,
          "ID NO:",
          { name: "Arial", size: 8.5, bold: true },
          { horizontal: "center", vertical: "middle" },
          S_CYAN_FILL,
        );
        setCell(rT3_2, 2, "", undefined, undefined, S_CYAN_FILL);
        ws.mergeCells(rT3_2, 1, rT3_2, 2);

        setCell(
          rT3_3,
          1,
          "DWS NO:",
          { name: "Arial", size: 8.5, bold: true },
          { horizontal: "center", vertical: "middle" },
          S_CYAN_FILL,
        );
        setCell(rT3_3, 2, "", undefined, undefined, S_CYAN_FILL);
        ws.mergeCells(rT3_3, 1, rT3_3, 2);

        for (let i = 0; i < numStaffCols; i++) {
          const col = 3 + i;
          const st = staffList[i];
          setCell(
            rT3_1,
            col,
            st ? st.staff_name : `DISER ${i + 1}`,
            { name: "Arial", size: 8.5, bold: true },
            { horizontal: "center", vertical: "middle", wrapText: true },
            S_CYAN_FILL,
          );
          setCell(
            rT3_2,
            col,
            st ? st.old_dws_code : "",
            { name: "Arial", size: 8.5, bold: true },
            { horizontal: "center", vertical: "middle", wrapText: true },
            S_CYAN_FILL,
          );
          setCell(
            rT3_3,
            col,
            st ? st.contact_number || "--" : "",
            { name: "Arial", size: 8.5, bold: true },
            { horizontal: "center", vertical: "middle", wrapText: true },
            S_CYAN_FILL,
          );
        }

        setCell(
          rT3_1,
          cTotHours + 1,
          "TOTAL",
          { name: "Arial", size: 8.5, bold: true },
          { horizontal: "center", vertical: "middle" },
          S_CYAN_FILL,
        );
        setCell(rT3_2, cTotHours + 1, "", undefined, undefined, S_CYAN_FILL);
        setCell(rT3_3, cTotHours + 1, "", undefined, undefined, S_CYAN_FILL);
        ws.mergeCells(rT3_1, cTotHours + 1, rT3_3, cTotHours + 1);

        curRow += 3;

        // Rate Rows
        const staffSalaryRates: number[] = staffList.map((st: any) => {
          const found = st.details?.find(
            (d: any) => parseNum(d.salary_rate) > 0,
          );
          return parseNum(
            found ? found.salary_rate : st.details?.[0]?.salary_rate,
          );
        });

        const staffHourRates: number[] = staffList.map((st: any) => {
          const found = st.details?.find((d: any) => parseNum(d.hour_rate) > 0);
          return parseNum(found ? found.hour_rate : st.details?.[0]?.hour_rate);
        });

        const nonZeroSalaryRates = staffSalaryRates.filter((r) => r > 0);
        const nonZeroHourRates = staffHourRates.filter((r) => r > 0);

        const allSalarySame =
          nonZeroSalaryRates.length > 0 &&
          nonZeroSalaryRates.every((r) => r === nonZeroSalaryRates[0]);
        const allHourSame =
          nonZeroHourRates.length > 0 &&
          nonZeroHourRates.every((r) => r === nonZeroHourRates[0]);

        // Daily Rate
        setCell(
          curRow,
          1,
          "DAILY RATE",
          { name: "Arial", size: 8, bold: true },
          { vertical: "middle" },
        );
        setCell(curRow, 2, "", undefined, undefined);
        ws.mergeCells(curRow, 1, curRow, 2);

        for (let i = 0; i < numStaffCols; i++) {
          const col = 3 + i;
          const val = allSalarySame
            ? i === 0
              ? fmtMoney(nonZeroSalaryRates[0])
              : ""
            : staffSalaryRates[i]
              ? fmtMoney(staffSalaryRates[i])
              : "-";
          setCell(
            curRow,
            col,
            val,
            { name: "Arial", size: 8 },
            { horizontal: "right", vertical: "middle" },
          );
        }
        setCell(
          curRow,
          cTotHours + 1,
          "",
          { name: "Arial", size: 8 },
          { horizontal: "right", vertical: "middle" },
        );
        curRow++;

        // Hourly Rate
        setCell(
          curRow,
          1,
          "HOURLY RATE",
          { name: "Arial", size: 8, bold: true },
          { vertical: "middle" },
        );
        setCell(curRow, 2, "", undefined, undefined);
        ws.mergeCells(curRow, 1, curRow, 2);

        for (let i = 0; i < numStaffCols; i++) {
          const col = 3 + i;
          const val = allHourSame
            ? i === 0
              ? fmtMoney(nonZeroHourRates[0])
              : ""
            : staffHourRates[i]
              ? fmtMoney(staffHourRates[i])
              : "-";
          setCell(
            curRow,
            col,
            val,
            { name: "Arial", size: 8 },
            { horizontal: "right", vertical: "middle" },
          );
        }
        setCell(
          curRow,
          cTotHours + 1,
          "",
          { name: "Arial", size: 8 },
          { horizontal: "right", vertical: "middle" },
        );
        curRow++;

        // Billing Breakdown Rows
        const billingRows = [
          { label: "BASIC RATE", field: "regular_amount" },
          { label: "13th MONTH", field: "thirteen_month_pay" },
          { label: "NET AMT-DISER", field: "gross_pay", green: true },
          { label: "SSS-EC", field: "sss_share" },
          { label: "EC-ER", field: "ec_share" },
          { label: "PHIC", field: "phil_health_share" },
          { label: "PAG-IBIG-ER", field: "pag_ibig_share" },
          { label: "TOTAL GOVT CONTRI", field: "total_govt_share" },
          { label: "TOTAL W/ GOVT CONTRI", field: "total_payroll" },
          { label: "ASF", field: "asf" },
          { label: "TOTAL W/ ASF", field: "total_asf" },
          { label: "VAT", field: "vat" },
          { label: "TOTAL W/ VAT", field: "total_with_vat" },
          { label: "TAX", field: "tax" },
          { label: "NET OF TAX", field: "net_of_tax" },
          { label: "CASH BOND", field: "cash_bond" },
          { label: "TOTAL BILLING", field: "total_billing", yellow: true },
        ];

        billingRows.forEach((item) => {
          const fill = item.yellow
            ? S_YELLOW_FILL
            : item.green
              ? S_GREEN_FILL
              : undefined;
          setCell(
            curRow,
            1,
            item.label,
            { name: "Arial", size: 8.5, bold: true },
            { vertical: "middle" },
            fill,
          );
          setCell(curRow, 2, "", undefined, undefined, fill);
          ws.mergeCells(curRow, 1, curRow, 2);

          let rowSum = 0;
          for (let i = 0; i < numStaffCols; i++) {
            const col = 3 + i;
            const st = staffList[i];
            if (!st) {
              setCell(
                curRow,
                col,
                "-",
                { name: "Arial", size: 8 },
                { horizontal: "right", vertical: "middle" },
                fill,
              );
              continue;
            }
            const sum =
              st.details?.reduce(
                (acc: number, d: any) => acc + parseNum(d[item.field]),
                0,
              ) || 0;
            setCell(
              curRow,
              col,
              fmtMoney(sum),
              { name: "Arial", size: 8 },
              { horizontal: "right", vertical: "middle" },
              fill,
            );
            rowSum += sum;
          }

          setCell(
            curRow,
            cTotHours + 1,
            fmtMoney(rowSum),
            { name: "Arial", size: 8, bold: true },
            { horizontal: "right", vertical: "middle" },
            fill,
          );
          curRow++;
        });

        // Bottom Note
        curRow++;
        setCell(
          curRow,
          1,
          "** THIS IS A SYSTEM GENERATED REPORT **",
          { name: "Arial", size: 8.5, bold: true, color: { argb: "FFFF0000" } },
          { vertical: "middle" },
          undefined,
          false,
        );

        // Column widths
        ws.columns = [
          { width: 6 },
          { width: 18 },
          ...Array(numStaffCols).fill({ width: 22 }),
          { width: 24 },
          { width: 24 },
          { width: 14 },
        ];
      });
    });

    return workbook;
  }
}
