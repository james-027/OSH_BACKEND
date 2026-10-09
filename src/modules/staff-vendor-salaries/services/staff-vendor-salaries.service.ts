import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";

import { StaffVendorSalary } from "src/entities/StaffVendorSalary";
import { StaffSalary } from "src/entities/StaffSalary";
import { Location } from "src/entities/Location";
import { Staff } from "src/entities/Staff";
import { Vendor } from "src/entities/Vendor";
import { CreateStaffVendorSalaryDto } from "src/modules/staff-vendor-salaries/dto/CreateStaffVendorSalaryDto";
import { UpdateStaffVendorSalaryDto } from "src/modules/staff-vendor-salaries/dto/UpdateStaffVendorSalaryDto";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "../../../config/logger";
import {
  STATUS_IDS,
  ACTION_IDS,
  DAYS_FACTOR_RATE,
} from "src/constants/customConstants";
import { ActionLogsService } from "src/modules/actions/services/action-logs.service";
import { SssConfigs } from "src/entities/SssConfig";
import { GovernmentContributionUtil } from "src/utils/government-contribution-util";

@Injectable()
export class StaffVendorSalariesService {
  constructor(
    @InjectRepository(StaffVendorSalary)
    private staffVendorSalariesRepository: Repository<StaffVendorSalary>,
    @InjectRepository(StaffSalary)
    private staffSalaryRepository: Repository<StaffSalary>,
    @InjectRepository(Staff)
    private staffsRepository: Repository<Staff>,
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    @InjectRepository(Vendor)
    private vendorRepository: Repository<Vendor>,
    @InjectRepository(SssConfigs)
    private readonly sssConfigsRepository: Repository<SssConfigs>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    
    private actionLogsService: ActionLogsService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  private readonly module_name = "STAFF VENDOR SALARIES";

  async findAll(accessKeyId?: number): Promise<any[]> {
    try {
      const where: any = {};
      if (accessKeyId !== undefined) {
        where.access_key_id = accessKeyId;
      }

      where.status_id = STATUS_IDS.ACTIVE;

      where.staff = {
        status_id: STATUS_IDS.ACTIVE,
      };

      const staffVendorSalaries = await this.staffVendorSalariesRepository.find(
        {
          where,
          relations: [
            "status",
            "createdBy",
            "updatedBy",
            "staff",
            "vendor",
            "location",
            "accessKey",
            "staffSalaries",
          ],
        },
      );

      return this.responseMapperService.mapEntitiesToResponse(
        staffVendorSalaries,
      );
    } catch (error) {
      console.error("Error fetching staff vendor salaries:", error);
      throw new Error("Failed to fetch staff vendor salaries");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const staffVendorSalary =
        await this.staffVendorSalariesRepository.findOne({
          where: { id },
          relations: [
            "status",
            "createdBy",
            "updatedBy",
            "staff",
            "vendor",
            "location",
            "accessKey",
            "staffSalaries",
          ],
        });

      if (!staffVendorSalary) {
        throw new NotFoundException(
          `Staff Vendor Salary with ID ${id} not found`,
        );
      }

      return this.responseMapperService.mapEntityToResponse(staffVendorSalary);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching staff vendor salaries:", error);
      throw new Error("Failed to fetch staff vendor salaries");
    }
  }

  async create(
    createStaffVendorSalaryDto: CreateStaffVendorSalaryDto,
    userId: number,
    accessKeyId?: number,
  ): Promise<any> {
    try {
      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newStaffVendorSalary = this.staffVendorSalariesRepository.create({
        staff_id: createStaffVendorSalaryDto.staff_id,
        vendor_id: createStaffVendorSalaryDto.vendor_id,
        location_id: createStaffVendorSalaryDto.location_id,
        access_key_id: accessKeyId,
        status_id: createStaffVendorSalaryDto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedStaffVendorSalary =
        await this.staffVendorSalariesRepository.save(newStaffVendorSalary);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffVendorSalariesService",
          method: "create",
          raw_data: JSON.stringify(savedStaffVendorSalary),
          description: `Created staff vendor salary ${savedStaffVendorSalary.id}`,
          status_id: 1,
        },
        userId,
      );

      const staffVendorSalaryWithRelations =
        await this.staffVendorSalariesRepository.findOne({
          where: { id: savedStaffVendorSalary.id },
          relations: [
            "status",
            "createdBy",
            "updatedBy",
            "staff",
            "vendor",
            "location",
            "accessKey",
          ],
        });

      if (!staffVendorSalaryWithRelations) {
        throw new Error("Failed to retrieve created staff vendor salary");
      }

      const response = this.responseMapperService.mapEntityToResponse(
        staffVendorSalaryWithRelations,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitCreate(
          "staff_vendor_salaries",
          response.id,
          response,
        );
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error("Failed to create staff vendor salary");
    }
  }

  async update(
    id: number,
    updateStaffVendorSalaryDto: UpdateStaffVendorSalaryDto,
    userId: number,
    accessKeyId: number,
  ): Promise<any> {
    try {
      const staffVendorSalary =
        await this.staffVendorSalariesRepository.findOne({
          where: { id },
          relations: ["createdBy"],
        });

      if (!staffVendorSalary) {
        throw new NotFoundException(
          `Staff Vendor Salary with ID ${id} not found`,
        );
      }

      const updatedByUser = await this.usersService.findUserById(userId);

      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      Object.assign(staffVendorSalary, updateStaffVendorSalaryDto, {
        updated_by: userId,
        access_key_id: accessKeyId,
      });

      await this.staffVendorSalariesRepository.save(staffVendorSalary);

      if (updateStaffVendorSalaryDto.salary_rate !== undefined) {
        let staffSalary = await this.staffSalaryRepository.findOne({
          where: {
            staff_vendor_id: staffVendorSalary.id,
          },
        });

        if (staffSalary) {
          const oldSalaryRate = staffSalary.salary_rate;
          const oldPagibigContriAmount = staffSalary.pagibig_contri_amount;

          staffSalary.salary_rate = updateStaffVendorSalaryDto.salary_rate;

          staffSalary.pagibig_contri_amount =
            GovernmentContributionUtil.computePagIbigShare(staffSalary);

          staffSalary.updated_by = userId;
          staffSalary.access_key_id = accessKeyId;

          const savedStaffSalary =
            await this.staffSalaryRepository.save(staffSalary);

          try {
            const changes: string[] = [];

            changes.push(
              `Salary rate from ${oldSalaryRate} to ${staffSalary.salary_rate}`,
            );

            changes.push(
              `Pag-IBIG contribution from ${oldPagibigContriAmount} to ${staffSalary.pagibig_contri_amount}`,
            );

            await this.actionLogsService.logAction({
              module_name: this.module_name,
              ref_id: staffVendorSalary.id,
              action_id: ACTION_IDS.EDIT,
              description: changes.join(", "),
              raw_data: JSON.stringify({
                old_salary_rate: oldSalaryRate,
                new_salary_rate: staffSalary.salary_rate,
                old_pagibig_contri_amount: oldPagibigContriAmount,
                new_pagibig_contri_amount: staffSalary.pagibig_contri_amount,
                access_key_id: accessKeyId,
              }),
              created_by: userId,
            });
          } catch (err) {
            logger.error("Action log failed for update:", err);
          }
        } else {
          staffSalary = this.staffSalaryRepository.create({
            staff_id: staffVendorSalary.staff_id,
            staff_vendor_id: staffVendorSalary.id,
            access_key_id: accessKeyId,
            salary_rate: updateStaffVendorSalaryDto.salary_rate ?? 0,
            status_id: staffVendorSalary.status_id,
            created_by: userId,
            updated_by: userId,
          });

          staffSalary.pagibig_contri_amount =
            GovernmentContributionUtil.computePagIbigShare(staffSalary);

          const savedStaffSalary =
            await this.staffSalaryRepository.save(staffSalary);

          try {
            await this.actionLogsService.logAction({
              module_name: this.module_name,
              ref_id: savedStaffSalary.id,
              action_id: ACTION_IDS.ADD,
              description: `Created staff salary with salary rate ${savedStaffSalary.salary_rate} and Pag-IBIG contribution ${savedStaffSalary.pagibig_contri_amount}`,
              raw_data: JSON.stringify(savedStaffSalary),
              created_by: userId,
            });
          } catch (err) {
            logger.error("Action log failed for create:", err);
          }
        }
      }

      await this.userAuditTrailCreateService.create(
        {
          service: "StaffVendorSalariesService",
          method: "update",
          raw_data: JSON.stringify({
            staffVendorSalary,
            salary_rate: updateStaffVendorSalaryDto.salary_rate,
          }),
          description: `Updated staff vendor salary ${staffVendorSalary.id}`,
          status_id: 1,
        },
        userId,
      );

      const staffVendorSalaryWithRelations =
        await this.staffVendorSalariesRepository.findOne({
          where: { id: staffVendorSalary.id },
          relations: [
            "status",
            "createdBy",
            "updatedBy",
            "staff",
            "vendor",
            "location",
            "accessKey",
            "staffSalaries",
          ],
        });

      if (!staffVendorSalaryWithRelations) {
        throw new Error("Failed to retrieve updated staff vendor salary");
      }

      const response = this.responseMapperService.mapEntityToResponse(
        staffVendorSalaryWithRelations,
      );

      try {
        this.sseEventEmitter.emitUpdate(
          "staff_vendor_salaries",
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

      logger.error("Failed to update staff vendor salary:", error);

      throw new Error("Failed to update staff vendor salary");
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const staffVendorSalary =
        await this.staffVendorSalariesRepository.findOne({
          where: { id },
          relations: [
            "status",
            "createdBy",
            "updatedBy",
            "staff",
            "vendor",
            "location",
          ],
        });

      if (!staffVendorSalary) {
        throw new NotFoundException(
          `Staff Vendor Salary with ID ${id} not found`,
        );
      }

      const newStatusId = staffVendorSalary.status_id === 1 ? 2 : 1;
      const newStatusName = newStatusId === 1 ? "ACTIVE" : "INACTIVE";

      await this.staffVendorSalariesRepository.update(id, {
        status_id: newStatusId,
      });

      const updatedStaffVendorSalary =
        await this.staffVendorSalariesRepository.findOne({
          where: { id },
          relations: [
            "status",
            "createdBy",
            "updatedBy",
            "staff",
            "vendor",
            "location",
          ],
        });

      if (!updatedStaffVendorSalary) {
        throw new Error("Failed to retrieve updated staff vendor salary");
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffVendorSalariesService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedStaffVendorSalary),
          description: `Toggled status for staff vendor salary ${id} to ${newStatusName}`,
          status_id: 1,
        },
        userId,
      );

      const response = this.responseMapperService.mapEntityToResponse(
        updatedStaffVendorSalary,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate(
          "staff_vendor_salaries",
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
      throw new Error("Failed to toggle status for staff vendor salary");
    }
  }

  async findOneHistory(ref_id: number) {
    // const module_id = MODULE_IDS.STAFFS;
    return this.actionLogsService.findPerModuleRefID(this.module_name, ref_id);
  }

  async uploadStaffVendorSalaries(
    file: Express.Multer.File,
    userId: number,
    accessKeyId?: number,
  ) {
    const XLSX = require("xlsx");

    const workbook = XLSX.readFile(file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      raw: false,
      defval: null,
    });

    const success = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const excelRow = i + 2;

      try {
        const requiredFields = [
          "Staff Code",
          "Staff Name",
          "Agency",
          "Location",
          "Salary Rate",
          "PhilHealth Number Contribution Perc",
          "PAGIBIG Number Perc",
        ];

        const missingFields = requiredFields.filter(
          (field) =>
            row[field] === null ||
            row[field] === undefined ||
            String(row[field]).trim() === "",
        );

        if (missingFields.length > 0) {
          errors.push({
            row: excelRow,
            error: `Missing required field(s): ${missingFields.join(", ")}`,
          });

          continue;
        }

        const staffCode = String(row["Staff Code"]).trim();
        const staffName = String(row["Staff Name"]).trim();
        const agencyName = String(row["Agency"]).trim();
        const locationName = String(row["Location"]).trim();

        // Remove comma from Excel numbers

        const salaryRate = Number(
          String(row["Salary Rate"]).replace(/,/g, "").trim(),
        );
        const phil_health_contri = Number(
          String(row["PhilHealth Number Contribution Perc"])
            .replace(/,/g, "")
            .trim(),
        );

        const pagibig_contri = Number(
          String(row["PAGIBIG Number Perc"]).replace(/,/g, "").trim(),
        );

        if (isNaN(salaryRate)) {
          errors.push({
            row: excelRow,
            error: `Invalid Salary Rate '${row["Salary Rate"]}'`,
          });

          continue;
        }

        const staff = await this.staffsRepository.findOne({
          where: {
            staff_code: staffCode,
          },
        });

        if (!staff) {
          errors.push({
            row: excelRow,
            error: `Staff with Staff Code '${staffCode}' not found`,
          });

          continue;
        }

        const vendor = await this.vendorRepository.findOne({
          where: {
            service_provider_name: agencyName,
          },
        });

        if (!vendor) {
          errors.push({
            row: excelRow,
            error: `Agency '${agencyName}' not found`,
          });

          continue;
        }

        const location = await this.locationRepository.findOne({
          where: {
            location_name: locationName,
          },
        });

        if (!location) {
          errors.push({
            row: excelRow,
            error: `Location '${locationName}' not found`,
          });

          continue;
        }

        const existingStaffVendorSalary =
          await this.staffVendorSalariesRepository.findOne({
            where: {
              staff_id: staff.id,
              vendor_id: vendor.id,
              location_id: location.id,
            },
          });

        let staffVendorSalaryId: number;
        let existingStaffSalaryId: number | null = null;

        if (existingStaffVendorSalary) {
          staffVendorSalaryId = existingStaffVendorSalary.id;

          existingStaffVendorSalary.updated_by = userId;
          existingStaffVendorSalary.access_key_id = accessKeyId;
          await this.staffVendorSalariesRepository.save(
            existingStaffVendorSalary,
          );

          const existingStaffSalary = await this.staffSalaryRepository.findOne({
            where: {
              staff_vendor_id: existingStaffVendorSalary.id,
              status_id: STATUS_IDS.ACTIVE,
            },
          });

          if (existingStaffSalary) {
            const oldStatusId = existingStaffSalary.status_id;
            const oldAllowance = existingStaffSalary.allowance;
            const oldSalaryRate = existingStaffSalary.salary_rate;

            existingStaffSalary.status_id = STATUS_IDS.INACTIVE;
            existingStaffSalary.updated_by = userId;
            existingStaffSalary.access_key_id = accessKeyId;

            existingStaffSalary.phil_health_contri_perc = phil_health_contri;
            existingStaffSalary.pagibig_number_perc = pagibig_contri;

            await this.staffSalaryRepository.save(existingStaffSalary);

            existingStaffSalaryId = existingStaffSalary.id;

            try {
              await this.actionLogsService.logAction({
                module_name: this.module_name,
                ref_id: existingStaffSalary.id,
                action_id: ACTION_IDS.EDIT,
                description:
                  `Deactivated old staff salary for Staff Code ${staffCode} ` +
                  `with Allowance ${oldAllowance} and Salary Rate ${oldSalaryRate}`,
                raw_data: JSON.stringify({
                  source: "STAFF VENDOR SALARY UPLOAD",
                  action: "DEACTIVATE_OLD_SALARY",
                  row: excelRow,

                  staff_salary_id: existingStaffSalary.id,
                  staff_vendor_salary_id: existingStaffVendorSalary.id,

                  staff_id: staff.id,
                  staff_code: staffCode,
                  staff_name: staffName,

                  vendor_id: vendor.id,
                  agency: agencyName,

                  location_id: location.id,
                  location: locationName,

                  old_status_id: oldStatusId,
                  new_status_id: STATUS_IDS.INACTIVE,

                  old_salary_rate: oldSalaryRate,

                  new_salary_rate: salaryRate,

                  access_key_id: accessKeyId,
                }),
                created_by: userId,
              });
            } catch (err) {
              logger.error(
                `Action log failed for deactivated staff salary, ` +
                  `staff_salary_id=${existingStaffSalary.id}:`,
                err,
              );
            }
          }
        } else {
          const newStaffVendorSalary =
            this.staffVendorSalariesRepository.create({
              staff_id: staff.id,
              vendor_id: vendor.id,
              location_id: location.id,
              access_key_id: accessKeyId,
              status_id: STATUS_IDS.ACTIVE,
              created_by: userId,
              updated_by: userId,
            });

          const savedStaffVendorSalary =
            await this.staffVendorSalariesRepository.save(newStaffVendorSalary);

          staffVendorSalaryId = savedStaffVendorSalary.id;

          try {
            await this.actionLogsService.logAction({
              module_name: this.module_name,
              ref_id: savedStaffVendorSalary.id,
              action_id: ACTION_IDS.ADD,
              description: `Created new staff vendor relation for Staff Code ${staffCode}`,
              raw_data: JSON.stringify({
                source: "STAFF VENDOR SALARY UPLOAD",
                action: "CREATE_NEW_STAFF_VENDOR_RELATION",
                row: excelRow,

                staff_vendor_salary_id: savedStaffVendorSalary.id,

                staff_id: staff.id,
                staff_code: staffCode,
                staff_name: staffName,

                vendor_id: vendor.id,
                agency: agencyName,

                location_id: location.id,
                location: locationName,

                access_key_id: accessKeyId,
              }),
              created_by: userId,
            });
          } catch (err) {
            logger.error(
              `Action log failed for new staff vendor relation, ` +
                `staff_vendor_salary_id=${savedStaffVendorSalary.id}:`,
              err,
            );
          }
        }

        // =========================================================
        const newStaffSalary = this.staffSalaryRepository.create({
          staff_id: staff.id,
          staff_vendor_id: staffVendorSalaryId,
          access_key_id: accessKeyId,
          salary_rate: salaryRate,
          status_id: STATUS_IDS.ACTIVE,
          created_by: userId,
          updated_by: userId,
        });

        const savedStaffSalary =
          await this.staffSalaryRepository.save(newStaffSalary);
        try {
          await this.actionLogsService.logAction({
            module_name: this.module_name,
            ref_id: savedStaffSalary.id,
            action_id: ACTION_IDS.ADD,
            description:
              `Created new staff salary for Staff Code ${staffCode} ` +
              `with New Salary Rate ${salaryRate}`,
            raw_data: JSON.stringify({
              source: "STAFF VENDOR SALARY UPLOAD",
              action: "CREATE_NEW_SALARY",
              row: excelRow,

              staff_salary_id: savedStaffSalary.id,

              staff_vendor_salary_id: staffVendorSalaryId,

              staff_id: staff.id,
              staff_code: staffCode,
              staff_name: staffName,

              vendor_id: vendor.id,
              agency: agencyName,

              location_id: location.id,
              location: locationName,

              salary_rate: salaryRate,

              old_staff_salary_id: existingStaffSalaryId,

              access_key_id: accessKeyId,
            }),
            created_by: userId,
          });
        } catch (err) {
          logger.error(
            `Action log failed for new staff salary, ` +
              `staff_salary_id=${savedStaffSalary.id}:`,
            err,
          );
        }

        try {
          await this.userAuditTrailCreateService.create(
            {
              service: "StaffVendorSalariesService",
              method: "uploadStaffVendorSalaries",
              raw_data: JSON.stringify({
                source: "STAFF VENDOR SALARY UPLOAD",
                row: excelRow,

                staff_id: staff.id,
                staff_code: staffCode,
                staff_name: staffName,

                staff_vendor_salary_id: staffVendorSalaryId,

                staff_salary_id: savedStaffSalary.id,

                old_staff_salary_id: existingStaffSalaryId,

                vendor_id: vendor.id,
                agency: agencyName,

                location_id: location.id,
                location: locationName,

                salary_rate: salaryRate,

                access_key_id: accessKeyId,
              }),
              description:
                `Uploaded staff salary for Staff Code ${staffCode} ` +
                `with Salary Rate ${salaryRate}`,
              status_id: 1,
            },
            userId,
          );
        } catch (err) {
          logger.error(
            `User audit trail failed for staff vendor salary upload, ` +
              `staff_code=${staffCode}:`,
            err,
          );
        }

        const updatedRecord = await this.staffVendorSalariesRepository.findOne({
          where: {
            id: staffVendorSalaryId,
          },
          relations: [
            "status",
            "createdBy",
            "updatedBy",
            "staff",
            "vendor",
            "location",
            "accessKey",
            "staffSalaries",
          ],
        });

        if (!updatedRecord) {
          throw new Error(
            `Failed to retrieve staff vendor salary for Staff Code '${staffCode}'`,
          );
        }

        const response =
          this.responseMapperService.mapEntityToResponse(updatedRecord);

        try {
          this.sseEventEmitter.emitUpdate(
            "staff_vendor_salaries",
            response.id,
            response,
          );
        } catch (err) {
          logger.error(
            `SSE event failed for staff_vendor_salary_id=${response.id}:`,
            err,
          );
        }

        success.push({
          row: excelRow,
          action: existingStaffVendorSalary ? "updated" : "inserted",
          message: existingStaffVendorSalary
            ? "Existing staff vendor relation retained and old salary deactivated. New salary created."
            : "New staff vendor relation and salary created.",

          data: {
            staff_code: staffCode,
            staff_name: staffName,

            agency: agencyName,
            vendor_id: vendor.id,

            location: locationName,
            location_id: location.id,

            salary_rate: salaryRate,

            existing_staff_vendor_relation: !!existingStaffVendorSalary,

            staff_vendor_salary_id: staffVendorSalaryId,

            old_staff_salary_id: existingStaffSalaryId,

            new_staff_salary_id: savedStaffSalary.id,
          },
        });
      } catch (error) {
        errors.push({
          row: excelRow,
          error: error instanceof Error ? error.message : "Unknown error",
        });

        logger.error(
          `Failed to process staff vendor salary upload row ${excelRow}:`,
          error,
        );
      }
    }

    return {
      inserted_count: success.filter((s) => s.action === "inserted").length,

      updated_count: success.filter((s) => s.action === "updated").length,

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
