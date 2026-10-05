import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, In, Not, EntityManager } from "typeorm";
import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";

import { ScheduleDetail } from "src/entities/ScheduleDetails";
import { ScheduleHeader } from "src/entities/ScheduleHeader";
import { Staff } from "src/entities/Staff";
import { StaffWarehouse } from "src/entities/StaffWarehouse";
import { CreateSchedulingDetailDto } from "src/modules/staff-scheduling/dto/CreateStaffSchedulingDto";
import { CreateActualLogsHeaderDto } from "src/modules/staff-scheduling/dto/CreateActualLogsHeaderDto";
import { CreateActualLogsDetailDto } from "src/modules/staff-scheduling/dto/CreateActualLogsDetailDto";
import { CreateScheduleHeaderDto } from "src/modules/staff-scheduling/dto/CreateStaffSchedulingDto";
import { UpdateScheduleHeaderDto } from "src/modules/staff-scheduling/dto/UpdateStaffSchedulingDto";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "../../../config/logger";
import {
  STATUS_IDS,
  ACTION_IDS,
  WORKING_DAY_IDS,
  ACCESS_PROCESS,
  ACCESS_KEY_IDS,
  LOGS_TYPE_ID,
  DAYS_FACTOR_RATE,
} from "src/constants/customConstants";
import { ActionLogsService } from "src/modules/actions/services/action-logs.service";
import { Warehouse } from "src/entities/Warehouse";
import { ScheduleHeaderHistory } from "src/entities/ScheduleHeaderHistory";
import * as XLSX from "xlsx";
import { RegularHoliday } from "src/entities/RegularHoliday";

const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const customParseFormat = require("dayjs/plugin/customParseFormat");

dayjs.extend(utc);
dayjs.extend(customParseFormat);

import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { ActualLogsHeader } from "src/entities/ActualLogsHeader";
import { ActualLogsDetail } from "src/entities/ActualLogsDetail";
import { LogsType } from "src/entities/LogsType";
import { PayrollDetails } from "src/entities/PayrollDetails";
import { StaffSalary } from "src/entities/StaffSalary";
import { StaffVendorSalary } from "src/entities/StaffVendorSalary";
import { SssConfigs } from "src/entities/SssConfig";

@Injectable()
export class StaffSchedulingService {
  constructor(
    @InjectRepository(ScheduleDetail)
    private scheduleDetailRepository: Repository<ScheduleDetail>,
    @InjectRepository(LogsType)
    private logsTypeRepository: Repository<LogsType>,
    @InjectRepository(ScheduleHeader)
    private scheduleHeaderRepository: Repository<ScheduleHeader>,
    @InjectRepository(Warehouse)
    private warehouseRepository: Repository<Warehouse>,
    @InjectRepository(StaffWarehouse)
    private staffWarehouseRepository: Repository<StaffWarehouse>,
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    @InjectRepository(PayrollDetails)
    private payrollDetailRepository: Repository<PayrollDetails>,
    @InjectRepository(StaffSalary)
    private staffSalaryRepository: Repository<StaffSalary>,
    @InjectRepository(StaffVendorSalary)
    private staffVendorSalaryRepository: Repository<StaffVendorSalary>,
    @InjectRepository(SssConfigs)
    private sssConfigRepository: Repository<SssConfigs>,
    @InjectRepository(ActualLogsHeader)
    private actualLogsHeaderRepository: Repository<ActualLogsHeader>,
    @InjectRepository(ActualLogsDetail)
    private actualLogsDetailRepository: Repository<ActualLogsDetail>,
    private usersService: UsersService,
    private actionLogsService: ActionLogsService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
    private readonly dataSource: DataSource,
    private readonly httpService: HttpService,
  ) {}

  private readonly module_name = "STAFF SCHEDULING";
  async findAll(statusId?: number[], accessKeyId?: number): Promise<any[]> {
    try {
      const where: any = {};
      if (statusId !== undefined) {
        where.status_id = statusId;
      }
      if (accessKeyId !== undefined) {
        where.access_key_id = accessKeyId;
      }
      const scheduleHeaders = await this.scheduleHeaderRepository.find({
        where,
        order: {
          id: "DESC",
        },
        relations: [
          "status",
          "createdBy",
          "updatedBy",
          "details",
          "details.location",
        ],
      });

      const mappedHeaders =
        this.responseMapperService.mapEntitiesToResponse(scheduleHeaders);

      return mappedHeaders.map((mappedHeader, index) => {
        const originalHeader = scheduleHeaders[index];

        const firstDetail = originalHeader.details?.[0];

        return {
          ...mappedHeader,

          location_name: firstDetail?.location?.location_name ?? null,
        };
      });
    } catch (error) {
      console.error("Error fetching staff schedule:", error);

      throw new Error("Failed to fetch staff schedule");
    }
  }

  async findScheduleHeaderDetails(
    scheduleHeaderId?: number,
    accessKeyId?: number,
  ): Promise<any[]> {
    try {
      const where: any = {};

      if (scheduleHeaderId !== undefined) {
        where.schedule_header_id = scheduleHeaderId;
      }

      if (accessKeyId !== undefined) {
        where.scheduleHeader = {
          access_key_id: accessKeyId,
        };
      }

      const scheduleDetail = await this.scheduleDetailRepository.find({
        where,
        relations: [
          "scheduleHeader",
          "staff",
          "vendor",
          "location",
          "warehouse",
          "status",
          "createdBy",
          "updatedBy",
          "actualLogsDetail",
        ],
        order: {
          id: "ASC",
        },
      });
      return this.responseMapperService.mapEntitiesToResponse(scheduleDetail);
    } catch (error) {
      console.error("Error fetching staff schedule:", error);
      throw new Error("Failed to fetch staff schedule");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const scheduleDetail = await this.scheduleHeaderRepository.findOne({
        where: { id },
        relations: [
          "status",
          "createdBy",
          "updatedBy",
          "details",
          "details.location",
        ],
      });

      if (!scheduleDetail) {
        throw new NotFoundException(`Staff Scheduling with ID ${id} not found`);
      }

      return this.responseMapperService.mapEntityToResponse(scheduleDetail);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching staff scheduling:", error);
      throw new Error("Failed to fetch staff scheduling");
    }
  }

  async create(
    createScheduleDto: CreateScheduleHeaderDto,
    userId: number,
    accessKeyId?: number,
  ): Promise<any> {
    try {
      const createdByUser = await this.usersService.findUserById(userId);

      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      // ============================================================
      // GET STAFF IDS
      // ============================================================

      const staffIds = [
        ...new Set(createScheduleDto.details.map((detail) => detail.staff_id)),
      ];

      const staffList = await this.staffRepository.find({
        where: {
          id: In(staffIds),
        },
      });

      const staffMap = new Map<number, any>(
        staffList.map((staff) => [staff.id, staff]),
      );

      // ============================================================
      // VERIFY ALL STAFF IDS EXIST
      // ============================================================

      for (const detail of createScheduleDto.details) {
        if (!staffMap.has(detail.staff_id)) {
          throw new BadRequestException(
            `Staff with ID ${detail.staff_id} not found`,
          );
        }
      }

      // ============================================================
      // VALIDATE STAFF LOCATION
      // ============================================================

      for (const detail of createScheduleDto.details) {
        const staff = staffMap.get(detail.staff_id);

        if (!staff?.location_id) {
          const staffName =
            staff?.first_name && staff?.last_name
              ? `${staff.first_name} ${staff.last_name}`
              : staff?.staff_code || `Staff ${detail.staff_id}`;

          throw new BadRequestException(
            `Location is not assigned to staff ${staffName}.`,
          );
        }
      }

      // ============================================================
      // GET EXISTING SCHEDULES
      // ============================================================

      const existingSchedules = await this.scheduleDetailRepository.find({
        where: {
          staff_id: In(staffIds),
          scheduleHeader: {
            status_id: Not(STATUS_IDS.CANCELLED),
          },
        },
        relations: ["scheduleHeader", "warehouse"],
      });

      // ============================================================
      // CHECK EXISTING SCHEDULE CONFLICTS
      // ============================================================

      for (
        let lineIndex = 0;
        lineIndex < createScheduleDto.details.length;
        lineIndex++
      ) {
        const detail = createScheduleDto.details[lineIndex];

        const requestedStart = new Date(detail.duty_start_time);
        const requestedEnd = new Date(detail.duty_end_time);

        // ----------------------------------------------------------
        // VALIDATE DUTY TIME
        // ----------------------------------------------------------

        if (isNaN(requestedStart.getTime()) || isNaN(requestedEnd.getTime())) {
          const staff = staffMap.get(detail.staff_id);

          const staffName =
            staff?.first_name && staff?.last_name
              ? `${staff.first_name} ${staff.last_name}`
              : staff?.staff_code || `Staff ${detail.staff_id}`;

          throw new BadRequestException(`Invalid duty time for ${staffName}.`);
        }

        if (requestedStart >= requestedEnd) {
          const staff = staffMap.get(detail.staff_id);

          const staffName =
            staff?.first_name && staff?.last_name
              ? `${staff.first_name} ${staff.last_name}`
              : staff?.staff_code || `Staff ${detail.staff_id}`;

          throw new BadRequestException(
            `Invalid duty time for staff ${staffName}: ` +
              `duty start time must be earlier than duty end time.`,
          );
        }

        // ----------------------------------------------------------
        // GET EXISTING SCHEDULES FOR THIS STAFF
        // ----------------------------------------------------------

        const staffExistingSchedules = existingSchedules.filter(
          (existing) => existing.staff_id === detail.staff_id,
        );

        // ----------------------------------------------------------
        // CHECK ACTUAL DUTY DATE/TIME OVERLAP
        // ----------------------------------------------------------

        for (const existing of staffExistingSchedules) {
          const existingStart = new Date(existing.duty_start_time);

          const existingEnd = new Date(existing.duty_end_time);

          if (isNaN(existingStart.getTime()) || isNaN(existingEnd.getTime())) {
            continue;
          }

          const hasConflict =
            requestedStart < existingEnd && requestedEnd > existingStart;

          if (hasConflict) {
            const staff = staffMap.get(detail.staff_id);

            const staffName =
              staff?.first_name && staff?.last_name
                ? `${staff.first_name} ${staff.last_name}`.toUpperCase()
                : (
                    staff?.staff_code || `Staff ${detail.staff_id}`
                  ).toUpperCase();

            const storeName =
              existing.warehouse?.warehouse_name ||
              `OUTLET #${existing.warehouse_id}`;

            const scheduleNo =
              existing.scheduleHeader?.id ||
              existing.schedule_header_id ||
              existing.id;

            const formattedDate = dayjs(existing.duty_start_time).format(
              "MM/DD/YYYY",
            );

            const formattedTimeRange = `${dayjs(
              existing.duty_start_time,
            ).format("MM/DD/YYYY HH:mm")} - ${dayjs(
              existing.duty_end_time,
            ).format("MM/DD/YYYY HH:mm")}`;

            throw new BadRequestException(
              JSON.stringify({
                type: "SCHEDULE_CONFLICT",
                title: "Conflict of Duty Hours",
                description:
                  "Schedule already exists for the selected duty date and time.",
                outlet: storeName,
                crew: staffName,
                schedule_no: scheduleNo,
                scheduled_date: formattedDate,
                scheduled_time: formattedTimeRange,
                error_line: lineIndex + 1,
                message:
                  `Conflict of Duty Hours: Schedule already exists ` +
                  `for ${staffName} on ${formattedDate}.`,
              }),
            );
          }
        }
      }

      // ============================================================
      // CHECK INTERNAL PAYLOAD CONFLICTS
      // ============================================================

      for (let i = 0; i < createScheduleDto.details.length; i++) {
        const currentDetail = createScheduleDto.details[i];

        const currentStart = new Date(currentDetail.duty_start_time);

        const currentEnd = new Date(currentDetail.duty_end_time);

        if (isNaN(currentStart.getTime()) || isNaN(currentEnd.getTime())) {
          continue;
        }

        for (let j = i + 1; j < createScheduleDto.details.length; j++) {
          const nextDetail = createScheduleDto.details[j];

          // Only compare schedules belonging to the same staff
          if (currentDetail.staff_id !== nextDetail.staff_id) {
            continue;
          }

          const nextStart = new Date(nextDetail.duty_start_time);

          const nextEnd = new Date(nextDetail.duty_end_time);

          if (isNaN(nextStart.getTime()) || isNaN(nextEnd.getTime())) {
            continue;
          }

          const hasConflict = currentStart < nextEnd && currentEnd > nextStart;

          if (hasConflict) {
            const staff = staffMap.get(currentDetail.staff_id);

            const staffName =
              staff?.first_name && staff?.last_name
                ? `${staff.first_name} ${staff.last_name}`.toUpperCase()
                : (
                    staff?.staff_code || `Staff ${currentDetail.staff_id}`
                  ).toUpperCase();

            const formattedDate = dayjs(currentDetail.duty_start_time).format(
              "MM/DD/YYYY",
            );

            const formattedTimeRange = `${dayjs(
              currentDetail.duty_start_time,
            ).format("MM/DD/YYYY HH:mm")} - ${dayjs(
              currentDetail.duty_end_time,
            ).format("MM/DD/YYYY HH:mm")}`;

            throw new BadRequestException(
              JSON.stringify({
                type: "SCHEDULE_CONFLICT",
                title: "Conflict of Duty Hours",
                subtitle:
                  "Multiple schedule entries for the same staff have overlapping duty hours.",
                outlet: `Excel Row #${i + 3} & Row #${j + 3}`,
                crew: staffName,
                schedule_no: "New Entry",
                scheduled_date: formattedDate,
                scheduled_time: formattedTimeRange,
                error_line: j + 1,
                message:
                  `Conflict of Duty Hours: Multiple schedule entries ` +
                  `for ${staffName} have overlapping duty hours.`,
              }),
            );
          }
        }
      }

      // ============================================================
      // AUTO ENROLL / AUTO SYNC CHECK
      // ============================================================

      const isAutoEnrollSchedule =
        ACCESS_PROCESS.AUTO_ENROLL_SCHEDULE.includes(accessKeyId);

      const statusID = isAutoEnrollSchedule
        ? STATUS_IDS.POSTED
        : STATUS_IDS.PENDING;

      // ============================================================
      // GROUP DETAILS BY STAFF LOCATION
      // ============================================================

      const detailsByLocation = new Map<
        number,
        typeof createScheduleDto.details
      >();

      for (const detail of createScheduleDto.details) {
        const staff = staffMap.get(detail.staff_id);

        const locationId = staff.location_id;

        if (!detailsByLocation.has(locationId)) {
          detailsByLocation.set(locationId, []);
        }

        detailsByLocation.get(locationId)!.push(detail);
      }

      // ============================================================
      // TRANSACTION
      // ============================================================

      const savedHeaders =
        await this.scheduleHeaderRepository.manager.transaction(
          async (transactionalEntityManager) => {
            const createdHeaders: ScheduleHeader[] = [];

            // ========================================================
            // SCHEDULE DATE / WORKING DAY
            // ========================================================

            const scheduleDate = new Date(createScheduleDto.schedule_date);

            const regularHoliday = await transactionalEntityManager.findOne(
              RegularHoliday,
              {
                where: {
                  regular_holiday_date: scheduleDate,
                },
              },
            );

            const workingDay = regularHoliday
              ? WORKING_DAY_IDS.REGULAR_HOLIDAY
              : WORKING_DAY_IDS.REGULAR_DAY;

            // ========================================================
            // PROCESS EACH LOCATION
            // ========================================================

            for (const [
              locationId,
              locationDetails,
            ] of detailsByLocation.entries()) {
              // ======================================================
              // CREATE SCHEDULE HEADER FOR THIS LOCATION
              // ======================================================

              const entryCount = locationDetails.length;

              const newScheduleHeader = transactionalEntityManager.create(
                ScheduleHeader,
                {
                  schedule_date: createScheduleDto.schedule_date,
                  entry_no: entryCount,
                  shifting_day: createScheduleDto.shifting_day,
                  status_id: statusID,
                  attendance_status_id: isAutoEnrollSchedule
                    ? STATUS_IDS.VALIDATED
                    : null,
                  attendance_ts: isAutoEnrollSchedule ? new Date() : null,
                  access_key_id: accessKeyId,
                  created_by: userId,
                  updated_by: userId,
                },
              );

              const savedHeaderRecord = await transactionalEntityManager.save(
                ScheduleHeader,
                newScheduleHeader,
              );

              createdHeaders.push(savedHeaderRecord);

              // ======================================================
              // CREATE SCHEDULE HEADER HISTORY
              // ======================================================

              await this.createScheduleHeaderHistory(
                transactionalEntityManager,
                savedHeaderRecord,
                userId,
              );

              // ======================================================
              // ACTUAL LOGS HEADER
              //
              // ONE ACTUAL LOGS HEADER PER LOCATION
              // ======================================================

              let savedActualLogsHeader: ActualLogsHeader | null = null;

              let logsType: any = null;

              if (isAutoEnrollSchedule) {
                logsType = await this.logsTypeRepository.findOne({
                  where: {
                    id: LOGS_TYPE_ID.CC_FETCH,
                  },
                });

                const actualLogsHeaderDto: CreateActualLogsHeaderDto = {
                  tagging: logsType.description,
                  logs_type_id: LOGS_TYPE_ID.CC_FETCH,
                  created_by: userId,
                  updated_by: userId,
                  access_key_id: accessKeyId,
                  status_id: STATUS_IDS.ACTIVE,
                };

                const actualLogsHeader = transactionalEntityManager.create(
                  ActualLogsHeader,
                  actualLogsHeaderDto,
                );

                savedActualLogsHeader = await transactionalEntityManager.save(
                  ActualLogsHeader,
                  actualLogsHeader,
                );
              }

              // ======================================================
              // TRACK STAFF ALREADY ADDED
              // ======================================================

              const staffAlreadyAdded = new Set<number>();

              // ======================================================
              // CREATE DETAILS FOR THIS LOCATION
              // ======================================================

              const detailsToSave: ScheduleDetail[] = [];

              for (const detail of locationDetails) {
                const staff = staffMap.get(detail.staff_id);

                const requestedStart = new Date(detail.duty_start_time);

                const requestedEnd = new Date(detail.duty_end_time);

                // ==================================================
                // NIGHT SHIFT
                // ==================================================

                const isNightShift = this.checkIfNightShift(
                  requestedEnd,
                  scheduleDate,
                  requestedStart,
                );

                // ==================================================
                // CHECK MULTIPLE DUTY

                const hasExistingDuty = await this.checkDutyCount(
                  transactionalEntityManager,
                  detail.staff_id,
                  scheduleDate,
                );

                const multipleDuty =
                  hasExistingDuty || staffAlreadyAdded.has(detail.staff_id)
                    ? 1
                    : 0;

                // ACTUAL LOGS DETAIL

                let savedActualLogsDetail: ActualLogsDetail | null = null;

                if (isAutoEnrollSchedule && savedActualLogsHeader) {
                  let actualLogsDetailDto: CreateActualLogsDetailDto;

                  try {
                    actualLogsDetailDto = {
                      staff_id: detail.staff_id,
                      staff_code: staff.staff_code || staff.code,
                      remarks: detail.remarks || "Auto-synced from DWS log",
                      warehouse_id: detail.warehouse_id,
                      location_id: staff.location_id,
                      service_provider_id: staff.vendor_id,
                      access_key_id: accessKeyId,
                      logs_date: createScheduleDto.schedule_date,
                      status_id: STATUS_IDS.ACTIVE,
                      orig_time_in: detail.orig_time_in
                        ? new Date(detail.orig_time_in).toISOString()
                        : undefined,
                      orig_time_out: detail.orig_time_out
                        ? new Date(detail.orig_time_out).toISOString()
                        : undefined,
                      orig_break_in: detail.orig_break_in
                        ? new Date(detail.orig_break_in).toISOString()
                        : undefined,
                      orig_break_out: detail.orig_break_out
                        ? new Date(detail.orig_break_out).toISOString()
                        : undefined,
                      time_in: detail.just_time_in
                        ? new Date(detail.just_time_in).toISOString()
                        : undefined,

                      time_out: detail.just_time_out
                        ? new Date(detail.just_time_out).toISOString()
                        : undefined,

                      break_in: detail.just_break_in
                        ? new Date(detail.just_break_in).toISOString()
                        : undefined,

                      break_out: detail.just_break_out
                        ? new Date(detail.just_break_out).toISOString()
                        : undefined,
                      overtime_in: detail.overtime_in
                        ? new Date(detail.overtime_in).toISOString()
                        : undefined,

                      overtime_out: detail.overtime_out
                        ? new Date(detail.overtime_out).toISOString()
                        : undefined,
                      regular: detail.regular,
                      break_hours: detail.break_hours,
                      overtime: detail.overtime,
                      twh: detail.twh,
                      working_hours: detail.twh ?? 0,
                      shift_type: isNightShift,
                      created_by: userId,
                      updated_by: userId,
                    };
                  } catch (error: any) {
                    throw error;
                  }

                  const actualLogsDetail = transactionalEntityManager.create(
                    ActualLogsDetail,
                    {
                      ...actualLogsDetailDto,
                      // ACTUAL LOGS HEADER
                      actual_header_id: savedActualLogsHeader.id,
                    },
                  );

                  savedActualLogsDetail = await transactionalEntityManager.save(
                    ActualLogsDetail,
                    actualLogsDetail,
                  );
                }
                // CREATE SCHEDULE DETAIL
                const scheduleDetail = transactionalEntityManager.create(
                  ScheduleDetail,
                  {
                    schedule_header_id: savedHeaderRecord.id,
                    staff_id: detail.staff_id,
                    actual_logs_detail_id: savedActualLogsDetail
                      ? savedActualLogsDetail.id
                      : null,
                    staff_code: staff.staff_code || staff.code,
                    vendor_id: staff.vendor_id,
                    location_id: staff.location_id,
                    warehouse_id: detail.warehouse_id,
                    remarks: detail.remarks,
                    duty_start_time: detail.duty_start_time,
                    duty_end_time: detail.duty_end_time,
                    planned_duty_start_time: detail.duty_start_time,
                    planned_duty_end_time: detail.duty_end_time,
                    operational_start_time: detail.operational_start_time,
                    operational_end_time: detail.operational_end_time,
                    diff_outlet: detail.diff_outlet,
                    add_ot: detail.add_ot,
                    working_day_id: workingDay,
                    shift_type: isNightShift,
                    multiple_duty: multipleDuty,
                    status_id: STATUS_IDS.ACTIVE,
                    attendance_status_id: STATUS_IDS.VALIDATED,
                    access_key_id: accessKeyId,
                    // ==========================================
                    // DWS ACTUAL TIME DATA
                    // ==========================================
                    // ...(isAutoEnrollSchedule && {
                    //   overtime_in: detail.overtime_in
                    //     ? new Date(detail.overtime_in)
                    //     : null,
                    //   overtime_out: detail.overtime_out
                    //     ? new Date(detail.overtime_out)
                    //     : null,
                    //   regular: detail.regular,
                    //   break_hours: detail.break_hours,
                    //   overtime: detail.overtime,
                    //   twh: detail.twh,
                    // }),
                    created_by: userId,
                    updated_by: userId,
                  },
                );

                detailsToSave.push(scheduleDetail);

                staffAlreadyAdded.add(detail.staff_id);
              }

              // ======================================================
              // SAVE DETAILS FOR THIS LOCATION
              // ======================================================

              await transactionalEntityManager.save(
                ScheduleDetail,
                detailsToSave,
              );
            }

            return createdHeaders;
          },
        );

      // ============================================================
      // USER AUDIT TRAIL
      // ============================================================

      await this.userAuditTrailCreateService.create(
        {
          service: "StaffSchedulingService",

          method: "create",

          raw_data: JSON.stringify(savedHeaders),

          description:
            `Created ${savedHeaders.length} schedule ` +
            `header(s) grouped by staff location`,

          status_id: 1,
        },
        userId,
      );

      // ============================================================
      // GET CREATED SCHEDULES WITH RELATIONS
      // ============================================================

      const scheduleWithRelations: ScheduleHeader[] = [];

      for (const savedHeader of savedHeaders) {
        const schedule = await this.scheduleHeaderRepository.findOne({
          where: {
            id: savedHeader.id,
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
        });

        if (schedule) {
          scheduleWithRelations.push(schedule);
        }
      }

      if (scheduleWithRelations.length !== savedHeaders.length) {
        throw new Error("Failed to retrieve all created staff schedules");
      }

      // ============================================================
      // ACTION LOG
      // ============================================================

      for (const savedHeader of savedHeaders) {
        try {
          await this.actionLogsService.logAction({
            module_name: this.module_name,

            ref_id: savedHeader.id,

            action_id: ACTION_IDS.ADD,

            description: `Add Schedule`,

            raw_data: JSON.stringify({
              savedHeader,
            }),

            created_by: userId,
          });
        } catch (err) {
          logger.error(
            `Action log failed for Schedule Header ${savedHeader.id}:`,
            err,
          );
        }
      }

      // ============================================================
      // RESPONSE
      // ============================================================

      const responses = scheduleWithRelations.map((schedule) =>
        this.responseMapperService.mapEntityToResponse(schedule),
      );

      // ============================================================
      // SSE
      // ============================================================

      for (const response of responses) {
        try {
          this.sseEventEmitter.emitCreate(
            "staff_scheduling",
            response.id,
            response,
          );
        } catch (err) {
          logger.error(`SSE event failed for Schedule ${response.id}:`, err);
        }
      }

      // ============================================================
      // RETURN
      // ============================================================

      return responses;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error(`Failed to create staff scheduling: ${errorMessage}`);

      if (errorStack) {
        logger.error(errorStack);
      }

      throw error;
    }
  }

  async update(
    id: number,
    updateScheduleDto: UpdateScheduleHeaderDto,
    userId: number,
    accessKeyId?: number,
  ): Promise<any> {
    try {
      const updatedByUser = await this.usersService.findUserById(userId);

      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const existingHeader = await this.scheduleHeaderRepository.findOne({
        where: {
          id,
        },
        relations: ["details"],
      });

      if (!existingHeader) {
        throw new NotFoundException(`Schedule with ID ${id} not found`);
      }

      // Prevent editing cancelled schedules
      if (existingHeader.status_id === STATUS_IDS.CANCELLED) {
        throw new BadRequestException("Cancelled schedules cannot be updated.");
      }

      const details = updateScheduleDto.details || [];

      if (!details.length) {
        throw new BadRequestException(
          "At least one schedule detail is required.",
        );
      }

      const staffIds = [...new Set(details.map((detail) => detail.staff_id))];

      const staffList = await this.staffRepository.find({
        where: {
          id: In(staffIds),
        },
      });

      const staffMap = new Map<number, any>(
        staffList.map((staff) => [staff.id, staff]),
      );

      // Verify all staff IDs exist
      for (const detail of details) {
        if (!staffMap.has(detail.staff_id)) {
          throw new BadRequestException(
            `Staff with ID ${detail.staff_id} not found`,
          );
        }
      }

      for (let lineIndex = 0; lineIndex < details.length; lineIndex++) {
        const detail = details[lineIndex];

        const requestedStart = new Date(detail.duty_start_time);
        const requestedEnd = new Date(detail.duty_end_time);

        const staff = staffMap.get(detail.staff_id);

        const staffName =
          staff?.first_name && staff?.last_name
            ? `${staff.first_name} ${staff.last_name}`.toUpperCase()
            : (staff?.staff_code || `Staff ${detail.staff_id}`).toUpperCase();

        if (isNaN(requestedStart.getTime()) || isNaN(requestedEnd.getTime())) {
          throw new BadRequestException(`Invalid duty time for ${staffName}.`);
        }

        if (requestedStart >= requestedEnd) {
          throw new BadRequestException(
            `Invalid duty time for staff ${staffName}: ` +
              `duty start time must be earlier than duty end time.`,
          );
        }
      }

      // CHECK OVERLAPPING DUTY HOURS WITHIN CURRENT UPDATE
      for (let i = 0; i < updateScheduleDto.details.length; i++) {
        const currentDetail = updateScheduleDto.details[i];

        const currentStart = new Date(currentDetail.duty_start_time);
        const currentEnd = new Date(currentDetail.duty_end_time);

        if (isNaN(currentStart.getTime()) || isNaN(currentEnd.getTime())) {
          continue;
        }

        for (let j = i + 1; j < updateScheduleDto.details.length; j++) {
          const nextDetail = updateScheduleDto.details[j];

          if (currentDetail.staff_id !== nextDetail.staff_id) {
            continue;
          }

          const nextStart = new Date(nextDetail.duty_start_time);
          const nextEnd = new Date(nextDetail.duty_end_time);

          if (isNaN(nextStart.getTime()) || isNaN(nextEnd.getTime())) {
            continue;
          }

          const hasConflict = currentStart < nextEnd && currentEnd > nextStart;

          if (hasConflict) {
            const staff = staffMap.get(currentDetail.staff_id);

            const staffName =
              staff?.first_name && staff?.last_name
                ? `${staff.first_name} ${staff.last_name}`.toUpperCase()
                : (
                    staff?.staff_code || `Staff ${currentDetail.staff_id}`
                  ).toUpperCase();

            const formattedDate = dayjs(currentDetail.duty_start_time).format(
              "MM/DD/YYYY",
            );

            const formattedTimeRange = `${dayjs(
              currentDetail.duty_start_time,
            ).format("MM/DD/YYYY hh:mm A")} - ${dayjs(
              currentDetail.duty_end_time,
            ).format("MM/DD/YYYY hh:mm A")}`;

            throw new BadRequestException(
              JSON.stringify({
                type: "SCHEDULE_CONFLICT",
                title: "Conflict of Duty Hours",
                subtitle:
                  "Multiple schedule entries for the same staff have overlapping duty hours.",
                outlet: `Row #${i + 1} & Row #${j + 1}`,
                crew: staffName,
                schedule_no: id,
                scheduled_date: formattedDate,
                scheduled_time: formattedTimeRange,
                error_line: j + 1,
                message:
                  `Conflict of Duty Hours: Multiple schedule entries ` +
                  `for ${staffName} have overlapping duty hours.`,
              }),
            );
          }
        }
      }

      const existingSchedules = await this.scheduleDetailRepository.find({
        where: {
          staff_id: In(staffIds),
          scheduleHeader: {
            id: Not(id),
            status_id: Not(STATUS_IDS.CANCELLED),
          },
        },
        relations: ["scheduleHeader", "warehouse"],
      });

      // VALIDATE AGAINST EXISTING SCHEDULES

      for (let lineIndex = 0; lineIndex < details.length; lineIndex++) {
        const detail = details[lineIndex];

        const requestedStart = new Date(detail.duty_start_time);
        const requestedEnd = new Date(detail.duty_end_time);

        const staff = staffMap.get(detail.staff_id);

        const staffName =
          staff?.first_name && staff?.last_name
            ? `${staff.first_name} ${staff.last_name}`.toUpperCase()
            : (staff?.staff_code || `Staff ${detail.staff_id}`).toUpperCase();

        // Validate requested datetime
        if (isNaN(requestedStart.getTime()) || isNaN(requestedEnd.getTime())) {
          throw new BadRequestException(`Invalid duty time for ${staffName}.`);
        }

        // Start must be before end
        if (requestedStart >= requestedEnd) {
          throw new BadRequestException(
            `Invalid duty time for staff ${staffName}: ` +
              `duty start time must be earlier than duty end time.`,
          );
        }

        const staffExistingSchedules = existingSchedules.filter(
          (existing) => existing.staff_id === detail.staff_id,
        );

        for (const existing of staffExistingSchedules) {
          const existingStart = new Date(existing.duty_start_time);
          const existingEnd = new Date(existing.duty_end_time);

          // Ignore invalid existing records
          if (isNaN(existingStart.getTime()) || isNaN(existingEnd.getTime())) {
            continue;
          }

          const hasConflict =
            requestedStart < existingEnd && requestedEnd > existingStart;

          if (!hasConflict) {
            continue;
          }

          const storeName =
            existing.warehouse?.warehouse_name ||
            `OUTLET #${existing.warehouse_id}`;

          const scheduleNo =
            existing.scheduleHeader?.id ||
            existing.schedule_header_id ||
            existing.id;

          // Use the EXISTING duty date, not the update header date
          const formattedDate = dayjs(existing.duty_start_time).format(
            "MM/DD/YYYY",
          );

          const formattedTimeRange = `${dayjs(existing.duty_start_time).format(
            "MM/DD/YYYY hh:mm A",
          )} - ${dayjs(existing.duty_end_time).format("MM/DD/YYYY hh:mm A")}`;

          throw new BadRequestException(
            JSON.stringify({
              type: "SCHEDULE_CONFLICT",
              title: "Conflict of Duty Hours",
              subtitle:
                "Schedule already exists for the selected duty date and time.",
              outlet: storeName,
              crew: staffName,
              schedule_no: scheduleNo,
              scheduled_date: formattedDate,
              scheduled_time: formattedTimeRange,
              error_line: lineIndex + 1,
              message:
                `Conflict of Duty Hours: Schedule already exists ` +
                `for ${staffName} on ${formattedDate}.`,
            }),
          );
        }
      }

      const savedHeader =
        await this.scheduleHeaderRepository.manager.transaction(
          async (transactionalEntityManager) => {
            const scheduleDate = updateScheduleDto.schedule_date
              ? updateScheduleDto.schedule_date.substring(0, 10)
              : dayjs(existingHeader.schedule_date).format("YYYY-MM-DD");

            const scheduleDateValue = new Date(`${scheduleDate}T00:00:00`);
            existingHeader.schedule_date = scheduleDateValue;
            existingHeader.entry_no = details.length;
            if (updateScheduleDto.reason !== undefined) {
              existingHeader.reason = updateScheduleDto.reason;
            }
            if (updateScheduleDto.shifting_day !== undefined) {
              existingHeader.shifting_day = updateScheduleDto.shifting_day;
            }
            existingHeader.updated_by = userId;
            existingHeader.modified_at = new Date();

            const savedHeaderRecord = await transactionalEntityManager.save(
              ScheduleHeader,
              existingHeader,
            );

            await this.createScheduleHeaderHistory(
              transactionalEntityManager,
              savedHeaderRecord,
              userId,
            );

            const incomingDetailIds = details
              .filter((detail) => detail.id)
              .map((detail) => Number(detail.id));

            const detailsToDelete = existingHeader.details.filter(
              (existingDetail) =>
                !incomingDetailIds.includes(existingDetail.id),
            );

            if (detailsToDelete.length > 0) {
              await transactionalEntityManager.delete(
                ScheduleDetail,
                detailsToDelete.map((detail) => detail.id),
              );
            }

            const detailsToSave: ScheduleDetail[] = [];

            const staffAlreadyAdded = new Set<number>();

            for (const detail of details) {
              const staff = staffMap.get(detail.staff_id);

              const requestedStart = new Date(detail.duty_start_time);
              const requestedEnd = new Date(detail.duty_end_time);

              const isNightShift = this.checkIfNightShift(
                requestedEnd,
                scheduleDateValue,
                requestedStart,
              );

              // Check if this staff already has another duty
              // on the same schedule date, excluding this schedule
              // currently being updated.
              const hasExistingDuty = await this.checkDutyCount(
                transactionalEntityManager,
                detail.staff_id,
                scheduleDateValue,
                id,
              );

              // If another schedule already exists for this staff,
              // OR this staff already appeared earlier in this update,
              // mark this as multiple duty.
              const multipleDuty =
                hasExistingDuty || staffAlreadyAdded.has(detail.staff_id)
                  ? 1
                  : 0;

              const scheduleDetailData = {
                schedule_header_id: savedHeaderRecord.id,
                staff_id: detail.staff_id,
                staff_code: staff.staff_code || staff.code,
                vendor_id: staff.vendor_id,
                location_id: staff.location_id,
                warehouse_id: detail.warehouse_id,
                remarks: detail.remarks,
                duty_start_time: detail.duty_start_time,
                duty_end_time: detail.duty_end_time,
                starting_time: detail.starting_time,
                ending_time: detail.ending_time,

                // Old schedule logic
                shift_type: isNightShift,
                multiple_duty: multipleDuty,

                status_id: STATUS_IDS.ACTIVE,
                updated_by: userId,
              };

              let scheduleDetail: ScheduleDetail;

              if (detail.id) {
                scheduleDetail = transactionalEntityManager.create(
                  ScheduleDetail,
                  {
                    id: Number(detail.id),
                    ...scheduleDetailData,
                  },
                );
              } else {
                scheduleDetail = transactionalEntityManager.create(
                  ScheduleDetail,
                  {
                    ...scheduleDetailData,
                    created_by: userId,
                  },
                );
              }

              detailsToSave.push(scheduleDetail);

              // Remember that this staff has already appeared
              staffAlreadyAdded.add(detail.staff_id);
            }

            await transactionalEntityManager.save(
              ScheduleDetail,
              detailsToSave,
            );

            return savedHeaderRecord;
          },
        );

      await this.userAuditTrailCreateService.create(
        {
          service: "StaffSchedulingService",
          method: "update",
          raw_data: JSON.stringify(savedHeader),
          description: `Updated schedule entry with ${details.length} details`,
          status_id: 1,
        },
        userId,
      );

      const scheduleWithRelations = await this.scheduleHeaderRepository.findOne(
        {
          where: {
            id: savedHeader.id,
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

      if (!scheduleWithRelations) {
        throw new Error("Failed to retrieve updated staff schedule");
      }

      try {
        await this.actionLogsService.logAction({
          module_name: this.module_name,
          ref_id: savedHeader.id,
          action_id: ACTION_IDS.EDIT,
          description: `Update Schedule`,
          raw_data: JSON.stringify({
            savedHeader,
          }),
          created_by: userId,
        });
      } catch (err) {
        logger.error("Action log failed for Update Schedule:", err);
      }

      const response = this.responseMapperService.mapEntityToResponse(
        scheduleWithRelations,
      );

      try {
        this.sseEventEmitter.emitUpdate(
          "staff_scheduling",
          response.id,
          response,
        );

        this.sseEventEmitter.emitUpdate(
          "staff_attendance",
          response.id,
          response,
        );
      } catch (err) {
        logger.error("SSE update event failed:", err);
      }

      return response;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      logger.error("Failed to update staff scheduling:", error);

      throw new Error("Failed to update staff scheduling");
    }
  }

  async postSchedule(
    updateScheduleDto: UpdateScheduleHeaderDto,
    userId: number,
  ): Promise<any> {
    try {
      const scheduleIds = updateScheduleDto.id;

      if (!scheduleIds?.length) {
        throw new BadRequestException(
          "At least one Schedule Header ID is required.",
        );
      }

      const scheduleHeaders = await this.scheduleHeaderRepository.find({
        where: {
          id: In(scheduleIds),
        },
        relations: ["status", "createdBy", "updatedBy"],
      });

      const foundIds = scheduleHeaders.map((schedule) => schedule.id);

      const missingIds = scheduleIds.filter(
        (scheduleId) => !foundIds.includes(scheduleId),
      );

      if (missingIds.length > 0) {
        throw new NotFoundException(
          `Schedule Header(s) with ID(s) ${missingIds.join(", ")} not found`,
        );
      }

      const updatedScheduleHeaders =
        await this.scheduleHeaderRepository.manager.transaction(
          async (transactionalEntityManager) => {
            // Update Schedule Headers
            await transactionalEntityManager.update(
              ScheduleHeader,
              {
                id: In(scheduleIds),
              },
              {
                status_id: STATUS_IDS.POSTED,
                attendance_status_id: STATUS_IDS.PENDING,
                updated_by: userId,
                modified_at: new Date(),
              },
            );

            // Update related Schedule Details
            await transactionalEntityManager.update(
              ScheduleDetail,
              {
                schedule_header_id: In(scheduleIds),
              },
              {
                attendance_status_id: STATUS_IDS.PENDING,
                updated_by: userId,
                modified_at: new Date(),
              },
            );

            const updatedHeaders = await transactionalEntityManager.find(
              ScheduleHeader,
              {
                where: {
                  id: In(scheduleIds),
                },
                relations: ["status", "createdBy", "updatedBy"],
              },
            );

            for (const schedule of updatedHeaders) {
              await this.createScheduleHeaderHistory(
                transactionalEntityManager,
                schedule,
                userId,
              );
            }

            return updatedHeaders;
          },
        );

      await this.userAuditTrailCreateService.create(
        {
          service: "Staff Scheduling Services",
          method: "postSchedule",
          raw_data: JSON.stringify(updatedScheduleHeaders),
          description: `Posted Schedule Headers: ${scheduleIds.join(", ")}`,
          status_id: 1,
        },
        userId,
      );

      const responses = updatedScheduleHeaders.map((schedule) =>
        this.responseMapperService.mapEntityToResponse(schedule),
      );

      try {
        for (const schedule of updatedScheduleHeaders) {
          await this.actionLogsService.logAction({
            module_name: this.module_name,
            ref_id: schedule.id,
            action_id: ACTION_IDS.POST,
            description: `Post Schedule`,
            raw_data: JSON.stringify(schedule),
            created_by: userId,
          });
        }
      } catch (err) {
        logger.error("Action log failed for Post Schedule:", err);
      }

      for (const response of responses) {
        try {
          this.sseEventEmitter.emitUpdate(
            "staff_scheduling",
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
      }

      return responses;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      logger.error("Failed to post schedule headers:", error);

      throw new Error("Failed to post schedule headers");
    }
  }

  async revertSchedule(
    updateScheduleDto: UpdateScheduleHeaderDto,
    userId: number,
  ): Promise<any> {
    try {
      const scheduleIds = updateScheduleDto.id;

      if (!scheduleIds?.length) {
        throw new BadRequestException(
          "At least one Schedule Header ID is required.",
        );
      }

      const scheduleHeaders = await this.scheduleHeaderRepository.find({
        where: {
          id: In(scheduleIds),
        },
        relations: ["status", "createdBy", "updatedBy"],
      });

      const foundIds = scheduleHeaders.map((schedule) => schedule.id);

      const missingIds = scheduleIds.filter(
        (scheduleId) => !foundIds.includes(scheduleId),
      );

      if (missingIds.length > 0) {
        throw new NotFoundException(
          `Schedule Header(s) with ID(s) ${missingIds.join(", ")} not found`,
        );
      }

      const updatedScheduleHeaders =
        await this.scheduleHeaderRepository.manager.transaction(
          async (transactionalEntityManager) => {
            await transactionalEntityManager.update(
              ScheduleHeader,
              {
                id: In(scheduleIds),
              },
              {
                status_id: STATUS_IDS.PENDING,
                attendance_status_id: null,
                reason: updateScheduleDto.reason,
                updated_by: userId,
                modified_at: new Date(),
              },
            );

            await transactionalEntityManager.update(
              ScheduleDetail,
              {
                schedule_header_id: In(scheduleIds),
              },
              {
                cron_computed: false,
              },
            );

            const updatedHeaders = await transactionalEntityManager.find(
              ScheduleHeader,
              {
                where: {
                  id: In(scheduleIds),
                },
                relations: ["status", "createdBy", "updatedBy"],
              },
            );

            for (const schedule of updatedHeaders) {
              await this.createScheduleHeaderHistory(
                transactionalEntityManager,
                schedule,
                userId,
              );
            }

            return updatedHeaders;
          },
        );

      await this.userAuditTrailCreateService.create(
        {
          service: "Staff Scheduling Services",
          method: "revertSchedule",
          raw_data: JSON.stringify(updatedScheduleHeaders),
          description: `Reverted Schedule Headers: ${scheduleIds.join(", ")}`,
          status_id: 1,
        },
        userId,
      );

      const responses = updatedScheduleHeaders.map((schedule) =>
        this.responseMapperService.mapEntityToResponse(schedule),
      );

      try {
        for (const schedule of updatedScheduleHeaders) {
          await this.actionLogsService.logAction({
            module_name: this.module_name,
            ref_id: schedule.id,
            action_id: ACTION_IDS.REVERT,
            description: `Revert Schedule Reason: ${updateScheduleDto.reason}`,
            raw_data: JSON.stringify(schedule),
            created_by: userId,
          });
        }
      } catch (err) {
        logger.error("Action log failed for Revert Schedule:", err);
      }

      for (const response of responses) {
        try {
          this.sseEventEmitter.emitUpdate(
            "staff_scheduling",
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

      logger.error("Failed to revert schedule headers:", error);

      throw new Error("Failed to revert schedule headers");
    }
  }

  async cancelSchedule(
    updateScheduleDto: UpdateScheduleHeaderDto,
    userId: number,
  ): Promise<any> {
    try {
      const scheduleIds = updateScheduleDto.id;

      if (!scheduleIds?.length) {
        throw new BadRequestException(
          "At least one Schedule Header ID is required.",
        );
      }

      const scheduleHeaders = await this.scheduleHeaderRepository.find({
        where: {
          id: In(scheduleIds),
        },
        relations: ["status", "createdBy", "updatedBy"],
      });

      const foundIds = scheduleHeaders.map((schedule) => schedule.id);

      const missingIds = scheduleIds.filter(
        (scheduleId) => !foundIds.includes(scheduleId),
      );

      if (missingIds.length > 0) {
        throw new NotFoundException(
          `Schedule Header(s) with ID(s) ${missingIds.join(", ")} not found`,
        );
      }

      const updatedScheduleHeaders =
        await this.scheduleHeaderRepository.manager.transaction(
          async (transactionalEntityManager) => {
            await transactionalEntityManager.update(
              ScheduleHeader,
              {
                id: In(scheduleIds),
              },
              {
                status_id: STATUS_IDS.CANCELLED,
                attendance_status_id: null,
                reason: updateScheduleDto.reason,
                updated_by: userId,
                modified_at: new Date(),
              },
            );

            const updatedHeaders = await transactionalEntityManager.find(
              ScheduleHeader,
              {
                where: {
                  id: In(scheduleIds),
                },
                relations: ["status", "createdBy", "updatedBy"],
              },
            );

            for (const schedule of updatedHeaders) {
              await this.createScheduleHeaderHistory(
                transactionalEntityManager,
                schedule,
                userId,
              );
            }

            return updatedHeaders;
          },
        );

      await this.userAuditTrailCreateService.create(
        {
          service: "Staff Scheduling Services",
          method: "cancelSchedule",
          raw_data: JSON.stringify(updatedScheduleHeaders),
          description: `Cancelled Schedule Headers: ${scheduleIds.join(", ")}`,
          status_id: 1,
        },
        userId,
      );

      const responses = updatedScheduleHeaders.map((schedule) =>
        this.responseMapperService.mapEntityToResponse(schedule),
      );

      try {
        for (const schedule of updatedScheduleHeaders) {
          await this.actionLogsService.logAction({
            module_name: this.module_name,
            ref_id: schedule.id,
            action_id: ACTION_IDS.CANCEL,
            description: `Cancel Schedule Reason: ${updateScheduleDto.reason}`,
            raw_data: JSON.stringify(schedule),
            created_by: userId,
          });
        }
      } catch (err) {
        logger.error("Action log failed for Cancel Schedule:", err);
      }

      for (const response of responses) {
        try {
          this.sseEventEmitter.emitUpdate(
            "staff_scheduling",
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

      logger.error("Failed to cancel schedule headers:", error);

      throw new Error("Failed to cancel schedule headers");
    }
  }

  async findOneHistory(ref_id: number) {
    return this.actionLogsService.findPerModuleRefID(this.module_name, ref_id);
  }

  async uploadExcel(
    file: Express.Multer.File,
    schedule_date: string,
    userId: number,
    accessKeyId?: number,
  ) {
    const workbook = XLSX.readFile(file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const headers = [
      "ifs_code",
      "store",
      "staff_code",
      "staff_name",
      "duty_start_date",
      "duty_start_time",
      "duty_end_date",
      "duty_end_time",
      "remarks",
      "working_day",
    ];

    if (!schedule_date || String(schedule_date).trim() === "") {
      throw new BadRequestException("Schedule date is required.");
    }

    const scheduleDate = String(schedule_date).substring(0, 10);

    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
      header: headers,
      dateNF: "yyyy-mm-dd",
      range: 2,
      raw: false,
      defval: null,
    });

    const success = [];
    const errors = [];

    if (!rows.length) {
      throw new BadRequestException("Excel file contains no schedule entries.");
    }

    const requiredFields = [
      "ifs_code",
      "store",
      "staff_code",
      "staff_name",
      "duty_start_date",
      "duty_start_time",
      "duty_end_date",
      "duty_end_time",
      "working_day",
    ];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const missingFields = requiredFields.filter(
        (field) =>
          row[field] === null ||
          row[field] === undefined ||
          String(row[field]).trim() === "",
      );

      if (missingFields.length > 0) {
        errors.push({
          row: i + 3,
          error: `Missing required field(s): ${missingFields.join(", ")}`,
        });
      }
    }

    const staffCodes = [
      ...new Set(rows.map((row) => String(row.staff_code).trim())),
    ];

    const staffList = await this.staffRepository.find({
      where: {
        staff_code: In(staffCodes),
      },
    });

    const staffMap = new Map(
      staffList.map((staff) => [String(staff.staff_code).trim(), staff]),
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const staffCode = String(row.staff_code).trim();
      const staff = staffMap.get(staffCode);

      if (!staff) {
        errors.push({
          row: i + 3,
          error: `Staff with Staff Code '${staffCode}' not found`,
        });
      }
    }

    const warehouseNames = [
      ...new Set(rows.map((row) => String(row.store).trim())),
    ];
    const ifsCodes = [
      ...new Set(rows.map((row) => String(row.ifs_code).trim())),
    ];

    const warehouseList = await this.warehouseRepository.find({
      where: {
        warehouse_name: In(warehouseNames),
        warehouse_ifs: In(ifsCodes),
      },
    });

    const warehouseMap = new Map(
      warehouseList.map((warehouse) => [
        String(warehouse.warehouse_name).trim(),
        warehouse,
      ]),
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const warehouseName = String(row.store).trim();

      const ifsCode = String(row.ifs_code).trim();
      const warehouse = warehouseMap.get(ifsCode);

      if (!warehouse) {
        errors.push({
          row: i + 3,
          error: `Warehouse '${warehouseName}' not found`,
        });
      }
    }
    const staffIds = staffList.map((staff) => staff.id);
    const warehouseIds = warehouseList.map((warehouse) => warehouse.id);

    const approvedStaffWarehouses =
      staffIds.length > 0 && warehouseIds.length > 0
        ? await this.staffWarehouseRepository
            .createQueryBuilder("sw")
            .where("sw.staff_id IN (:...staffIds)", {
              staffIds,
            })
            .andWhere("sw.warehouse_id IN (:...warehouseIds)", {
              warehouseIds,
            })
            .andWhere("sw.approval_status_id = :approvedStatus", {
              approvedStatus: STATUS_IDS.APPROVED,
            })
            .andWhere("sw.effectivity_date <= :scheduleDate", {
              scheduleDate,
            })
            .andWhere("(sw.end_date IS NULL OR sw.end_date >= :scheduleDate)", {
              scheduleDate,
            })
            .getMany()
        : [];

    // Exact STAFF + WAREHOUSE combination
    const staffWarehouseMap = new Map(
      approvedStaffWarehouses.map((assignment) => [
        `${assignment.staff_id}-${assignment.warehouse_id}`,
        assignment,
      ]),
    );

    const validRows = new Set<number>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const staffCode = String(row.staff_code).trim();
      const warehouseName = String(row.store).trim();

      const staff = staffMap.get(staffCode);
      const warehouse = warehouseMap.get(warehouseName);

      // Already invalid from previous validation
      if (!staff || !warehouse) {
        continue;
      }

      const assignmentKey = `${staff.id}-${warehouse.id}`;

      const staffWarehouse = staffWarehouseMap.get(assignmentKey);

      if (!staffWarehouse) {
        const staffName =
          staff.first_name && staff.last_name
            ? `${staff.first_name} ${staff.last_name}`
            : staffCode;

        errors.push({
          row: i + 3,
          error:
            `Staff '${staffName}' (${staffCode}) cannot be scheduled ` +
            `at warehouse '${warehouseName}' for schedule date ` +
            `'${scheduleDate}'. The staff must have an APPROVED ` +
            `Staff Warehouse assignment that is effective on the schedule date.`,
        });

        continue;
      }

      // This row passed StaffWarehouse validation
      validRows.add(i);
    }

    const details = [];

    // Keep track of the exact Excel row for success response
    const detailRows = new Map<number, number>();

    for (let i = 0; i < rows.length; i++) {
      // Skip rows that failed StaffWarehouse validation
      if (!validRows.has(i)) {
        continue;
      }

      const row = rows[i];

      const staffCode = String(row.staff_code).trim();
      const warehouseName = String(row.store).trim();

      const staff = staffMap.get(staffCode);
      const warehouse = warehouseMap.get(warehouseName);

      if (!staff || !warehouse) {
        continue;
      }

      // DUTY START

      const dutyStartTime = this.combineExcelDateTime(
        row.duty_start_date,
        row.duty_start_time,
      );

      // DUTY END
      const dutyEndTime = this.combineExcelDateTime(
        row.duty_end_date,
        row.duty_end_time,
      );

      if (!dutyStartTime || !dutyEndTime) {
        errors.push({
          row: i + 3,
          error:
            `Invalid duty start/end date or time ` +
            `for Staff Code '${staffCode}'.`,
        });

        continue;
      }

      // DUTY TIME COMPARISON

      if (dutyStartTime >= dutyEndTime) {
        const staffName =
          staff.first_name && staff.last_name
            ? `${staff.first_name} ${staff.last_name}`
            : staffCode;

        errors.push({
          row: i + 3,
          error:
            `Invalid duty time for ${staffName}: ` +
            `duty start time must be earlier than duty end time.`,
        });

        continue;
      }

      // ADD VALID DETAIL
      details.push({
        staff_id: staff.id,
        staff_code: staff.staff_code,
        warehouse_id: warehouse.id,
        remarks: row.remarks ? String(row.remarks).trim() : null,
        duty_start_time: dutyStartTime,
        duty_end_time: dutyEndTime,
        operational_start_time: null,
        operational_end_time: null,
        diff_outlet: null,
        add_ot: null,
        starting_time: null,
        ending_time: null,
        working_day_id: row.working_day,
        actual_logs_detail_id: null,
      });

      // Remember which Excel row created this detail
      detailRows.set(details.length - 1, i);
    }

    if (!details.length) {
      return {
        inserted_count: 0,
        updated_count: 0,
        inserted_row_numbers: [],
        updated_row_numbers: [],
        success: [],
        errors,
      };
    }

    for (let detailIndex = 0; detailIndex < details.length; detailIndex++) {
      const rowIndex = detailRows.get(detailIndex);

      if (rowIndex === undefined) {
        continue;
      }

      const row = rows[rowIndex];

      const detail = details[detailIndex];

      const createScheduleDto: CreateScheduleHeaderDto = {
        schedule_date: scheduleDate,
        entry_no: 1,
        reason: null,
        shifting_day: null,
        details: [detail],
      };

      try {
        const result = await this.create(
          createScheduleDto,
          userId,
          accessKeyId,
        );

        const staffCode = String(row.staff_code).trim();
        const warehouseName = String(row.store).trim();
        const staff = staffMap.get(staffCode);

        success.push({
          row: rowIndex + 3,
          action: "inserted",
          message: "Schedule created successfully",
          data: {
            staff_name: staff
              ? `${staff.first_name} ${staff.last_name}`
              : staffCode,
            staff_code: staffCode,
            warehouse: {
              warehouse_name: warehouseName,
            },
            duty_start_date: row.duty_start_date,
            duty_start_time: row.duty_start_time,
            duty_end_date: row.duty_end_date,
            duty_end_time: row.duty_end_time,
            working_day: row.working_day,
            schedule_header_id: result.id,
          },
        });
      } catch (error) {
        let errorMessage = "Failed to create schedule";

        if (error instanceof BadRequestException) {
          const response = error.getResponse();

          if (typeof response === "string") {
            errorMessage = response;
          } else if (
            typeof response === "object" &&
            response !== null &&
            "message" in response
          ) {
            const message = (response as any).message;

            if (Array.isArray(message)) {
              errorMessage = message.join(", ");
            } else {
              errorMessage = String(message);
            }
          }
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }

        try {
          const parsed = JSON.parse(errorMessage);

          if (parsed?.type === "SCHEDULE_CONFLICT") {
            errorMessage = parsed.message || errorMessage;

            errors.push({
              row: rowIndex + 3,
              error: errorMessage,
              conflict: parsed,
            });
          } else {
            errors.push({
              row: rowIndex + 3,
              error: errorMessage,
            });
          }
        } catch {
          errors.push({
            row: rowIndex + 3,
            error: errorMessage,
          });
        }
      }
    }

    return {
      inserted_count: success.filter((s) => s.action === "inserted").length,
      updated_count: 0,
      inserted_row_numbers: success
        .filter((s) => s.action === "inserted")
        .map((s) => s.row),
      updated_row_numbers: [],
      success,
      errors,
    };
  }

  private combineExcelDateTime(dateValue: any, timeValue: any): Date | null {
    if (
      dateValue === null ||
      dateValue === undefined ||
      timeValue === null ||
      timeValue === undefined
    ) {
      return null;
    }

    let year: number;
    let month: number;
    let day: number;

    if (typeof dateValue === "number") {
      // Excel serial date
      const parsedDate = XLSX.SSF.parse_date_code(dateValue);

      if (!parsedDate) {
        return null;
      }

      year = parsedDate.y;
      month = parsedDate.m;
      day = parsedDate.d;
    } else {
      const rawDateStr = String(dateValue).trim();

      const slashMatch = rawDateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

      const dashMatch = rawDateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);

      const isoMatch = rawDateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

      if (slashMatch) {
        month = Number(slashMatch[1]);
        day = Number(slashMatch[2]);
        year = Number(slashMatch[3]);
      } else if (dashMatch) {
        month = Number(dashMatch[1]);
        day = Number(dashMatch[2]);
        year = Number(dashMatch[3]);
      } else if (isoMatch) {
        year = Number(isoMatch[1]);
        month = Number(isoMatch[2]);
        day = Number(isoMatch[3]);
      } else {
        return null;
      }

      if (month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
      }

      const testDate = new Date(year, month - 1, day);

      if (
        testDate.getFullYear() !== year ||
        testDate.getMonth() !== month - 1 ||
        testDate.getDate() !== day
      ) {
        return null;
      }
    }
    let hours: number;
    let minutes: number;
    let seconds: number;

    if (typeof timeValue === "number") {
      // Excel time serial
      const parsedTime = XLSX.SSF.parse_date_code(timeValue);

      if (!parsedTime) {
        return null;
      }

      hours = parsedTime.H;
      minutes = parsedTime.M;
      seconds = parsedTime.S;
    } else {
      const timeString = String(timeValue).trim();

      const timeMatch = timeString.match(
        /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i,
      );

      if (!timeMatch) {
        return null;
      }

      hours = Number(timeMatch[1]);
      minutes = Number(timeMatch[2]);
      seconds = Number(timeMatch[3] || 0);

      const meridiem = timeMatch[4]?.toUpperCase();

      if (meridiem) {
        // 12-hour format
        if (hours < 1 || hours > 12) {
          return null;
        }

        if (meridiem === "AM" && hours === 12) {
          hours = 0;
        }

        if (meridiem === "PM" && hours !== 12) {
          hours += 12;
        }
      } else {
        // 24-hour format
        if (hours < 0 || hours > 23) {
          return null;
        }
      }
    }

    if (
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59 ||
      seconds < 0 ||
      seconds > 59
    ) {
      return null;
    }

    const resultDate = new Date(
      year,
      month - 1,
      day,
      hours,
      minutes,
      seconds,
      0,
    );

    if (isNaN(resultDate.getTime())) {
      return null;
    }

    return resultDate;
  }

  private checkIfNightShift(
    endTime: Date,
    scheduleDate: Date,
    startTime: Date,
  ): number {
    const schedDate = dayjs(scheduleDate).format("YYYY-MM-DD");

    const start = dayjs(startTime);
    const end = dayjs(endTime);

    const nightShiftTrigger = dayjs(`${schedDate} 17:00:00`);
    const nightShiftStart = dayjs(`${schedDate} 22:00:00`);

    const midnightShiftStart = dayjs(`${schedDate} 00:00:00`);
    const nightShiftEnd = dayjs(`${schedDate} 06:00:00`);

    const firstShiftStart = dayjs(`${schedDate} 06:00:00`);
    const firstShiftEnd = dayjs(`${schedDate} 14:00:00`);

    const secondShiftStart = dayjs(`${schedDate} 14:00:00`);
    const secondShiftEnd = dayjs(`${schedDate} 22:00:00`);

    // 1 = NIGHT SHIFT
    if (
      (start.isSame(nightShiftTrigger) || start.isAfter(nightShiftTrigger)) &&
      end.isAfter(nightShiftStart)
    ) {
      return 1;
    }

    // 00:00 - 05:59
    else if (
      (start.isSame(midnightShiftStart) || start.isAfter(midnightShiftStart)) &&
      start.isBefore(nightShiftEnd)
    ) {
      if (end.isSame(firstShiftEnd) || end.isAfter(firstShiftEnd)) {
        // 2 = EARLY FIRST SHIFT
        return 2;
      }

      // 1 = NIGHT SHIFT
      return 1;
    }

    // 06:00 - 13:59
    else if (
      (start.isSame(firstShiftStart) || start.isAfter(firstShiftStart)) &&
      start.isBefore(firstShiftEnd)
    ) {
      return 2;
    }

    // 14:00 - 22:00
    else if (
      (start.isSame(secondShiftStart) || start.isAfter(secondShiftStart)) &&
      (start.isSame(secondShiftEnd) || start.isBefore(secondShiftEnd))
    ) {
      // 3 = SECOND SHIFT
      return 3;
    }

    return 0;
  }

  private async checkDutyCount(
    transactionalEntityManager: EntityManager,
    staffId: number,
    scheduleDate: Date,
    excludeScheduleHeaderId?: number,
  ): Promise<boolean> {
    const query = transactionalEntityManager
      .getRepository(ScheduleDetail)
      .createQueryBuilder("detail")
      .innerJoin("detail.scheduleHeader", "header")
      .where("detail.staff_id = :staffId", { staffId })
      .andWhere("header.schedule_date = :scheduleDate", { scheduleDate })
      .andWhere("header.status_id != :cancelledStatusId", {
        cancelledStatusId: STATUS_IDS.CANCELLED,
      });

    if (excludeScheduleHeaderId) {
      query.andWhere("header.id != :excludeScheduleHeaderId", {
        excludeScheduleHeaderId,
      });
    }

    const existingRecord = await query.getOne();

    return !!existingRecord;
  }

  async syncDwsSchedulesByDate(
    scheduleDateStr: string,
    userId: number = 1,
  ): Promise<any> {
    const url = process.env.DWS_FST_API_URL;

    const response = await firstValueFrom(
      this.httpService.post(
        url,
        { date: scheduleDateStr },
        {
          headers: {
            "x-api-key": process.env.DWS_API_KEY,
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const apiRecords: any[] = response.data;

    if (!Array.isArray(apiRecords) || apiRecords.length === 0) {
      logger.warn(
        `[StaffSchedulingService] No records returned from DWS for date: ${scheduleDateStr}`,
      );

      return null;
    }

    /*
     * ============================================================
     * 1. GET STAFF FROM DWS CREW_ID
     * ============================================================
     */

    const staffIds = [
      ...new Set(
        apiRecords
          .map((record) => Number(record["CREW_ID"]))
          .filter((id) => !isNaN(id) && id > 0),
      ),
    ];

    if (staffIds.length === 0) {
      logger.warn(
        `[StaffSchedulingService] No valid CREW_ID found from DWS for date: ${scheduleDateStr}`,
      );

      return null;
    }

    const staffs = await this.staffRepository.find({
      where: staffIds.map((id) => ({
        old_dws_id: id,
      })),
      relations: ["status"],
    });

    /*
     * Map DWS CREW_ID -> Staff
     */
    const staffMap = new Map<number, Staff>();

    staffs.forEach((staff) => {
      if (staff.old_dws_id) {
        staffMap.set(staff.old_dws_id, staff);
      }
    });

    /*
     * ============================================================
     * 2. PROCESS EACH DWS RECORD
     * ============================================================
     */

    const details: CreateSchedulingDetailDto[] = [];

    for (const record of apiRecords) {
      const crewId = Number(record["CREW_ID"]);

      /*
       * ----------------------------------------------------------
       * Get schedule date first because the StaffWarehouse
       * assignment must be effective for this date.
       * ----------------------------------------------------------
       */
      const dutyDate = record["SCHEDULE_DATE"] || scheduleDateStr;

      /*
       * ----------------------------------------------------------
       * VALIDATION #1
       * Staff must exist
       * ----------------------------------------------------------
       */
      const staff = staffMap.get(crewId);

      if (!staff) {
        logger.warn(
          `[StaffSchedulingService] Skipping DWS record #${
            record["NO"] || ""
          }: Staff not found. CREW_ID=${crewId}`,
        );

        continue;
      }

      /*
       * ----------------------------------------------------------
       * VALIDATION #2
       * Staff must be ACTIVE
       * ----------------------------------------------------------
       */
      if (staff.status_id !== STATUS_IDS.ACTIVE) {
        logger.warn(
          `[StaffSchedulingService] Skipping DWS record #${
            record["NO"] || ""
          }: Staff is not ACTIVE. CREW_ID=${crewId}, STAFF_ID=${staff.id}, STATUS_ID=${staff.status_id}`,
        );

        continue;
      }

      const staffWarehouse = await this.staffWarehouseRepository.findOne({
        where: {
          staff_id: staff.id,
          status_id: STATUS_IDS.ACTIVE,
          approval_status_id: STATUS_IDS.APPROVED,
        },
        order: {
          effectivity_date: "DESC",
        },
      });

      if (!staffWarehouse) {
        logger.warn(
          `[StaffSchedulingService] Skipping DWS record #${
            record["NO"] || ""
          }: No active/approved StaffWarehouse assignment found. CREW_ID=${crewId}, STAFF_ID=${staff.id}`,
        );

        continue;
      }

      /*
       * ============================================================
       * 4. VALIDATE EFFECTIVITY DATE
       * ============================================================
       *
       * Valid when:
       *
       * effectivity_date <= schedule date
       *
       * AND
       *
       * end_date IS NULL
       * OR
       * end_date >= schedule date
       */

      const scheduleDate = dayjs(dutyDate).startOf("day");

      const effectivityDate = staffWarehouse.effectivity_date
        ? dayjs(staffWarehouse.effectivity_date).startOf("day")
        : null;

      const endDate = staffWarehouse.end_date
        ? dayjs(staffWarehouse.end_date).startOf("day")
        : null;

      /*
       * Effectivity date is required.
       */
      if (!effectivityDate) {
        logger.warn(
          `[StaffSchedulingService] Skipping DWS record #${
            record["NO"] || ""
          }: StaffWarehouse has no effectivity date. CREW_ID=${crewId}, STAFF_ID=${staff.id}, STAFF_WAREHOUSE_ID=${staffWarehouse.id}`,
        );

        continue;
      }

      /*
       * Schedule date must not be before effectivity date.
       */
      if (scheduleDate.isBefore(effectivityDate)) {
        logger.warn(
          `[StaffSchedulingService] Skipping DWS record #${
            record["NO"] || ""
          }: StaffWarehouse assignment is not yet effective. CREW_ID=${crewId}, STAFF_ID=${staff.id}, STAFF_WAREHOUSE_ID=${staffWarehouse.id}, EFFECTIVITY_DATE=${staffWarehouse.effectivity_date}, SCHEDULE_DATE=${dutyDate}`,
        );

        continue;
      }

      /*
       * If there is an end date, schedule date must not be
       * after the end date.
       */
      if (endDate && scheduleDate.isAfter(endDate)) {
        logger.warn(
          `[StaffSchedulingService] Skipping DWS record #${
            record["NO"] || ""
          }: StaffWarehouse assignment already ended. CREW_ID=${crewId}, STAFF_ID=${staff.id}, STAFF_WAREHOUSE_ID=${staffWarehouse.id}, END_DATE=${staffWarehouse.end_date}, SCHEDULE_DATE=${dutyDate}`,
        );

        continue;
      }

      /*
       * ============================================================
       * 5. VALIDATE PROPER ASSIGNMENT
       * ============================================================
       */

      if (!staffWarehouse.warehouse_id) {
        logger.warn(
          `[StaffSchedulingService] Skipping DWS record #${
            record["NO"] || ""
          }: StaffWarehouse has no warehouse assignment. CREW_ID=${crewId}, STAFF_ID=${staff.id}, STAFF_WAREHOUSE_ID=${staffWarehouse.id}`,
        );

        continue;
      }

      if (!staffWarehouse.location_id) {
        logger.warn(
          `[StaffSchedulingService] Skipping DWS record #${
            record["NO"] || ""
          }: StaffWarehouse has no location assignment. CREW_ID=${crewId}, STAFF_ID=${staff.id}, STAFF_WAREHOUSE_ID=${staffWarehouse.id}`,
        );

        continue;
      }

      if (!staffWarehouse.vendor_id) {
        logger.warn(
          `[StaffSchedulingService] Skipping DWS record #${
            record["NO"] || ""
          }: StaffWarehouse has no vendor assignment. CREW_ID=${crewId}, STAFF_ID=${staff.id}, STAFF_WAREHOUSE_ID=${staffWarehouse.id}`,
        );

        continue;
      }

      /*
       * ============================================================
       * 6. PARSE DUTY TIME
       * ============================================================
       */

      const startTime = this.parseDwsDateTime(
        dutyDate,
        record["SCHEDULE_START_TIME"] || record["TIME_IN"],
      );

      let endTime = this.parseDwsDateTime(
        dutyDate,
        record["SCHEDULE_END_TIME"] || record["TIME_OUT"],
      );

      if (!startTime || !endTime) {
        logger.warn(
          `[StaffSchedulingService] Skipping DWS record #${
            record["NO"] || ""
          }: Invalid duty start/end time. CREW_ID=${crewId}, STAFF_ID=${staff.id}`,
        );

        continue;
      }

      /*
       * ============================================================
       * 7. OVERNIGHT SHIFT ADJUSTMENT
       * ============================================================
       */

      if (
        dayjs(endTime).isBefore(dayjs(startTime)) ||
        dayjs(endTime).isSame(dayjs(startTime))
      ) {
        endTime = dayjs(endTime).add(1, "day").toDate();
      }

      /*
       * ============================================================
       * 8. PARSE ACTUAL DWS TIME LOGS
       * ============================================================
       */

      const time_in = this.parseDwsDateTime(dutyDate, record["TIME_IN"]);

      let time_out = this.parseDwsDateTime(dutyDate, record["TIME_OUT"]);

      let breakStart = this.parseDwsDateTime(dutyDate, record["BREAK_IN"]);

      let breakEnd = this.parseDwsDateTime(dutyDate, record["BREAK_OUT"]);

      let overtimeIn = this.parseDwsDateTime(dutyDate, record["OVERTIME_IN"]);

      let overtimeOut = this.parseDwsDateTime(dutyDate, record["OVERTIME_OUT"]);

      /*
       * ============================================================
       * KEEP ORIGINAL DWS VALUES
       * ============================================================
       */

      const origTimeIn = time_in;
      const origTimeOut = time_out;
      const origBreakIn = breakStart;
      const origBreakOut = breakEnd;

      /*
       * ============================================================
       * 8.2 OVERNIGHT ACTUAL TIME ADJUSTMENT
       * ============================================================
       *
       * Example:
       *
       */

      const isOvernightShift =
        dayjs(endTime).date() !== dayjs(startTime).date();

      if (isOvernightShift) {
        const adjustIfNextDay = (value: Date | null): Date | null => {
          if (!value) {
            return null;
          }

          const parsed = dayjs(value);

          /*
           * If the actual time is earlier than the scheduled
           * start time, it belongs to the following day.
           */
          if (parsed.isBefore(dayjs(startTime))) {
            return parsed.add(1, "day").toDate();
          }

          return value;
        };

        time_out = adjustIfNextDay(time_out);
        breakStart = adjustIfNextDay(breakStart);
        breakEnd = adjustIfNextDay(breakEnd);
        overtimeIn = adjustIfNextDay(overtimeIn);
        overtimeOut = adjustIfNextDay(overtimeOut);
      }

      /*
       * ============================================================
       * 8.3 VALIDATE ACTUAL WORKING HOURS
       * ============================================================
       *
       * RULE:
       *
       * 1. If TIME_IN or TIME_OUT is missing:
       *    No adjustment.
       *
       * 2. If duration is 8 hours or less:
       *    just_* = orig_*
       *
       * 3. If duration is MORE THAN 8 hours AND there is
       *    NO COMPLETE BREAK:
       *    Deduct 1 hour from just_time_out only.
       *
       * 4. If a complete BREAK_IN and BREAK_OUT exists:
       *    No automatic deduction.
       *
       * IMPORTANT:
       * orig_* always remains the original DWS value.
       */

      if (time_in && time_out) {
        const durationMinutes = dayjs(time_out).diff(dayjs(time_in), "minute");

        const hasCompleteBreak = !!breakStart && !!breakEnd;

        /*
         * More than 8 hours without a complete break.
         */
        if (durationMinutes > 9 * 60 && !hasCompleteBreak) {
          time_out = dayjs(time_out).subtract(1, "hour").toDate();

          logger.warn(
            `[StaffSchedulingService] Automatically deducted 1 hour due to work duration exceeding 8 hours without a complete break. ` +
              `CREW_ID=${crewId}, ` +
              `STAFF_ID=${staff.id}, ` +
              `ORIG_TIME_IN=${origTimeIn?.toISOString() || "NULL"}, ` +
              `ORIG_TIME_OUT=${origTimeOut?.toISOString() || "NULL"}, ` +
              `ADJUSTED_TIME_OUT=${time_out.toISOString()}, ` +
              `BREAK_IN=${origBreakIn?.toISOString() || "NULL"}, ` +
              `BREAK_OUT=${origBreakOut?.toISOString() || "NULL"}`,
          );
        }
      }

      /*
       * ============================================================
       * 9. PARSE HOURS
       * ============================================================
       */

      const regularHours = record["REGULAR_HOURS"]
        ? Number(record["REGULAR_HOURS"])
        : 0;

      const breakHours = record["BREAK_HOURS"]
        ? Number(record["BREAK_HOURS"])
        : 0;

      const overtimeHours = record["OVERTIME_HOURS"]
        ? Number(record["OVERTIME_HOURS"])
        : 0;

      const twh = record["NO_OF_HOURS"] ? Number(record["NO_OF_HOURS"]) : 0;

      /*
       * ============================================================
       * 10. CREATE SCHEDULING DETAIL
       * ============================================================
       */
      const nightShiftStart = time_in ?? startTime;
      const nightShiftEnd = time_out ?? endTime;

      const { night_shift_hrs, night_shift } =
        await this.calculateNightShift(
          nightShiftStart,
          nightShiftEnd,
          dutyDate,
        );
  
      details.push({
        staff_id: staff.id,

        warehouse_id: staffWarehouse.warehouse_id,
        location_id: staffWarehouse.location_id,
        vendor_id: staffWarehouse.vendor_id,

        duty_start_time: startTime.toISOString(),
        duty_end_time: endTime.toISOString(),

        just_time_in: time_in ? time_in.toISOString() : undefined,

        just_time_out: time_out ? time_out.toISOString() : undefined,

        just_break_in: breakStart ? breakStart.toISOString() : undefined,

        just_break_out: breakEnd ? breakEnd.toISOString() : undefined,

        /*
         * ========================================================
         * ORIGINAL DWS VALUES
         * ========================================================
         *
         * These ALWAYS contain the original values received
         * from DWS before any automatic adjustment.
         */

        orig_time_in: origTimeIn ? origTimeIn.toISOString() : undefined,

        orig_time_out: origTimeOut ? origTimeOut.toISOString() : undefined,

        orig_break_in: origBreakIn ? origBreakIn.toISOString() : undefined,

        orig_break_out: origBreakOut ? origBreakOut.toISOString() : undefined,

        overtime_in: overtimeIn ? overtimeIn.toISOString() : undefined,

        overtime_out: overtimeOut ? overtimeOut.toISOString() : undefined,

        regular: regularHours,
        break_hours: breakHours,
        overtime: overtimeHours,
        twh: twh,
        night_shift,
        night_shift_hrs,

        remarks: `Auto-synced from DWS log #${record["NO"] || ""}`,
      });
    }

    /*
     * ============================================================
     * 11. NO VALID DETAILS
     * ============================================================
     */

    if (details.length === 0) {
      logger.warn(
        `[StaffSchedulingService] No valid detail rows to process for date: ${scheduleDateStr}`,
      );

      return null;
    }

    /*
     * ============================================================
     * 12. FILTER INTERNAL STAFF SCHEDULE COLLISIONS
     * ============================================================
     */

    const safeDetails = this.filterInternalScheduleCollisions(details);

    if (safeDetails.length === 0) {
      logger.warn(
        `[StaffSchedulingService] All DWS detail rows were removed because of internal schedule collisions. Date: ${scheduleDateStr}`,
      );

      return null;
    }

    /*
     * ============================================================
     * 13. CREATE HEADER
     * ============================================================
     */

    const headerDto: CreateScheduleHeaderDto = {
      schedule_date: scheduleDateStr,
      entry_no: safeDetails.length,
      reason: "DWS Daily Automated Sync",
      shifting_day: 1,
      details: safeDetails,
    };

    /*
     * ============================================================
     * 14. AUTO-ENROLL ACCESS KEY
     * ============================================================
     */

    const accessKeyId = ACCESS_KEY_IDS.BOUNTY_PLUS_ACCESS;

    return await this.upsertDwsSchedules(
      scheduleDateStr,
      safeDetails,
      userId,
      accessKeyId,
    );

    // return await this.create(headerDto, userId, accessKeyId);
  }

  private filterInternalScheduleCollisions(
    details: CreateSchedulingDetailDto[],
  ): CreateSchedulingDetailDto[] {
    const accepted: CreateSchedulingDetailDto[] = [];

    for (const item of details) {
      const itemStart = new Date(item.duty_start_time).getTime();
      const itemEnd = new Date(item.duty_end_time).getTime();

      const hasConflict = accepted.some((existing) => {
        if (existing.staff_id !== item.staff_id) return false;
        const existStart = new Date(existing.duty_start_time).getTime();
        const existEnd = new Date(existing.duty_end_time).getTime();
        return itemStart < existEnd && itemEnd > existStart;
      });

      if (!hasConflict) {
        accepted.push(item);
      }
    }

    return accepted;
  }

  private parseDwsDateTime(
    dateStr: string,
    timeStr: string,
    nextDayIfEarlier: boolean = false,
    referenceTimeStr?: string,
  ): Date | null {
    if (!dateStr || !timeStr) return null;

    const date = String(dateStr).trim();
    const time = String(timeStr).trim();

    const parsed = dayjs(`${date} ${time}`, "YYYY-MM-DD hh:mm A", true);

    if (!parsed.isValid()) {
      return null;
    }

    // For overnight schedules:
    // If the actual time is earlier than the schedule start time,
    // it belongs to the following day.
    if (nextDayIfEarlier && referenceTimeStr) {
      const reference = dayjs(
        `${date} ${String(referenceTimeStr).trim()}`,
        "YYYY-MM-DD hh:mm A",
        true,
      );

      if (reference.isValid() && parsed.isBefore(reference)) {
        return parsed.add(1, "day").toDate();
      }
    }

    return parsed.toDate();
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

  while (
    currentDay.isBefore(lastDay) ||
    currentDay.isSame(lastDay, "day")
  ) {
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
      const overlapStart = start.isAfter(windowStart)
        ? start
        : windowStart;

      const overlapEnd = end.isBefore(windowEnd)
        ? end
        : windowEnd;

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

  private async createScheduleHeaderHistory(
    transactionalEntityManager: any,
    scheduleHeader: ScheduleHeader,
    userId: number,
  ): Promise<void> {
    const scheduleHeaderHistory = transactionalEntityManager.create(
      ScheduleHeaderHistory,
      {
        schedule_header_id: scheduleHeader.id,
        schedule_date: scheduleHeader.schedule_date,
        entry_no: scheduleHeader.entry_no,
        shifting_day: scheduleHeader.shifting_day,
        attendance_status_id: scheduleHeader.attendance_status_id,
        attendance_ts: scheduleHeader.attendance_ts,
        status_id: scheduleHeader.status_id,
        access_key_id: scheduleHeader.access_key_id,
        created_by: userId,
        updated_by: userId,
      },
    );

    await transactionalEntityManager.save(
      ScheduleHeaderHistory,
      scheduleHeaderHistory,
    );
  }

  async generateReportScheduleDetails(
    payrollHeaderId?: number,
    accessKeyId?: number,
    dateFrom?: string,
    dateTo?: string,
    locationIds?: number[],
    vendorIds?: number[],
  ): Promise<{ data: any[]; totals: any }> {
    try {
      const query = this.payrollDetailRepository
        .createQueryBuilder("payrollDetail")
        .leftJoinAndSelect("payrollDetail.payrollHeader", "payrollHeader")
        .leftJoinAndSelect("payrollDetail.staff", "staff")
        .leftJoinAndSelect("payrollDetail.vendor", "vendor")
        .leftJoinAndSelect("payrollDetail.location", "location")
        .leftJoinAndSelect("payrollDetail.warehouse", "warehouse")
        .leftJoinAndSelect("payrollDetail.status", "status")
        .leftJoinAndSelect("payrollDetail.workingDays", "workingDay")
        .leftJoinAndSelect("payrollDetail.createdBy", "createdBy")
        .leftJoinAndSelect("payrollDetail.updatedBy", "updatedBy");

      query.andWhere("payrollHeader.status_id = :postedStatus", {
        postedStatus: STATUS_IDS.POSTED,
      });

      if (payrollHeaderId !== undefined) {
        query.andWhere("payrollDetail.payroll_header_id = :payrollHeaderId", {
          payrollHeaderId,
        });
      }

      if (accessKeyId !== undefined) {
        query.andWhere("payrollHeader.access_key_id = :accessKeyId", {
          accessKeyId,
        });
      }

      if (dateFrom !== undefined) {
        query.andWhere("DATE(payrollDetail.schedule_date) >= :dateFrom", {
          dateFrom,
        });
      }

      if (dateTo !== undefined) {
        query.andWhere("DATE(payrollDetail.schedule_date) <= :dateTo", {
          dateTo,
        });
      }

      if (locationIds !== undefined && locationIds.length > 0) {
        query.andWhere("payrollDetail.location_id IN (:...locationIds)", {
          locationIds,
        });
      }

      if (vendorIds !== undefined && vendorIds.length > 0) {
        query.andWhere("payrollDetail.vendor_id IN (:...vendorIds)", {
          vendorIds,
        });
      }

      query
        .orderBy("payrollDetail.schedule_date", "ASC")
        .addOrderBy("warehouse.warehouse_name", "ASC")
        .addOrderBy("payrollDetail.location_id", "ASC")
        .addOrderBy("payrollDetail.id", "ASC");

      const payrollDetails = await query.getMany();

      const emptyTotals = {
        regular: "0.00",
        overtime: "0.00",
        regular_amount: "0.00",
        overtime_amount: "0.00",
        regular_day: "0.00",
        rest_day: "0.00",
        special_holiday: "0.00",
        regular_holiday: "0.00",
        total_day_work: "0.00",
        ot_regular_day: "0.00",
        ot_rest_day: "0.00",
        ot_special_holiday: "0.00",
        ot_regular_holiday: "0.00",
        total_ot_day_work: "0.00",
        gross_pay: "0.00",
        thirteen_month_pay: "0.00",
        sss_share: "0.00",
        pag_ibig_share: "0.00",
        phil_health_share: "0.00",
        total_govt: "0.00",
        total_payroll: "0.00",
        asf: "0.00",
        total_asf: "0.00",
        allowance: "0.00",
        total_allowance: "0.00",
        vat: "0.00",
        total_with_vat: "0.00",
        tax: "0.00",
        net_of_tax: "0.00",
        cash_bond: "0.00",
        total_billing: "0.00",
        total_night_shift: "0.00",
        total_night_shift_amount: "0.00",
      };

      if (!payrollDetails.length) {
        return { data: [], totals: emptyTotals };
      }

      // Group Details by Staff
      const groupedDetails = new Map<number, typeof payrollDetails>();
      for (const detail of payrollDetails) {
        const staffId = detail.staff_id;
        if (!staffId) continue;
        if (!groupedDetails.has(staffId)) {
          groupedDetails.set(staffId, []);
        }
        groupedDetails.get(staffId)!.push(detail);
      }

      // Build Staff Summaries
      const staffSummaryMap = new Map<number, any>();

      for (const detail of payrollDetails) {
        const staffId = detail.staff_id;
        if (!staffId) continue;

        if (!staffSummaryMap.has(staffId)) {
          staffSummaryMap.set(staffId, {
            regular: 0,
            overtime: 0,
            twh: 0,
            break: 0,
            gross_pay: 0,
            regular_day: 0,
            special_holiday: 0,
            regular_holiday: 0,
            rest_day: 0,
            total_day_work: 0,
            ot_regular_day: 0,
            ot_special_holiday: 0,
            ot_regular_holiday: 0,
            ot_rest_day: 0,
            total_ot_day_work: 0,
            thirteen_month_pay: 0,
            sss_share: 0,
            pag_ibig_share: 0,
            phil_health_share: 0,
            total_payroll: 0,
            asf: 0,
            total_asf: 0,
            allowance: 0,
            total_allowance: 0,
            vat: 0,
            total_with_vat: 0,
            tax: 0,
            net_of_tax: 0,
            cash_bond: 0,
            total_billing: 0,
            regular_amount: 0,
            overtime_amount: 0,
            night_shift: 0,
            night_shift_amount: 0,
          });
        }

        const summary = staffSummaryMap.get(staffId)!;

        summary.regular += Number(detail.regular) || 0;
        summary.overtime += Number(detail.overtime) || 0;
        summary.twh += Number(detail.twh) || 0;
        summary.break += Number(detail.break) || 0;

        summary.night_shift += Number(detail.night_shift) || 0;
        summary.night_shift_amount += Number(detail.night_shift_amount) || 0;

        summary.gross_pay += Number(detail.gross_pay) || 0;
        summary.regular_day += Number(detail.regular_day) || 0;
        summary.special_holiday += Number(detail.special_holiday) || 0;
        summary.regular_holiday += Number(detail.regular_holiday) || 0;
        summary.rest_day += Number(detail.rest_day) || 0;
        summary.total_day_work += Number(detail.total_day_work) || 0;

        summary.ot_regular_day += Number(detail.ot_regular_day) || 0;
        summary.ot_special_holiday += Number(detail.ot_special_holiday) || 0;
        summary.ot_regular_holiday += Number(detail.ot_regular_holiday) || 0;
        summary.ot_rest_day += Number(detail.ot_rest_day) || 0;
        summary.total_ot_day_work += Number(detail.total_ot_day_work) || 0;

        summary.thirteen_month_pay += Number(detail.thirteen_month_pay) || 0;
        summary.sss_share += Number(detail.sss_share) || 0;
        summary.pag_ibig_share += Number(detail.pag_ibig_share) || 0;
        summary.phil_health_share += Number(detail.phil_health_share) || 0;

        summary.total_payroll += Number(detail.total_payroll) || 0;
        summary.asf += Number(detail.asf) || 0;
        summary.total_asf += Number(detail.total_asf) || 0;
        summary.allowance += Number(detail.allowance) || 0;
        summary.total_allowance += Number(detail.total_allowance) || 0;
        summary.vat += Number(detail.vat) || 0;
        summary.total_with_vat += Number(detail.total_with_vat) || 0;
        summary.tax += Number(detail.tax) || 0;
        summary.net_of_tax += Number(detail.net_of_tax) || 0;
        summary.cash_bond += Number(detail.cash_bond) || 0;
        summary.total_billing += Number(detail.total_billing) || 0;

        summary.regular_amount += Number(detail.regular_amount) || 0;
        summary.overtime_amount += Number(detail.overtime_amount) || 0;
      }

      // Map rows (one per staff)
      const data = Array.from(groupedDetails.entries()).map(
        ([staffId, details]) => {
          const detail = details[0];
          const staffSummary = staffSummaryMap.get(staffId);

          return {
            id: detail.id,
            payroll_header_id: detail.payroll_header_id,
            schedule_detail_id: detail.schedule_detail_id,

            schedule_date: detail.schedule_date,

            staff_id: staffId,
            staff_code: detail.staff?.staff_code ?? null,
            staff_name: detail.staff
              ? `${detail.staff.first_name ?? ""} ${detail.staff.last_name ?? ""}`.trim()
              : null,

            salary_rate:
              detail.salary_rate !== undefined && detail.salary_rate !== null
                ? Number(detail.salary_rate).toFixed(2)
                : "0.00",

            hour_rate:
              detail.hour_rate !== undefined && detail.hour_rate !== null
                ? Number(detail.hour_rate).toFixed(2)
                : "0.00",

            vendor_id: detail.vendor_id,
            location_id: detail.location_id,
            warehouse_id: detail.warehouse_id,

            warehouse_ifs: detail.warehouse?.warehouse_name ?? null,

            duty_start_time: detail.duty_start_time,
            duty_end_time: detail.duty_end_time,

            planned_duty_start_time: detail.planned_duty_start_time,
            planned_duty_end_time: detail.planned_duty_end_time,

            just_time_in: detail.just_time_in,
            overtime_in: detail.overtime_in,
            overtime_out: detail.overtime_out,
            just_time_out: detail.just_time_out,

            just_break_out: detail.just_break_out,
            just_break_in: detail.just_break_in,

            actual_time_in: detail.actual_time_in,
            actual_time_out: detail.actual_time_out,
            actual_break_in: detail.actual_break_in,
            actual_break_out: detail.actual_break_out,

            add_ot: detail.add_ot,

            working_day_id: detail.working_day_id,
            status_id: detail.status_id,
            attendance_status_id: detail.attendance_status_id,

            created_by: detail.created_by,
            updated_by: detail.updated_by,

            just_remarks: detail.just_remarks,
            payroll_remarks: detail.payroll_remarks,

            regular: staffSummary.regular.toFixed(2),
            overtime: staffSummary.overtime.toFixed(2),
            twh: staffSummary.twh.toFixed(2),
            break: staffSummary.break.toFixed(2),

            regular_hours: detail.regular_hours,
            overtime_hours: detail.overtime_hours,
            twh_hours: detail.twh_hours,
            break_hours: detail.break_hours,
            night_shift_hrs: detail.night_shift_hrs ?? "00:00:00",
            night_shift: detail.night_shift,
            created_at: detail.created_at,
            modified_at: detail.modified_at,

            // ============================================================
            // DETAIL COMPUTATION
            // ============================================================
            regular_amount: staffSummary.regular_amount.toFixed(2),
            overtime_amount: staffSummary.overtime_amount.toFixed(2),

            gross_pay: staffSummary.gross_pay.toFixed(2),

            regular_day: staffSummary.regular_day.toFixed(2),
            special_holiday: staffSummary.special_holiday.toFixed(2),
            regular_holiday: staffSummary.regular_holiday.toFixed(2),
            rest_day: staffSummary.rest_day.toFixed(2),
            total_day_work: staffSummary.total_day_work.toFixed(2),

            ot_regular_day: staffSummary.ot_regular_day.toFixed(2),
            ot_special_holiday: staffSummary.ot_special_holiday.toFixed(2),
            ot_regular_holiday: staffSummary.ot_regular_holiday.toFixed(2),
            ot_rest_day: staffSummary.ot_rest_day.toFixed(2),
            total_ot_day_work: staffSummary.total_ot_day_work.toFixed(2),

            total_night_shift: staffSummary.night_shift.toFixed(2),
            total_night_shift_amount:
              staffSummary.night_shift_amount.toFixed(2),

            thirteen_month_pay: staffSummary.thirteen_month_pay.toFixed(2),

            sss_share: staffSummary.sss_share.toFixed(2),
            pag_ibig_share: staffSummary.pag_ibig_share.toFixed(2),
            phil_health_share: staffSummary.phil_health_share.toFixed(2),

            total_payroll: staffSummary.total_payroll.toFixed(2),

            asf: staffSummary.asf.toFixed(2),
            total_asf: staffSummary.total_asf.toFixed(2),

            allowance: staffSummary.allowance.toFixed(2),
            total_allowance: staffSummary.total_allowance.toFixed(2),

            vat: staffSummary.vat.toFixed(2),
            total_with_vat: staffSummary.total_with_vat.toFixed(2),

            tax: staffSummary.tax.toFixed(2),
            net_of_tax: staffSummary.net_of_tax.toFixed(2),

            cash_bond: staffSummary.cash_bond.toFixed(2),
            total_billing: staffSummary.total_billing.toFixed(2),

            // ============================================================
            // DETAIL LOOKUP NAMES
            // ============================================================
            status_name: detail.status?.status_name ?? null,
            location_name: detail.location?.location_name ?? null,
            warehouse_name: detail.warehouse?.warehouse_name ?? null,
            warehouse_code: detail.warehouse?.warehouse_code ?? null,
            service_provider_name: detail.vendor?.service_provider_name ?? null,
            working_day_name: detail.workingDays?.description ?? null,

            // ============================================================
            // PAYROLL HEADER
            // Stored values - DO NOT recompute from payroll details
            // ============================================================
            payroll_header: detail.payrollHeader
              ? {
                  id: detail.payrollHeader.id,

                  payroll_date_from: detail.payrollHeader.payroll_date_from,
                  payroll_date_to: detail.payrollHeader.payroll_date_to,

                  reason: detail.payrollHeader.reason,
                  remarks: detail.payrollHeader.remarks,
                  payroll_invoice: detail.payrollHeader.payroll_invoice,

                  created_by: detail.payrollHeader.created_by,
                  updated_by: detail.payrollHeader.updated_by,
                  access_key_id: detail.payrollHeader.access_key_id,
                  status_id: detail.payrollHeader.status_id,

                  created_at: detail.payrollHeader.created_at,
                  modified_at: detail.payrollHeader.modified_at,

                  cron_computed: detail.payrollHeader.cron_computed,

                  // ======================================================
                  // HEADER TOTALS
                  // ======================================================
                  total_gross_pay: Number(
                    detail.payrollHeader.total_gross_pay ?? 0,
                  ).toFixed(2),

                  total_regular_day: Number(
                    detail.payrollHeader.total_regular_day ?? 0,
                  ).toFixed(2),

                  total_special_holiday: Number(
                    detail.payrollHeader.total_special_holiday ?? 0,
                  ).toFixed(2),

                  total_regular_holiday: Number(
                    detail.payrollHeader.total_regular_holiday ?? 0,
                  ).toFixed(2),

                  total_rest_day: Number(
                    detail.payrollHeader.total_rest_day ?? 0,
                  ).toFixed(2),

                  total_day_work: Number(
                    detail.payrollHeader.total_day_work ?? 0,
                  ).toFixed(2),

                  total_ot_regular_day: Number(
                    detail.payrollHeader.total_ot_regular_day ?? 0,
                  ).toFixed(2),

                  total_ot_special_holiday: Number(
                    detail.payrollHeader.total_ot_special_holiday ?? 0,
                  ).toFixed(2),

                  total_ot_regular_holiday: Number(
                    detail.payrollHeader.total_ot_regular_holiday ?? 0,
                  ).toFixed(2),

                  total_ot_rest_day: Number(
                    detail.payrollHeader.total_ot_rest_day ?? 0,
                  ).toFixed(2),

                  total_ot_day_work: Number(
                    detail.payrollHeader.total_ot_day_work ?? 0,
                  ).toFixed(2),

                  // ======================================================
                  // HEADER AMOUNT TOTALS
                  // ======================================================
                  total_regular_amount: Number(
                    detail.payrollHeader.total_regular_amount ?? 0,
                  ).toFixed(2),

                  total_rest_day_amount: Number(
                    detail.payrollHeader.total_rest_day_amount ?? 0,
                  ).toFixed(2),

                  total_special_holiday_amount: Number(
                    detail.payrollHeader.total_special_holiday_amount ?? 0,
                  ).toFixed(2),

                  total_regular_holiday_amount: Number(
                    detail.payrollHeader.total_regular_holiday_amount ?? 0,
                  ).toFixed(2),

                  total_regular_holiday_off_amount: Number(
                    detail.payrollHeader.total_regular_holiday_off_amount ?? 0,
                  ).toFixed(2),

                  total_rd_regular_holiday_amount: Number(
                    detail.payrollHeader.total_rd_regular_holiday_amount ?? 0,
                  ).toFixed(2),

                  total_rd_special_holiday_amount: Number(
                    detail.payrollHeader.total_rd_special_holiday_amount ?? 0,
                  ).toFixed(2),

                  total_ot_regular_amount: Number(
                    detail.payrollHeader.total_ot_regular_amount ?? 0,
                  ).toFixed(2),

                  total_ot_rest_day_amount: Number(
                    detail.payrollHeader.total_ot_rest_day_amount ?? 0,
                  ).toFixed(2),

                  total_ot_special_holiday_amount: Number(
                    detail.payrollHeader.total_ot_special_holiday_amount ?? 0,
                  ).toFixed(2),

                  total_ot_regular_holiday_amount: Number(
                    detail.payrollHeader.total_ot_regular_holiday_amount ?? 0,
                  ).toFixed(2),

                  total_ot_rd_regular_holiday_amount: Number(
                    detail.payrollHeader.total_ot_rd_regular_holiday_amount ??
                      0,
                  ).toFixed(2),

                  total_ot_rd_special_holiday_amount: Number(
                    detail.payrollHeader.total_ot_rd_special_holiday_amount ??
                      0,
                  ).toFixed(2),

                  total_overtime_amount: Number(
                    detail.payrollHeader.total_overtime_amount ?? 0,
                  ).toFixed(2),

                  // ======================================================
                  // HEADER GOVERNMENT / PAYROLL TOTALS
                  // ======================================================
                  total_thirteen_month_pay: Number(
                    detail.payrollHeader.total_thirteen_month_pay ?? 0,
                  ).toFixed(2),

                  total_sss_share: Number(
                    detail.payrollHeader.total_sss_share ?? 0,
                  ).toFixed(2),

                  total_pag_ibig_share: Number(
                    detail.payrollHeader.total_pag_ibig_share ?? 0,
                  ).toFixed(2),

                  total_phil_health_share: Number(
                    detail.payrollHeader.total_phil_health_share ?? 0,
                  ).toFixed(2),

                  total_payroll: Number(
                    detail.payrollHeader.total_payroll ?? 0,
                  ).toFixed(2),

                  total_asf: Number(
                    detail.payrollHeader.total_asf ?? 0,
                  ).toFixed(2),

                  total_allowance: Number(
                    detail.payrollHeader.total_allowance ?? 0,
                  ).toFixed(2),

                  total_vat: Number(
                    detail.payrollHeader.total_vat ?? 0,
                  ).toFixed(2),

                  total_with_vat: Number(
                    detail.payrollHeader.total_with_vat ?? 0,
                  ).toFixed(2),

                  total_tax: Number(
                    detail.payrollHeader.total_tax ?? 0,
                  ).toFixed(2),

                  total_net_of_tax: Number(
                    detail.payrollHeader.total_net_of_tax ?? 0,
                  ).toFixed(2),

                  total_cash_bond: Number(
                    detail.payrollHeader.total_cash_bond ?? 0,
                  ).toFixed(2),

                  total_billing: Number(
                    detail.payrollHeader.total_billing ?? 0,
                  ).toFixed(2),

                  // Header status
                  status_name: detail.payrollHeader.status?.status_name ?? null,

                  created_by_name: detail.payrollHeader.createdBy
                    ? `${detail.payrollHeader.createdBy.first_name ?? ""} ${
                        detail.payrollHeader.createdBy.last_name ?? ""
                      }`.trim()
                    : null,

                  updated_by_name: detail.payrollHeader.updatedBy
                    ? `${detail.payrollHeader.updatedBy.first_name ?? ""} ${
                        detail.payrollHeader.updatedBy.last_name ?? ""
                      }`.trim()
                    : null,
                }
              : null,
          };
        },
      );

      // Compute Overall Grand Totals across all staff
      const grandTotalsAcc = Array.from(staffSummaryMap.values()).reduce(
        (acc, curr) => {
          Object.keys(curr).forEach((key) => {
            acc[key] = (acc[key] || 0) + (Number(curr[key]) || 0);
          });
          return acc;
        },
        {},
      );

      const totals = {
        rh_reg: grandTotalsAcc.regular_day?.toFixed(2) ?? "0.00",
        rh_rd: grandTotalsAcc.rest_day?.toFixed(2) ?? "0.00",
        rh_sph: grandTotalsAcc.special_holiday?.toFixed(2) ?? "0.00",
        rh_rh: grandTotalsAcc.regular_holiday?.toFixed(2) ?? "0.00",
        rh_total: grandTotalsAcc.regular?.toFixed(2) ?? "0.00",

        ra_reg: grandTotalsAcc.regular_amount?.toFixed(2) ?? "0.00",
        ra_total: grandTotalsAcc.regular_amount?.toFixed(2) ?? "0.00",

        ot_reg: grandTotalsAcc.ot_regular_day?.toFixed(2) ?? "0.00",
        ot_rd: grandTotalsAcc.ot_rest_day?.toFixed(2) ?? "0.00",
        ot_sph: grandTotalsAcc.ot_special_holiday?.toFixed(2) ?? "0.00",
        ot_rh: grandTotalsAcc.ot_regular_holiday?.toFixed(2) ?? "0.00",
        ot_total: grandTotalsAcc.overtime?.toFixed(2) ?? "0.00",

        ota_total: grandTotalsAcc.overtime_amount?.toFixed(2) ?? "0.00",

        total_night_shift: grandTotalsAcc.night_shift?.toFixed(2) ?? "0.00",

        total_night_shift_amount:
          grandTotalsAcc.night_shift_amount?.toFixed(2) ?? "0.00",

        gross_pay: grandTotalsAcc.gross_pay?.toFixed(2) ?? "0.00",
        thirteen_month: grandTotalsAcc.thirteen_month_pay?.toFixed(2) ?? "0.00",
        sss_ec: grandTotalsAcc.sss_share?.toFixed(2) ?? "0.00",
        phic: grandTotalsAcc.phil_health_share?.toFixed(2) ?? "0.00",
        pagibig: grandTotalsAcc.pag_ibig_share?.toFixed(2) ?? "0.00",
        total_govt: (
          (grandTotalsAcc.sss_share || 0) +
          (grandTotalsAcc.phil_health_share || 0) +
          (grandTotalsAcc.pag_ibig_share || 0)
        ).toFixed(2),
        total_with_govt: grandTotalsAcc.total_payroll?.toFixed(2) ?? "0.00",

        asf: grandTotalsAcc.asf?.toFixed(2) ?? "0.00",
        total_w_asf: grandTotalsAcc.total_asf?.toFixed(2) ?? "0.00",
        allowance: grandTotalsAcc.allowance?.toFixed(2) ?? "0.00",
        total_w_allowance: grandTotalsAcc.total_allowance?.toFixed(2) ?? "0.00",
        vat: grandTotalsAcc.vat?.toFixed(2) ?? "0.00",
        total_w_vat: grandTotalsAcc.total_with_vat?.toFixed(2) ?? "0.00",
        tax: grandTotalsAcc.tax?.toFixed(2) ?? "0.00",
        net_of_tax: grandTotalsAcc.net_of_tax?.toFixed(2) ?? "0.00",
        cash_bond: grandTotalsAcc.cash_bond?.toFixed(2) ?? "0.00",
        total_billing: grandTotalsAcc.total_billing?.toFixed(2) ?? "0.00",
      };

      return { data, totals };
    } catch (error) {
      throw new Error("Failed to fetch staff payroll report");
    }
  }

  private async upsertDwsSchedules(
    scheduleDateStr: string,
    details: CreateSchedulingDetailDto[],
    userId: number,
    accessKeyId: number,
  ): Promise<any> {
    if (!details || details.length === 0) {
      return null;
    }

    /*
     * ============================================================
     * GROUP DWS DETAILS BY LOCATION
     * ============================================================
     *
     * Your existing create() creates a ScheduleHeader per
     * location, so DWS must follow the same structure.
     */

    const detailsByLocation = new Map<number, CreateSchedulingDetailDto[]>();

    for (const detail of details) {
      const locationId = Number(detail.location_id);

      if (!locationId) {
        continue;
      }

      if (!detailsByLocation.has(locationId)) {
        detailsByLocation.set(locationId, []);
      }

      detailsByLocation.get(locationId)!.push(detail);
    }

    if (detailsByLocation.size === 0) {
      return null;
    }

    const results: any[] = [];

    /*
     * ============================================================
     * PROCESS EACH LOCATION
     * ============================================================
     */

    for (const [locationId, locationDetails] of detailsByLocation) {
      try {
        /*
         * ========================================================
         * FIND EXISTING DWS SCHEDULE HEADER
         * ========================================================
         *
         * We look for a header on the same:
         *
         * schedule_date
         * access_key_id
         * location_id
         */

        const existingHeader = await this.scheduleHeaderRepository
          .createQueryBuilder("header")
          .innerJoinAndSelect(
            "header.details",
            "detail",
            "detail.location_id = :locationId",
            {
              locationId,
            },
          )
          .where("DATE(header.schedule_date) = DATE(:scheduleDate)", {
            scheduleDate: scheduleDateStr,
          })
          .andWhere("header.access_key_id = :accessKeyId", {
            accessKeyId,
          })
          .getOne();

        /*
         * ========================================================
         * CREATE NEW HEADER
         * ========================================================
         *
         * If there is no existing schedule for this location,
         * reuse your existing create() method.
         */

        if (!existingHeader) {
          const headerDto: CreateScheduleHeaderDto = {
            schedule_date: scheduleDateStr,

            entry_no: locationDetails.length,

            reason: "DWS Daily Automated Sync",

            shifting_day: 1,

            details: locationDetails,
          };

          const created = await this.create(headerDto, userId, accessKeyId);

          // ============================================================
          // LOAD UPDATED SCHEDULE WITH RELATIONS
          // ============================================================

          const scheduleWithRelations =
            await this.scheduleHeaderRepository.findOne({
              where: {
                id: existingHeader.id,
              },
              relations: [
                "details",
                "details.staff",
                "details.vendor",
                "details.location",
                "details.warehouse",
                "details.workingDays",
                "details.actualLogsDetail",
              ],
            });

          if (!scheduleWithRelations) {
            throw new Error(
              `Failed to retrieve updated schedule header ${existingHeader.id}`,
            );
          }

          // ============================================================
          // SSE
          // ============================================================

          const response = this.responseMapperService.mapEntityToResponse(
            scheduleWithRelations,
          );

          try {
            this.sseEventEmitter.emitUpdate(
              "staff_scheduling",
              response.id,
              response,
            );
            this.sseEventEmitter.emitUpdate(
              "staff_attendance",
              response.id,
              response,
            );
          } catch (err) {
            logger.error(`SSE event failed for Schedule ${response.id}:`, err);
          }

          continue;
        }

        /*
         * ========================================================
         * EXISTING HEADER
         * ========================================================
         */

        const existingDetails = existingHeader.details || [];

        /*
         * Map:
         *
         * staff_id -> ScheduleDetail
         */

        const existingDetailMap = new Map<number, ScheduleDetail>();

        for (const existingDetail of existingDetails) {
          if (existingDetail.staff_id) {
            existingDetailMap.set(
              Number(existingDetail.staff_id),
              existingDetail,
            );
          }
        }

        let updatedCount = 0;
        let createdCount = 0;

        /*
         * ========================================================
         * PROCESS EACH DWS DETAIL
         * ========================================================
         */

        for (const dwsDetail of locationDetails) {
          const staffId = Number(dwsDetail.staff_id);

          if (!staffId) {
            continue;
          }

          const existingDetail = existingDetailMap.get(staffId);

          /*
           * ======================================================
           * UPDATE EXISTING DETAIL
           * ======================================================
           */

          if (existingDetail) {
            /*
             * ----------------------------------------------------
             * UPDATE ACTUAL LOG DETAIL
             * ----------------------------------------------------
             */

            if (existingDetail.actual_logs_detail_id) {
              const actualLogsDetail =
                await this.actualLogsDetailRepository.findOne({
                  where: {
                    id: existingDetail.actual_logs_detail_id,
                  },
                });

              if (actualLogsDetail) {
                const actualLogsDto: CreateActualLogsDetailDto = {
                  staff_id: dwsDetail.staff_id,

                  /*
                   * Your DTO requires staff_code.
                   *
                   * We preserve the existing value.
                   */
                  staff_code: actualLogsDetail.staff_code,

                  remarks: dwsDetail.remarks || actualLogsDetail.remarks,

                  warehouse_id: dwsDetail.warehouse_id,

                  location_id: dwsDetail.location_id,

                  service_provider_id: dwsDetail.vendor_id,

                  access_key_id: accessKeyId,

                  logs_date: scheduleDateStr,

                  time_in: dwsDetail.just_time_in,

                  time_out: dwsDetail.just_time_out,

                  break_in: dwsDetail.just_break_in,

                  break_out: dwsDetail.just_break_out,

                  overtime_in: dwsDetail.overtime_in,

                  overtime_out: dwsDetail.overtime_out,

                  orig_time_in: dwsDetail.orig_time_in,

                  orig_time_out: dwsDetail.orig_time_out,

                  orig_break_in: dwsDetail.orig_break_in,

                  orig_break_out: dwsDetail.orig_break_out,

                  regular: Number(dwsDetail.regular || 0),

                  break_hours: Number(dwsDetail.break_hours || 0),

                  overtime: Number(dwsDetail.overtime || 0),

                  twh: Number(dwsDetail.twh || 0),

                  /*
                   * DWS is the source of the updated log,
                   * so allow it to be processed again.
                   */
                  updated_by: userId,

                  status_id: STATUS_IDS.ACTIVE,
                };

                /*
                 * Copy DTO values into the existing entity.
                 */

                Object.assign(actualLogsDetail, actualLogsDto);

                await this.actualLogsDetailRepository.save(actualLogsDetail);
              }
            }

            /*
             * ----------------------------------------------------
             * UPDATE SCHEDULE DETAIL
             * ----------------------------------------------------
             */

            existingDetail.duty_start_time = new Date(
              dwsDetail.duty_start_time,
            );

            existingDetail.duty_end_time = new Date(dwsDetail.duty_end_time);

            existingDetail.just_time_in = dwsDetail.just_time_in
              ? new Date(dwsDetail.just_time_in)
              : null;

            existingDetail.just_time_out = dwsDetail.just_time_out
              ? new Date(dwsDetail.just_time_out)
              : null;

            existingDetail.just_break_in = dwsDetail.just_break_in
              ? new Date(dwsDetail.just_break_in)
              : null;

            existingDetail.just_break_out = dwsDetail.just_break_out
              ? new Date(dwsDetail.just_break_out)
              : null;

            existingDetail.overtime_in = dwsDetail.overtime_in
              ? new Date(dwsDetail.overtime_in)
              : null;

            existingDetail.overtime_out = dwsDetail.overtime_out
              ? new Date(dwsDetail.overtime_out)
              : null;

            existingDetail.vendor_id = dwsDetail.vendor_id;

            existingDetail.location_id = dwsDetail.location_id;

            existingDetail.warehouse_id = dwsDetail.warehouse_id;

            existingDetail.remarks = dwsDetail.remarks;

            existingDetail.regular = Number(dwsDetail.regular || 0);

            existingDetail.break_hours = String(dwsDetail.break_hours || 0);

            existingDetail.overtime = Number(dwsDetail.overtime || 0);

            existingDetail.twh = Number(dwsDetail.twh || 0);

            existingDetail.night_shift_hrs = dwsDetail.night_shift_hrs || "0";

            existingDetail.night_shift = Number(dwsDetail.night_shift || 0);

            /*
             * DWS changed the schedule/log information.
             *
             * Therefore schedule computation must run again.
             */

            existingDetail.cron_computed = false;

            existingDetail.updated_by = userId;

            await this.scheduleDetailRepository.save(existingDetail);

            updatedCount++;

            continue;
          }

          /*
           * ======================================================
           * CREATE NEW DETAIL
           * ======================================================
           */

          /*
           * ------------------------------------------------------
           * FIND/CREATE ACTUAL LOG HEADER
           * ------------------------------------------------------
           *
           * We use the same tagging concept as your
           * CreateActualLogsHeaderDto.
           */

          let actualLogsHeader = await this.actualLogsHeaderRepository.findOne({
            where: {
              access_key_id: accessKeyId,
            },
            order: {
              id: "DESC",
            },
          });

          if (!actualLogsHeader) {
            const actualLogsHeaderDto: CreateActualLogsHeaderDto = {
              tagging: "DWS DAILY AUTOMATED SYNC",

              logs_type_id: LOGS_TYPE_ID.CC_FETCH,

              access_key_id: accessKeyId,

              status_id: STATUS_IDS.ACTIVE,

              created_by: userId,

              updated_by: userId,
            };

            actualLogsHeader =
              this.actualLogsHeaderRepository.create(actualLogsHeaderDto);

            actualLogsHeader =
              await this.actualLogsHeaderRepository.save(actualLogsHeader);
          }

          /*
           * ------------------------------------------------------
           * CREATE ACTUAL LOG DETAIL
           * ------------------------------------------------------
           *
           * CreateActualLogsDetailDto does not contain
           * night_shift fields, so we do not put them here.
           */

          const actualLogsDetailDto: CreateActualLogsDetailDto = {
            staff_id: dwsDetail.staff_id,

            /*
             * We need staff_code.
             *
             * Since your DWS detail DTO does not contain it,
             * retrieve it from Staff.
             */

            staff_code: "",

            remarks: dwsDetail.remarks || "Auto-synced from DWS",

            warehouse_id: dwsDetail.warehouse_id,

            location_id: dwsDetail.location_id,

            service_provider_id: dwsDetail.vendor_id,

            access_key_id: accessKeyId,

            logs_date: scheduleDateStr,

            time_in: dwsDetail.just_time_in,

            time_out: dwsDetail.just_time_out,

            break_in: dwsDetail.just_break_in,

            break_out: dwsDetail.just_break_out,

            overtime_in: dwsDetail.overtime_in,

            overtime_out: dwsDetail.overtime_out,

            orig_time_in: dwsDetail.orig_time_in,

            orig_time_out: dwsDetail.orig_time_out,

            orig_break_in: dwsDetail.orig_break_in,

            orig_break_out: dwsDetail.orig_break_out,

            regular: Number(dwsDetail.regular || 0),

            break_hours: Number(dwsDetail.break_hours || 0),

            overtime: Number(dwsDetail.overtime || 0),

            twh: Number(dwsDetail.twh || 0),

            created_by: userId,

            updated_by: userId,

            status_id: STATUS_IDS.ACTIVE,
          };

          /*
           * Get staff_code.
           */

          const staff = await this.staffRepository.findOne({
            where: {
              id: dwsDetail.staff_id,
            },
          });

          if (staff) {
            actualLogsDetailDto.staff_code = staff.staff_code;
          }

          const actualLogsDetail =
            this.actualLogsDetailRepository.create(actualLogsDetailDto);

          /*
           * Connect it to the ActualLogsHeader.
           *
           * Your entity already uses actual_header_id based
           * on your existing create() implementation.
           */

          actualLogsDetail.actual_header_id = actualLogsHeader.id;

          const savedActualLogsDetail =
            await this.actualLogsDetailRepository.save(actualLogsDetail);

          /*
           * ------------------------------------------------------
           * CREATE SCHEDULE DETAIL
           * ------------------------------------------------------
           */

          const scheduleDetail = this.scheduleDetailRepository.create({
            schedule_header_id: existingHeader.id,

            staff_id: dwsDetail.staff_id,

            actual_logs_detail_id: savedActualLogsDetail.id,

            vendor_id: dwsDetail.vendor_id,

            location_id: dwsDetail.location_id,

            warehouse_id: dwsDetail.warehouse_id,

            remarks: dwsDetail.remarks,

            duty_start_time: new Date(dwsDetail.duty_start_time),

            duty_end_time: new Date(dwsDetail.duty_end_time),

            just_time_in: dwsDetail.just_time_in
              ? new Date(dwsDetail.just_time_in)
              : null,

            just_time_out: dwsDetail.just_time_out
              ? new Date(dwsDetail.just_time_out)
              : null,

            just_break_in: dwsDetail.just_break_in
              ? new Date(dwsDetail.just_break_in)
              : null,

            just_break_out: dwsDetail.just_break_out
              ? new Date(dwsDetail.just_break_out)
              : null,

            overtime_in: dwsDetail.overtime_in
              ? new Date(dwsDetail.overtime_in)
              : null,

            overtime_out: dwsDetail.overtime_out
              ? new Date(dwsDetail.overtime_out)
              : null,

            regular: Number(dwsDetail.regular || 0),

            // ScheduleDetail.break_hours is STRING
            break_hours: String(dwsDetail.break_hours || 0),

            overtime: Number(dwsDetail.overtime || 0),

            twh: Number(dwsDetail.twh || 0),

            night_shift_hrs: String(dwsDetail.night_shift_hrs || 0.0),

            night_shift: Number(dwsDetail.night_shift || 0),

            working_day_id:
              dwsDetail.working_day_id || WORKING_DAY_IDS.REGULAR_DAY,

            status_id: STATUS_IDS.ACTIVE,

            attendance_status_id: STATUS_IDS.VALIDATED,

            cron_computed: false,

            created_by: userId,

            updated_by: userId,
          });

          await this.scheduleDetailRepository.save(scheduleDetail);

          createdCount++;
        }

        /*
         * ========================================================
         * UPDATE HEADER
         * ========================================================
         *
         * We do NOT delete details that DWS did not return.
         */

        existingHeader.entry_no =
          existingDetails.length +
          locationDetails.filter(
            (detail) => !existingDetailMap.has(Number(detail.staff_id)),
          ).length;

        existingHeader.updated_by = userId;

        await this.scheduleHeaderRepository.save(existingHeader);

        results.push({
          action: "UPDATE",
          location_id: locationId,
          header_id: existingHeader.id,
          updated_details: updatedCount,
          created_details: createdCount,
        });

        logger.info(
          `[StaffSchedulingService] DWS schedule upserted. ` +
            `DATE=${scheduleDateStr}, ` +
            `LOCATION_ID=${locationId}, ` +
            `HEADER_ID=${existingHeader.id}, ` +
            `UPDATED=${updatedCount}, ` +
            `CREATED=${createdCount}`,
        );
      } catch (error) {
        logger.error(
          `[StaffSchedulingService] DWS upsert failed. ` +
            `DATE=${scheduleDateStr}, ` +
            `LOCATION_ID=${locationId}`,
          error,
        );

        results.push({
          action: "ERROR",
          location_id: locationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      schedule_date: scheduleDateStr,
      processed_locations: results.length,
      results,
    };
  }
}
