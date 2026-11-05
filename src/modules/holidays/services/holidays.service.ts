import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository,Raw } from "typeorm";
import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";

import { CalendarHoliday } from "src/entities/CalendarHoliday";
import { CreateHolidayDto } from "src/modules/holidays/dto/CreateHolidayDto";
import { UpdateHolidayDto } from "src/modules/holidays/dto/UpdateHolidayDto";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "../../../config/logger";
import { WorkingDay } from "src/entities/WorkingDay";

@Injectable()
export class HolidaysService {
  constructor(
    @InjectRepository(CalendarHoliday)
    private holidaysRepository: Repository<CalendarHoliday>,
    @InjectRepository(WorkingDay)
    private workingDaysRepository: Repository<WorkingDay>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async findAll(): Promise<any[]> {
    try {
      const holidays = await this.holidaysRepository.find({
        relations: ["status", "createdBy", "updatedBy", "workingDays"],
      });

      return this.responseMapperService.mapEntitiesToResponse(holidays);
    } catch (error) {
      console.error("Error fetching holidays:", error);
      throw new Error("Failed to fetch holidays");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const holiday = await this.holidaysRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy", "workingDays"],
      });

      if (!holiday) {
        throw new NotFoundException(`Holiday with ID ${id} not found`);
      }

      return this.responseMapperService.mapEntityToResponse(holiday);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching holidays:", error);
      throw new Error("Failed to fetch holidays");
    }
  }

  async create(
    createHolidayDto: CreateHolidayDto,
    userId: number,
  ): Promise<any> {
    try {
      // Check if category with this name already exists
      const existingHoliday = await this.holidaysRepository.findOne({
        where: {
          holiday_date: Raw(
            (alias) => `DATE_FORMAT(${alias}, '%Y-%m-%d') = '${createHolidayDto.holiday_date}'`,
          ),
        },
      });

      if (existingHoliday) {
        throw new BadRequestException(
          "Holiday with this date already exists",
        );
      }

      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newHoliday = this.holidaysRepository.create({
        description: createHolidayDto.description.toUpperCase(),
        holiday_date: createHolidayDto.holiday_date,
        working_day_id: createHolidayDto.working_day_id,
        status_id: createHolidayDto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedHoliday = await this.holidaysRepository.save(newHoliday);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "HolidaysService",
          method: "create",
          raw_data: JSON.stringify(savedHoliday),
          description: `Created holiday ${savedHoliday.id} - ${savedHoliday.description}`,
          status_id: 1,
        },
        userId,
      );

      const holidayWithRelations = await this.holidaysRepository.findOne({
        where: { id: savedHoliday.id },
        relations: ["status", "createdBy", "updatedBy", "workingDays"],
      });

      if (!holidayWithRelations) {
        throw new Error("Failed to retrieve created holiday");
      }

      const response = this.responseMapperService.mapEntityToResponse(
        holidayWithRelations,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitCreate("holidays", response.id, response);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error("Failed to create holiday");
    }
  }

  async update(
    id: number,
    updateHolidayDto: UpdateHolidayDto,
    userId: number,
  ): Promise<any> {
    try {
      const holiday = await this.holidaysRepository.findOne({
        where: { id },
        relations: ["createdBy"],
      });

      if (!holiday) {
        throw new NotFoundException(`Holiday with ID ${id} not found`);
      }

      // Check for unique constraints if updating name
      if (updateHolidayDto.holiday_date) {
        const existingHoliday = await this.holidaysRepository.findOne({
          where: {
            holiday_date: Raw(
              (alias) => `DATE_FORMAT(${alias}, '%Y-%m-%d') = '${updateHolidayDto.holiday_date}'`,
            ),
          },
        });

        if (existingHoliday && existingHoliday.id !== id) {
          throw new BadRequestException(
            "Holiday with this date already exists",
          );
        }
      }

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      if (updateHolidayDto.description) {
        updateHolidayDto.description =
          updateHolidayDto.description.toUpperCase();
      }

      Object.assign(holiday, updateHolidayDto, {
        updated_by: userId,
      });

      await this.holidaysRepository.save(holiday);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "HolidaysService",
          method: "update",
          raw_data: JSON.stringify(holiday),
          description: `Updated holiday ${holiday.id} - ${holiday.description}`,
          status_id: 1,
        },
        userId,
      );

      const holidayWithRelations = await this.holidaysRepository.findOne({
        where: { id: holiday.id },
        relations: ["status", "createdBy", "updatedBy", "workingDays"],
      });

      if (!holidayWithRelations) {
        throw new Error("Failed to retrieve updated holiday");
      }

      const response = this.responseMapperService.mapEntityToResponse(
        holidayWithRelations,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("holidays", response.id, response);
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
      throw new Error("Failed to update holiday");
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const holiday = await this.holidaysRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!holiday) {
        throw new NotFoundException(`Holiday with ID ${id} not found`);
      }

      const newStatusId = holiday.status_id === 1 ? 2 : 1;
      const newStatusName = newStatusId === 1 ? "ACTIVE" : "INACTIVE";

      await this.holidaysRepository.update(id, {
        status_id: newStatusId,
      });

      const updatedHoliday = await this.holidaysRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy", "workingDays"],
      });

      if (!updatedHoliday) {
        throw new Error("Failed to retrieve updated holiday");
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "HolidaysService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedHoliday),
          description: `Toggled status for holiday ${id} - ${updatedHoliday.description} to ${newStatusName}`,
          status_id: 1,
        },
        userId,
      );

      const response =
        this.responseMapperService.mapEntityToResponse(updatedHoliday);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("holidays", response.id, response);
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
      throw new Error("Failed to toggle status for holiday");
    }
  }

  
async uploadExcel(
  file: Express.Multer.File,
  userId: number,
): Promise<any> {
  const XLSX = require("xlsx");

  const workbook = XLSX.readFile(file.path);

  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    raw: true,
    defval: null,
  });

  const success = [];
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    try {
      // Skip completely empty row
      if (
        !row["Holiday Date"] &&
        !row["Holiday Name"] &&
        !row["Working Day"]
      ) {
        continue;
      }

      // REQUIRED FIELD VALIDATION
      const requiredFields = [
        "Holiday Date",
        "Holiday Name",
        "Working Day",
      ];

      const missingFields = requiredFields.filter(
        (field) =>
          row[field] === null ||
          row[field] === undefined ||
          String(row[field]).trim() === "",
      );

      if (missingFields.length > 0) {
        errors.push({
          row: i + 2,
          error: `Missing required field(s): ${missingFields.join(", ")}`,
        });

        continue;
      }

      // FORMAT HOLIDAY DATE
      let holidayDate: string;

      if (typeof row["Holiday Date"] === "number") {
        const excelDate = XLSX.SSF.parse_date_code(
          row["Holiday Date"],
        );

        if (!excelDate) {
          errors.push({
            row: i + 2,
            error: "Invalid Holiday Date.",
          });

          continue;
        }

        holidayDate = [
          excelDate.y,
          String(excelDate.m).padStart(2, "0"),
          String(excelDate.d).padStart(2, "0"),
        ].join("-");
      } else {
        holidayDate = String(row["Holiday Date"]).trim();
      }

      // Validate YYYY-MM-DD format and actual calendar date
      const dateMatch = holidayDate.match(
        /^(\d{4})-(\d{2})-(\d{2})$/,
      );

      if (!dateMatch) {
        errors.push({
          row: i + 2,
          error: `Invalid Holiday Date '${row["Holiday Date"]}'. Expected YYYY-MM-DD.`,
        });

        continue;
      }

      const year = Number(dateMatch[1]);
      const month = Number(dateMatch[2]);
      const day = Number(dateMatch[3]);

      const validatedDate = new Date(
        Date.UTC(year, month - 1, day),
      );

      if (
        validatedDate.getUTCFullYear() !== year ||
        validatedDate.getUTCMonth() !== month - 1 ||
        validatedDate.getUTCDate() !== day
      ) {
        errors.push({
          row: i + 2,
          error: `Invalid calendar date '${holidayDate}'.`,
        });

        continue;
      }

      const holidayName = String(row["Holiday Name"])
        .trim()
        .toUpperCase();

      if (!holidayName) {
        errors.push({
          row: i + 2,
          error: "Holiday Name is required.",
        });

        continue;
      }

      const workingDayName = String(row["Working Day"])
        .trim()
        .toUpperCase();

      if (!workingDayName) {
        errors.push({
          row: i + 2,
          error: "Working Day is required.",
        });

        continue;
      }

      const statusId =
        row["Status ID"] === null ||
        row["Status ID"] === undefined ||
        String(row["Status ID"]).trim() === ""
          ? 1
          : Number(row["Status ID"]);

      if (!Number.isInteger(statusId) || statusId <= 0) {
        errors.push({
          row: i + 2,
          error: "Status ID must be a valid positive integer.",
        });

        continue;
      }

      // CHECK IF WORKING DAY EXISTS
      const workingDay = await this.workingDaysRepository.findOne({
        where: {
          description: workingDayName,
        },
      });

      if (!workingDay) {
        errors.push({
          row: i + 2,
          error: `Working Day Name '${workingDayName}' not found.`,
        });

        continue;
      }

      // FIND EXISTING HOLIDAY USING HOLIDAY DATE
      const existingHoliday = await this.holidaysRepository.findOne({
        where: {
          holiday_date: Raw(
            (alias) =>
              `DATE_FORMAT(${alias}, '%Y-%m-%d') = :holidayDate`,
            {
              holidayDate,
            },
          ),
        },
      });

      let savedHoliday;
      const isUpdate = !!existingHoliday;

      if (existingHoliday) {
        // UPDATE EXISTING HOLIDAY
        existingHoliday.description = holidayName;
        existingHoliday.working_day_id = workingDay.id;
        existingHoliday.status_id = statusId;
        existingHoliday.updated_by = userId;

        savedHoliday = await this.holidaysRepository.save(
          existingHoliday,
        );
      } else {
        // INSERT NEW HOLIDAY
        const newHoliday = this.holidaysRepository.create({
          holiday_date: holidayDate,
          description: holidayName,
          working_day_id: workingDay.id,
          status_id: statusId,
          created_by: userId,
          updated_by: userId,
        });

        savedHoliday = await this.holidaysRepository.save(
          newHoliday,
        );
      }

      // AUDIT TRAIL
      await this.userAuditTrailCreateService.create(
        {
          service: "HolidaysService",
          method: isUpdate ? "update" : "create",
          raw_data: JSON.stringify(savedHoliday),
          description: isUpdate
            ? `Updated holiday ${savedHoliday.id} - ${savedHoliday.description}`
            : `Created holiday ${savedHoliday.id} - ${savedHoliday.description}`,
          status_id: 1,
        },
        userId,
      );

      // GET HOLIDAY WITH RELATIONS
      const holidayWithRelations =
        await this.holidaysRepository.findOne({
          where: {
            id: savedHoliday.id,
          },
          relations: [
            "status",
            "createdBy",
            "updatedBy",
            "workingDays",
          ],
        });

      if (!holidayWithRelations) {
        throw new Error("Failed to retrieve holiday");
      }

      const response =
        this.responseMapperService.mapEntityToResponse(
          holidayWithRelations,
        );

      // SSE EVENTS
      try {
        if (isUpdate) {
          this.sseEventEmitter.emitUpdate(
            "holidays",
            response.id,
            response,
          );
        } else {
          this.sseEventEmitter.emitCreate(
            "holidays",
            response.id,
            response,
          );
        }
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      success.push({
        row: i + 2,
        action: isUpdate ? "updated" : "inserted",
        data: response,
      });
    } catch (error) {
      errors.push({
        row: i + 2,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      });
    }
  }

  return {
    inserted_count: success.filter(
      (s) => s.action === "inserted",
    ).length,

    updated_count: success.filter(
      (s) => s.action === "updated",
    ).length,

    inserted_row_numbers: success
      .filter((s) => s.action === "inserted")
      .map((s) => s.row),

    updated_row_numbers: success
      .filter((s) => s.action === "updated")
      .map((s) => s.row),

    success,
    errors,
  };
}




}
