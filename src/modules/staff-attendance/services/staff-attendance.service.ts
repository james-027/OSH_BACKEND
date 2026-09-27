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
import { CreateSchedulingDetailDto } from "src/modules/staff-attendance/dto/CreateStaffSchedulingDto";
import { CreateScheduleHeaderDto } from "src/modules/staff-attendance/dto/CreateStaffSchedulingDto";
import { UpdateScheduleHeaderDto } from "src/modules/staff-attendance/dto/UpdateStaffSchedulingDto";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "../../../config/logger";
import { STATUS_IDS, ACTION_IDS } from "src/constants/customConstants";
import { ActionLogsService } from "src/modules/actions/services/action-logs.service";
import { Warehouse } from "src/entities/Warehouse";
import { ScheduleHeaderHistory } from "src/entities/ScheduleHeaderHistory";
import * as XLSX from "xlsx";

const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const customParseFormat = require("dayjs/plugin/customParseFormat");

dayjs.extend(utc);
dayjs.extend(customParseFormat);

@Injectable()
export class StaffAttendanceService {
  constructor(
    @InjectRepository(ScheduleDetail)
    private scheduleDetailRepository: Repository<ScheduleDetail>,
    @InjectRepository(ScheduleHeader)
    private scheduleHeaderRepository: Repository<ScheduleHeader>,
    @InjectRepository(Warehouse)
    private warehouseRepository: Repository<Warehouse>,
    @InjectRepository(StaffWarehouse)
    private staffWarehouseRepository: Repository<StaffWarehouse>,
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    private usersService: UsersService,
    private actionLogsService: ActionLogsService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
    private readonly dataSource: DataSource,
  ) {}

  private readonly module_name = "STAFF ATTENDANCE";

  async findAll(statusId?: number[], accessKeyId?: number): Promise<any[]> {
    try {
      const where: any = {};
      if (statusId !== undefined) {
        where.attendance_status_id = statusId;
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
          "createdBy",
          "updatedBy",
          "attendanceStatus",
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

  //   async findAll(statusId?: number[], accessKeyId?: number): Promise<any[]> {
  //   try {
  //     const where: any = {};

  //     if (accessKeyId !== undefined) {
  //       where.access_key_id = accessKeyId;
  //     }

  //     const scheduleHeaders = await this.scheduleHeaderRepository.find({
  //       where,
  //       order: {
  //         id: "DESC",
  //       },
  //       relations: [
  //         "createdBy",
  //         "updatedBy",
  //         "details",
  //         "details.location",
  //       ],
  //     });

  //     // Filter based on Schedule Detail attendance status
  //     const filteredHeaders =
  //       statusId !== undefined
  //         ? scheduleHeaders.filter((header) =>
  //             header.details?.some((detail) =>
  //               statusId.includes(detail.attendance_status_id),
  //             ),
  //           )
  //         : scheduleHeaders;

  //     const mappedHeaders =
  //       this.responseMapperService.mapEntitiesToResponse(
  //         filteredHeaders,
  //       );

  //     return mappedHeaders.map((mappedHeader, index) => {
  //       const originalHeader = filteredHeaders[index];

  //       const firstDetail = originalHeader.details?.[0];

  //       return {
  //         ...mappedHeader,

  //         location_name:
  //           firstDetail?.location?.location_name ?? null,
  //       };
  //     });
  //   } catch (error) {
  //     console.error("Error fetching staff schedule:", error);

  //     throw new Error("Failed to fetch staff schedule");
  //   }
  // }

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

      // Verify all staff IDs exist
      for (const detail of createScheduleDto.details) {
        if (!staffMap.has(detail.staff_id)) {
          throw new BadRequestException(
            `Staff with ID ${detail.staff_id} not found`,
          );
        }
      }

      const existingSchedules = await this.scheduleDetailRepository.find({
        where: {
          staff_id: In(staffIds),
          scheduleHeader: {
            status_id: Not(STATUS_IDS.CANCELLED),
          },
        },

        relations: ["scheduleHeader", "warehouse"],
      });

      for (
        let lineIndex = 0;
        lineIndex < createScheduleDto.details.length;
        lineIndex++
      ) {
        const detail = createScheduleDto.details[lineIndex];

        const requestedStart = new Date(detail.duty_start_time);
        const requestedEnd = new Date(detail.duty_end_time);

        // Validate requested duty time

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

        // Get existing schedules for this staff

        const staffExistingSchedules = existingSchedules.filter(
          (existing) => existing.staff_id === detail.staff_id,
        );

        // Check actual duty date/time overlap

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

            // Use the ACTUAL existing duty date
            const formattedDate = dayjs(existing.duty_start_time).format(
              "MM/DD/YYYY",
            );

            const formattedTimeRange = `${dayjs(
              existing.duty_start_time,
            ).format("MM/DD/YYYY hh:mm A")} - ${dayjs(
              existing.duty_end_time,
            ).format("MM/DD/YYYY hh:mm A")}`;

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
            ).format("MM/DD/YYYY hh:mm A")} - ${dayjs(
              currentDetail.duty_end_time,
            ).format("MM/DD/YYYY hh:mm A")}`;

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

      const savedHeader =
        await this.scheduleHeaderRepository.manager.transaction(
          async (transactionalEntityManager) => {
            const entryCount = createScheduleDto.details?.length || 0;

            const newScheduleHeader = transactionalEntityManager.create(
              ScheduleHeader,
              {
                schedule_date: createScheduleDto.schedule_date,
                entry_no: entryCount,
                reason: createScheduleDto.reason,
                shifting_day: createScheduleDto.shifting_day,
                status_id: STATUS_IDS.PENDING,
                access_key_id: accessKeyId,
                created_by: userId,
                updated_by: userId,
              },
            );

            const savedHeaderRecord = await transactionalEntityManager.save(
              ScheduleHeader,
              newScheduleHeader,
            );

            const scheduleHeaderHistory = transactionalEntityManager.create(
              ScheduleHeaderHistory,
              {
                schedule_header_id: savedHeaderRecord.id,
                schedule_date: savedHeaderRecord.schedule_date,
                entry_no: savedHeaderRecord.entry_no,
                reason: savedHeaderRecord.reason,
                shifting_day: savedHeaderRecord.shifting_day,
                status_id: savedHeaderRecord.status_id,
                created_by: userId,
                updated_by: userId,
              },
            );

            await transactionalEntityManager.save(
              ScheduleHeaderHistory,
              scheduleHeaderHistory,
            );

            const detailsToSave: ScheduleDetail[] = [];

            const scheduleDate = new Date(createScheduleDto.schedule_date);

            // Keep track of staff already added in this new schedule.
            // non-overlapping duties in the same request.
            const staffAlreadyAdded = new Set<number>();

            for (const detail of createScheduleDto.details) {
              const staff = staffMap.get(detail.staff_id);

              const requestedStart = new Date(detail.duty_start_time);
              const requestedEnd = new Date(detail.duty_end_time);

              const isNightShift = this.checkIfNightShift(
                requestedEnd,
                scheduleDate,
                requestedStart,
              );

              // Check if this staff already has another duty
              // on the same schedule date.
              const hasExistingDuty = await this.checkDutyCount(
                transactionalEntityManager,
                detail.staff_id,
                scheduleDate,
              );

              // If the staff already has a duty in the database,
              const multipleDuty =
                hasExistingDuty || staffAlreadyAdded.has(detail.staff_id)
                  ? 1
                  : 0;

              const scheduleDetail = transactionalEntityManager.create(
                ScheduleDetail,
                {
                  schedule_header_id: savedHeaderRecord.id,
                  staff_id: detail.staff_id,
                  actual_logs_id: detail.actual_logs_id,
                  staff_code: staff.staff_code || staff.code,
                  vendor_id: staff.vendor_id,
                  location_id: staff.location_id,
                  warehouse_id: detail.warehouse_id,
                  remarks: detail.remarks,
                  duty_start_time: detail.duty_start_time,
                  duty_end_time: detail.duty_end_time,
                  operational_start_time: detail.operational_start_time,
                  operational_end_time: detail.operational_end_time,
                  diff_outlet: detail.diff_outlet,
                  add_ot: detail.add_ot,
                  starting_time: detail.starting_time,
                  ending_time: detail.ending_time,
                  working_day_id: detail.working_day_id,
                  is_night_shift: isNightShift,
                  multiple_duty: multipleDuty,
                  status_id: STATUS_IDS.ACTIVE,
                  access_key_id: accessKeyId,
                  created_by: userId,
                  updated_by: userId,
                },
              );

              detailsToSave.push(scheduleDetail);

              // Mark this staff as already added to this new schedule.
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
          service: "StaffAttendanceService",
          method: "create",
          raw_data: JSON.stringify(savedHeader),
          description: `Created schedule entry with ${savedHeader.entry_no} details`,
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
        throw new Error("Failed to retrieve created staff schedule");
      }

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
        logger.error("Action log failed for Create Schedule:", err);
      }

      const response = this.responseMapperService.mapEntityToResponse(
        scheduleWithRelations,
      );

      try {
        this.sseEventEmitter.emitCreate(
          "staff_scheduling",
          response.id,
          response,
        );
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      logger.error("Failed to create staff scheduling:", error);
      throw new Error("Failed to create staff scheduling");
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

      const scheduleDetailIds = updateScheduleDto.id || [];

      let existingScheduleDetails;

      if (scheduleDetailIds.length > 0) {
        existingScheduleDetails = await this.scheduleDetailRepository.find({
          where: {
            id: In(scheduleDetailIds),
            schedule_header_id: id,
          },
          relations: ["scheduleHeader", "actualLogsDetail", "staff"],
        });

        if (existingScheduleDetails.length !== scheduleDetailIds.length) {
          const foundIds = existingScheduleDetails.map((detail) => detail.id);

          const invalidIds = scheduleDetailIds.filter(
            (detailId) => !foundIds.includes(detailId),
          );

          throw new BadRequestException(
            `The following Schedule Detail IDs do not belong to Schedule Header ${id}: ${invalidIds.join(", ")}`,
          );
        }
      } else {
        existingScheduleDetails = await this.scheduleDetailRepository.find({
          where: {
            schedule_header_id: id,
          },
        });

        for (const scheduleDetail of existingScheduleDetails) {
          scheduleDetail.attendance_status_id = STATUS_IDS.VALIDATED;
          scheduleDetail.updated_by = userId;
          scheduleDetail.cron_computed = false;
        }
      }

      const details = updateScheduleDto.details || [];

      if (scheduleDetailIds.length > 0) {
        for (const scheduleDetail of existingScheduleDetails) {
          const updateDetail = details.find(
            (detail) => detail.id === scheduleDetail.id,
          );

          if (!updateDetail) {
            continue;
          }

          const actualLogsDetail = scheduleDetail.actualLogsDetail;

          let dutyScheduleAutomaticallyUpdated = false;

          if (updateDetail.just_time_in) {
            const justTimeIn = new Date(updateDetail.just_time_in);

            scheduleDetail.just_time_in = justTimeIn;
            scheduleDetail.duty_start_time = justTimeIn;

            dutyScheduleAutomaticallyUpdated = true;
          } else {
            scheduleDetail.just_time_in = actualLogsDetail?.time_in ?? null;
          }

          if (updateDetail.just_break_out) {
            scheduleDetail.just_break_out = new Date(
              updateDetail.just_break_out,
            );
          } else {
            scheduleDetail.just_break_out = actualLogsDetail?.break_out ?? null;
          }

          if (updateDetail.just_break_in) {
            scheduleDetail.just_break_in = new Date(updateDetail.just_break_in);
          } else {
            scheduleDetail.just_break_in = actualLogsDetail?.break_in ?? null;
          }

          if (updateDetail.just_time_out) {
            const justTimeOut = new Date(updateDetail.just_time_out);

            scheduleDetail.just_time_out = justTimeOut;
            scheduleDetail.duty_end_time = justTimeOut;

            dutyScheduleAutomaticallyUpdated = true;
          } else {
            scheduleDetail.just_time_out = actualLogsDetail?.time_out ?? null;
          }

          if (dutyScheduleAutomaticallyUpdated) {
            scheduleDetail.system_remarks =
              "AUTO UPDATE DUTY SCHED BASED ON JUSTIFICATION";
          }

          if (updateDetail.working_day_id !== undefined) {
            scheduleDetail.working_day_id = updateDetail.working_day_id;
          }

          if (updateDetail.remarks !== undefined) {
            scheduleDetail.remarks = updateDetail.remarks;
          }

          scheduleDetail.updated_by = userId;
          scheduleDetail.attendance_status_id = STATUS_IDS.VALIDATED;
          scheduleDetail.add_ot = updateDetail.add_ot;
          scheduleDetail.cron_computed = false;
        }
      }

      const savedDetails = await this.scheduleDetailRepository.save(
        existingScheduleDetails,
      );

      await this.scheduleHeaderRepository.update(id, {
        attendance_status_id: STATUS_IDS.VALIDATED,
        updated_by: userId,
      });

      await this.userAuditTrailCreateService.create(
        {
          service: "Staff Scheduling Services",
          method: "update",
          raw_data: JSON.stringify(savedDetails),
          description:
            scheduleDetailIds.length > 0
              ? `Updated Schedule Details: ${scheduleDetailIds.join(", ")}`
              : `Validated all Schedule Details under Schedule Header: ${id}`,
          status_id: 1,
        },
        userId,
      );

      try {
        await this.actionLogsService.logAction({
          module_name: this.module_name,
          ref_id: id,
          action_id: ACTION_IDS.EDIT,
          description: "Update Schedule",
          raw_data: JSON.stringify(savedDetails),
          created_by: userId,
        });
      } catch (err) {
        logger.error("Action log failed for Update Schedule:", err);
      }

      const scheduleHeader = await this.scheduleHeaderRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!scheduleHeader) {
        throw new NotFoundException(`Schedule Header ${id} not found`);
      }

      const response =
        this.responseMapperService.mapEntityToResponse(scheduleHeader);

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

      return {
        schedule_header: response,
        schedule_details: savedDetails,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      logger.error("Failed to update staff attendance:", error);

      throw new Error("Failed to update staff attendance");
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

      await this.scheduleHeaderRepository.update(
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

      // Retrieve updated schedules
      const updatedScheduleHeaders = await this.scheduleHeaderRepository.find({
        where: {
          id: In(scheduleIds),
        },
        relations: ["status", "createdBy", "updatedBy"],
      });

      // Audit trail
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

      // SSE Events
      for (const response of responses) {
        try {
          this.sseEventEmitter.emitUpdate(
            "staff_scheduling",
            response.id,
            response,
          );
          this.sseEventEmitter.emitUpdate(
            "staff_attedance",
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

      await this.scheduleHeaderRepository.update(
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

      // Retrieve updated schedules
      const updatedScheduleHeaders = await this.scheduleHeaderRepository.find({
        where: {
          id: In(scheduleIds),
        },
        relations: ["status", "createdBy", "updatedBy"],
      });

      // Audit trail
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
            action_id: ACTION_IDS.REVERT,
            description: `Revert Schedule Reason: ${updateScheduleDto.reason}`,
            raw_data: JSON.stringify(schedule),
            created_by: userId,
          });
        }
      } catch (err) {
        logger.error("Action log failed for Post Schedule:", err);
      }

      // SSE Events
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

      await this.scheduleHeaderRepository.update(
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

      // Retrieve updated schedules
      const updatedScheduleHeaders = await this.scheduleHeaderRepository.find({
        where: {
          id: In(scheduleIds),
        },
        relations: ["status", "createdBy", "updatedBy"],
      });

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "Staff Scheduling Services",
          method: "cancelSchedule",
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
            action_id: ACTION_IDS.CANCEL,
            description: `Cancel Schedule Reason: ${updateScheduleDto.reason}`,
            raw_data: JSON.stringify(schedule),
            created_by: userId,
          });
        }
      } catch (err) {
        logger.error("Action log failed for Cancel Schedule:", err);
      }

      // SSE Events
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
        pos_logs_id: null,
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
      // 2 = EARLY FIRST SHIFT
      if (end.isSame(firstShiftEnd) || end.isAfter(firstShiftEnd)) {
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
}
