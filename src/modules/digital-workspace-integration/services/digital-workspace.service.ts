import { Injectable } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { firstValueFrom } from "rxjs";

import { Staff } from "src/entities/Staff";
import { LogsType } from "src/entities/LogsType";

const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const customParseFormat = require("dayjs/plugin/customParseFormat");

dayjs.extend(utc);
dayjs.extend(customParseFormat);

@Injectable()
export class DigitalWorkspaceService {
  constructor(
    private readonly httpService: HttpService,

    @InjectRepository(Staff)
    private readonly staffsRepository: Repository<Staff>,

    @InjectRepository(LogsType)
    private readonly logsTypeRepository: Repository<LogsType>,
  ) {}

  async testHandshake(body: any) {
    const url =
      "https://bty-digital-workspace.chookstogo.com.ph/digital_workspace/api/process/merchandiser/cms/user_log_v3.php";

    const response = await firstValueFrom(
      this.httpService.post(url, body, {
        headers: {
          "x-api-key": process.env.DWS_API_KEY,
          "Content-Type": "application/json",
        },
      }),
    );

    const apiData = response.data;

    const validRecords = [];
    const errors = [];

    for (const record of apiData) {
      const crewId = Number(record["CREW_ID"]);
      const crewCode = record["CREW_CODE"];

      /*
       * 1. Find staff
       */
      const staff = await this.staffsRepository.findOne({
        where: {
          old_dws_id: crewId,
          old_dws_code: crewCode,
        },
        relations: [
          "status",
          "assignmentStatus",
          "location",
          "staffVendorSalaries",
          "staffSalaries",
        ],
      });

      if (!staff) {
        errors.push({
          crew_id: crewId,
          crew_code: crewCode,
          date: record["DATE"],
          error: "Staff not found",
        });

        continue;
      }

      /*
       * 2. Staff must be ACTIVE
       */
      if (staff.status_id !== 1) {
        errors.push({
          crew_id: crewId,
          crew_code: crewCode,
          staff_id: staff.id,
          staff_name: `${staff.first_name} ${staff.last_name}`,
          date: record["SCHEDULE_DATE"],
          error: "Staff is not active",
          status_id: staff.status_id,
        });

        continue;
      }

      /*
       * 3. Get staff information
       */
      const locationId = staff.location_id;
      const warehouseId = staff.warehouse_id;
      const vendorId = staff.vendor_id;

      /*
       * 4. Get schedule date
       */
      const scheduleDate = this.parseDwsDate(
        record["SCHEDULE_DATE"],
      );

      if (!scheduleDate) {
        errors.push({
          crew_id: crewId,
          crew_code: crewCode,
          staff_id: staff.id,
          date: record["SCHEDULE_DATE"],
          error: "Invalid schedule date",
        });

        continue;
      }

      /*
       * 5. Parse DWS time
       */
      const startTime = this.parseDwsDateTime(
        record["SCHEDULE_DATE"],
        record["TIME_IN"],
      );

      const endTime = this.parseDwsDateTime(
        record["SCHEDULE_DATE"],
        record["TIME_OUT"],
      );

      if (!startTime) {
        errors.push({
          crew_id: crewId,
          crew_code: crewCode,
          staff_id: staff.id,
          date: record["SCHEDULE_DATE"],
          time_in: record["TIME_IN"],
          error: "Invalid time in",
        });

        continue;
      }

      if (!endTime) {
        errors.push({
          crew_id: crewId,
          crew_code: crewCode,
          staff_id: staff.id,
          date: record["SCHEDULE_DATE"],
          time_out: record["TIME_OUT"],
          error: "Invalid time out",
        });

        continue;
      }

      /*
       * 6. Handle overnight shift
       */
      let actualEndTime = endTime;

      if (
        dayjs(actualEndTime).isBefore(dayjs(startTime)) ||
        dayjs(actualEndTime).isSame(dayjs(startTime))
      ) {
        actualEndTime = dayjs(actualEndTime)
          .add(1, "day")
          .toDate();
      }

      /*
       * 7. Use existing night shift logic
       */
      const isNightShift = this.checkIfNightShift(
        actualEndTime,
        scheduleDate,
        startTime,
      );

      /*
       * 8. Baseline
       */
      const baseline = {
        crew_id: crewId,
        schedule_date: dayjs(scheduleDate).format("YYYY-MM-DD"),
        location_id: locationId,
        is_night_shift: isNightShift,
        warehouse_id: warehouseId,
      };

      /*
       * 9. Valid record
       */
      validRecords.push({
        api: record,

        staff: {
          id: staff.id,
          staff_code: staff.staff_code,
          first_name: staff.first_name,
          last_name: staff.last_name,
          location_id: locationId,
          warehouse_id: warehouseId,
          vendor_id: vendorId,
          status_id: staff.status_id,
        },

        baseline,

        time: {
          start_time: startTime,
          end_time: actualEndTime,

          break_out: this.parseDwsDateTime(
            record["SCHEDULE_DATE"],
            record["BREAK OUT"],
          ),

          break_in: this.parseDwsDateTime(
            record["SCHEDULE_DATE"],
            record["BREAK IN"],
          ),
        },
      });
    }

    return {
      total_records: apiData.length,
      valid_records: validRecords.length,
      error_records: errors.length,
      validRecords,
      errors,
    };
  }

  private parseDwsDate(value: any): Date | null {
    if (!value) {
      return null;
    }

    const valueString = String(value).trim();

    const parsed = dayjs(
      valueString,
      "YYYY-MM-DD",
      true,
    );

    if (!parsed.isValid()) {
      return null;
    }

    return parsed.startOf("day").toDate();
  }

  private parseDwsDateTime(
    dateValue: any,
    timeValue: any,
  ): Date | null {
    if (!dateValue || !timeValue) {
      return null;
    }

    const date = String(dateValue).trim();
    const time = String(timeValue).trim();

    const parsed = dayjs(
      `${date} ${time}`,
      "YYYY-MM-DD hh:mm A",
      true,
    );

    if (!parsed.isValid()) {
      return null;
    }

    return parsed.toDate();
  }

  private checkIfNightShift(
    endTime: Date,
    scheduleDate: Date,
    startTime: Date,
  ): number {
    const schedDate = dayjs(scheduleDate).format("YYYY-MM-DD");

    const start = dayjs(startTime);
    const end = dayjs(endTime);

    const nightShiftTrigger = dayjs(
      `${schedDate} 17:00:00`,
    );

    const nightShiftStart = dayjs(
      `${schedDate} 22:00:00`,
    );

    const midnightShiftStart = dayjs(
      `${schedDate} 00:00:00`,
    );

    const nightShiftEnd = dayjs(
      `${schedDate} 06:00:00`,
    );

    const firstShiftStart = dayjs(
      `${schedDate} 06:00:00`,
    );

    const firstShiftEnd = dayjs(
      `${schedDate} 14:00:00`,
    );

    const secondShiftStart = dayjs(
      `${schedDate} 14:00:00`,
    );

    const secondShiftEnd = dayjs(
      `${schedDate} 22:00:00`,
    );

    // 1 = NIGHT SHIFT
    if (
      (start.isSame(nightShiftTrigger) ||
        start.isAfter(nightShiftTrigger)) &&
      end.isAfter(nightShiftStart)
    ) {
      return 1;
    }

    // 00:00 - 05:59
    else if (
      (start.isSame(midnightShiftStart) ||
        start.isAfter(midnightShiftStart)) &&
      start.isBefore(nightShiftEnd)
    ) {
      if (
        end.isSame(firstShiftEnd) ||
        end.isAfter(firstShiftEnd)
      ) {
        // 2 = EARLY FIRST SHIFT
        return 2;
      }

      // 1 = NIGHT SHIFT
      return 1;
    }

    // 06:00 - 13:59
    else if (
      (start.isSame(firstShiftStart) ||
        start.isAfter(firstShiftStart)) &&
      start.isBefore(firstShiftEnd)
    ) {
      return 2;
    }

    // 14:00 - 22:00
    else if (
      (start.isSame(secondShiftStart) ||
        start.isAfter(secondShiftStart)) &&
      (start.isSame(secondShiftEnd) ||
        start.isBefore(secondShiftEnd))
    ) {
      // 3 = SECOND SHIFT
      return 3;
    }

    return 0;
  }
}