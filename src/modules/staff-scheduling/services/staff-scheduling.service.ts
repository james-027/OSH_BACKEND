import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, In, Not } from "typeorm";
import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";

import { ScheduleDetail } from "src/entities/ScheduleDetails";
import { ScheduleHeader } from "src/entities/ScheduleHeader";
import { Staff } from "src/entities/Staff";
import { StaffWarehouse } from "src/entities/StaffWarehouse";
import { CreateSchedulingDetailDto } from "src/modules/staff-scheduling/dto/CreateStaffSchedulingDto";
import { CreateScheduleHeaderDto } from "src/modules/staff-scheduling/dto/CreateStaffSchedulingDto";
import { UpdateScheduleHeaderDto } from "src/modules/staff-scheduling/dto/UpdateStaffSchedulingDto";
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
export class StaffSchedulingService {
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

  private readonly module_name = "STAFF SCHEDULING";
  async findAll(statusId?: number[]): Promise<any[]> {
    try {
      const where: any = {};
      if (statusId !== undefined) {
        where.status_id = statusId;
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

      const scheduleHeaderHistory =
        transactionalEntityManager.create(ScheduleHeaderHistory, {
          schedule_header_id: savedHeaderRecord.id,
          schedule_date: savedHeaderRecord.schedule_date,
          entry_no: savedHeaderRecord.entry_no,
          reason: savedHeaderRecord.reason,
          shifting_day: savedHeaderRecord.shifting_day,
          status_id: savedHeaderRecord.status_id,
          created_by: userId,
          updated_by: userId,
        });

      await transactionalEntityManager.save(
        ScheduleHeaderHistory,
        scheduleHeaderHistory,
      );


            const detailsToSave = createScheduleDto.details.map((detail) => {
              const staff = staffMap.get(detail.staff_id);

              return transactionalEntityManager.create(ScheduleDetail, {
                schedule_header_id: savedHeaderRecord.id,
                staff_id: detail.staff_id,
                pos_logs_id: detail.pos_logs_id,
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
                status_id: STATUS_IDS.ACTIVE,
                access_key_id: accessKeyId,
                created_by: userId,
                updated_by: userId,
              });
            });

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

            const detailsToSave = details.map((detail) => {
              const staff = staffMap.get(detail.staff_id);
              if (detail.id) {
                return transactionalEntityManager.create(ScheduleDetail, {
                  id: Number(detail.id),
                  schedule_header_id: savedHeaderRecord.id,
                  staff_id: detail.staff_id,
                  staff_code: staff.staff_code || staff.code,
                  vendor_id: staff.vendor_id,
                  location_id: staff.location_id,
                  warehouse_id: detail.warehouse_id,
                  remarks: detail.remarks,
                  duty_start_time: detail.duty_start_time,
                  duty_end_time: detail.duty_end_time,
                  status_id: STATUS_IDS.ACTIVE,
                  updated_by: userId,
                });
              }

              return transactionalEntityManager.create(ScheduleDetail, {
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
                status_id: STATUS_IDS.ACTIVE,
                created_by: userId,
                updated_by: userId,
              });
            });

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

    const warehouseList = await this.warehouseRepository.find({
      where: {
        warehouse_name: In(warehouseNames),
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
      const warehouse = warehouseMap.get(warehouseName);

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
}
