import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";

import { Staff } from "src/entities/Staff";
import { Location } from "src/entities/Location";
import {
  CheckStaffDto,
  CreateStaffDto,
} from "src/modules/staffs/dto/CreateStaffDto";
import { UpdateStaffDto } from "src/modules/staffs/dto/UpdateStaffDto";
import { parseExcelDate } from "src/utils/date.utils";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "../../../config/logger";
import { Position } from "src/entities/Position";
import { Vendor } from "src/entities/Vendor";
import { Status } from "src/entities/Status";
import { StaffBrand } from "src/entities/StaffBrand";
import { StaffVendorSalary } from "src/entities/StaffVendorSalary";
import { StaffCategoryType } from "src/entities/StaffCategoryType";
import { Brand } from "src/entities/Brand";
import { CategoryType } from "src/entities/CategoryType";

@Injectable()
export class StaffsService {
  constructor(
    @InjectRepository(Staff)
    private staffsRepository: Repository<Staff>,
    @InjectRepository(StaffBrand)
    private staffBrandsRepository: Repository<StaffBrand>,
    @InjectRepository(StaffVendorSalary)
    private staffVendorSalaryRepository: Repository<StaffVendorSalary>,
    @InjectRepository(StaffCategoryType)
    private staffCategoryTypesRepository: Repository<StaffCategoryType>,
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    @InjectRepository(Vendor)
    private vendorRepository: Repository<Vendor>,
    @InjectRepository(Status)
    private statusRepository: Repository<Status>,
    @InjectRepository(Brand)
    private brandRepository: Repository<Brand>,
    @InjectRepository(CategoryType)
    private categoryTypeRepository: Repository<CategoryType>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async findAll(accessKeyId?: number, statusId?: number): Promise<any[]> {
    try {
      const where: any = {};
      if (accessKeyId !== undefined) {
        where.access_key_id = accessKeyId;
      }

      if (statusId) {
        where.status_id = statusId;
      }

      const staffs = await this.staffsRepository.find({
        where,
        relations: [
          "status",
          "assignmentStatus",
          "createdBy",
          "updatedBy",
          "location",
          "vendor",
          "position",
          "accessKey",
          "staffBrands",
          "staffCategoryTypes",
          "staffVendorSalaries",
        ],
        order: {
          modified_at: "DESC", // latest modified first
        },
      });

      return this.responseMapperService.mapEntitiesToResponse(staffs);
    } catch (error) {
      console.error("Error fetching staffs:", error);
      throw new Error("Failed to fetch staffs");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const staff = await this.staffsRepository.findOne({
        where: { id },
        relations: [
          "status",
          "assignmentStatus",
          "createdBy",
          "updatedBy",
          "location",
          "vendor",
          "position",
          "staffBrands",
          "staffCategoryTypes",
          "staffVendorSalaries",
        ],
      });

      if (!staff) {
        throw new NotFoundException(`Staff with ID ${id} not found`);
      }

      return this.responseMapperService.mapEntityToResponse(staff);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching staffs:", error);
      throw new Error("Failed to fetch staffs");
    }
  }

  async create(
    createStaffDto: CreateStaffDto,
    userId: number,
    accessKeyId?: number,
  ): Promise<any> {
    try {
      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const firstName = createStaffDto.first_name.toUpperCase().trim();
      const lastName = createStaffDto.last_name.trim();
      const middleName = (createStaffDto.middle_name || "")
        .toUpperCase()
        .trim();

      const whereCondition: any = {
        first_name: firstName,
        last_name: lastName,
      };

      if (middleName) {
        whereCondition.middle_name = middleName;
      }

      const existingRecord = await this.staffsRepository.findOne({
        where: whereCondition,
      });

      if (existingRecord) {
        throw new BadRequestException(
          `Staff '${createStaffDto.first_name} ${createStaffDto.last_name}' may already exist`,
        );
      }

      const newStaff = this.staffsRepository.create({
        staff_code: createStaffDto.staff_code
          ? createStaffDto.staff_code.toUpperCase()
          : null,
        last_name: createStaffDto.last_name.toUpperCase(),
        first_name: createStaffDto.first_name.toUpperCase(),
        middle_name: createStaffDto.middle_name
          ? createStaffDto.middle_name.toUpperCase()
          : null,
        location_id: createStaffDto.location_id,
        vendor_id: createStaffDto.vendor_id,
        assign_status_id: 13,
        position_id: createStaffDto.position_id,
        access_key_id: accessKeyId,
        sss_number: createStaffDto.sss_number || null,
        pagibig_number: createStaffDto.pagibig_number || null,
        tin: createStaffDto.tin || null,
        remarks: createStaffDto.remarks || null,
        hired_date: createStaffDto.hired_date
          ? new Date(createStaffDto.hired_date)
          : null,
        to_hr_date: createStaffDto.to_hr_date
          ? new Date(createStaffDto.to_hr_date)
          : null,
        to_sts_date: createStaffDto.to_sts_date
          ? new Date(createStaffDto.to_sts_date)
          : null,
        approved_eprf_date: createStaffDto.approved_eprf_date
          ? new Date(createStaffDto.approved_eprf_date)
          : null,
        req_completion_date: createStaffDto.req_completion_date
          ? new Date(createStaffDto.req_completion_date)
          : null,
        actual_deployment_date: createStaffDto.actual_deployment_date
          ? new Date(createStaffDto.actual_deployment_date)
          : null,
        separated_date: createStaffDto.separated_date
          ? new Date(createStaffDto.separated_date)
          : null,
        birthday: createStaffDto.birthday
          ? new Date(createStaffDto.birthday)
          : null,
        contact_number: createStaffDto.contact_number || null,
        overall_remarks: createStaffDto.overall_remarks || null,
        store_request: createStaffDto.store_request || null,
        status_id: 20,
        created_by: userId,
        updated_by: userId,
      });

      const savedStaff = await this.staffsRepository.save(newStaff);

      const newStaffBrand = this.staffBrandsRepository.create({
        staff_id: savedStaff.id,
        brand_id: createStaffDto.brand_id,
        access_key_id: accessKeyId,
        status_id: 1,
        created_by: userId,
        updated_by: userId,
      });

      const newStaffCategoryType = this.staffCategoryTypesRepository.create({
        staff_id: savedStaff.id,
        category_type_id: createStaffDto.category_type_id,
        access_key_id: accessKeyId,
        status_id: 1,
        created_by: userId,
        updated_by: userId,
      });

      const newStaffVendorSalary = this.staffVendorSalaryRepository.create({
        staff_id: savedStaff.id,
        vendor_id: createStaffDto.vendor_id,
        location_id: createStaffDto.location_id,
        access_key_id: accessKeyId,
        allowance: createStaffDto.allowance,
        salary_rate: createStaffDto.salary_rate,
        status_id: 1,
        created_by: userId,
        updated_by: userId,
      });
      const savedStaffBrand =
        await this.staffBrandsRepository.save(newStaffBrand);
      const savedStaffCategoryType =
        await this.staffCategoryTypesRepository.save(newStaffCategoryType);
      const savedStaffVendorSalary =
        await this.staffVendorSalaryRepository.save(newStaffVendorSalary);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffsService",
          method: "create",
          raw_data: JSON.stringify(savedStaff),
          description: `Created staff ${savedStaff.id} - ${savedStaff.first_name} ${savedStaff.last_name}`,
          status_id: 1,
        },
        userId,
      );
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffsService",
          method: "create",
          raw_data: JSON.stringify(savedStaffBrand),
          description: `Created staff ${savedStaffBrand.id}`,
          status_id: 1,
        },
        userId,
      );
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffsService",
          method: "create",
          raw_data: JSON.stringify(savedStaffCategoryType),
          description: `Created staff ${savedStaffCategoryType.id}`,
          status_id: 1,
        },
        userId,
      );
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffsService",
          method: "create",
          raw_data: JSON.stringify(savedStaffVendorSalary),
          description: `Created staff ${savedStaffVendorSalary.id} `,
          status_id: 1,
        },
        userId,
      );

      const staffWithRelations = await this.staffsRepository.findOne({
        where: { id: savedStaff.id },
        relations: [
          "status",
          "assignmentStatus",
          "createdBy",
          "updatedBy",
          "location",
          "vendor",
          "position",
          "staffBrands",
          "staffCategoryTypes",
          "staffVendorSalaries",
        ],
      });

      if (!staffWithRelations) {
        throw new Error("Failed to retrieve created staff");
      }

      const response =
        this.responseMapperService.mapEntityToResponse(staffWithRelations);

      // SSE Events
      try {
        this.sseEventEmitter.emitCreate("staffs", response.id, response);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error("Failed to create staff");
    }
  }

  async update(
    id: number,
    updateStaffDto: UpdateStaffDto,
    userId: number,
  ): Promise<any> {
    try {
      const staff = await this.staffsRepository.findOne({
        where: { id },
        relations: ["createdBy"],
      });

      if (!staff) {
        throw new NotFoundException(`Staff with ID ${id} not found`);
      }

      const firstName = updateStaffDto.first_name.toUpperCase().trim();
      const lastName = updateStaffDto.last_name.trim();
      const middleName = (updateStaffDto.middle_name || "")
        .toUpperCase()
        .trim();

      const whereCondition: any = {
        first_name: firstName,
        last_name: lastName,
      };

      if (middleName) {
        whereCondition.middle_name = middleName;
      }

      const existingRecord = await this.staffsRepository.findOne({
        where: whereCondition,
      });

      if (existingRecord && existingRecord.id !== id) {
        throw new BadRequestException(
          `Staff '${updateStaffDto.first_name} ${updateStaffDto.middle_name} ${updateStaffDto.last_name}' may already exist`,
        );
      }

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const safeDate = (value: any) => {
        if (!value || value === "") return null;

        const date = new Date(value);

        if (isNaN(date.getTime())) {
          throw new BadRequestException(`Invalid date: ${value}`);
        }

        return date;
      };

      const updateData: any = { ...updateStaffDto };
      delete updateData.status_id;

      updateData.hired_date = safeDate(updateData.hired_date);
      updateData.to_hr_date = safeDate(updateData.to_hr_date);
      updateData.to_sts_date = safeDate(updateData.to_sts_date);
      updateData.approved_eprf_date = safeDate(updateData.approved_eprf_date);
      updateData.req_completion_date = safeDate(updateData.req_completion_date);
      updateData.actual_deployment_date = safeDate(
        updateData.actual_deployment_date,
      );
      updateData.separated_date = safeDate(updateData.separated_date);
      updateData.birthday = safeDate(updateData.birthday);

      if (updateData.last_name) {
        updateData.last_name = updateData.last_name.toUpperCase();
      }

      if (updateData.first_name) {
        updateData.first_name = updateData.first_name.toUpperCase();
      }

      if (updateData.middle_name) {
        updateData.middle_name = updateData.middle_name.toUpperCase();
      }

      if (updateData.staff_code) {
        updateData.staff_code = updateData.staff_code.toUpperCase();
      }

      Object.assign(staff, updateData, {
        updated_by: userId,
      });

      await this.staffsRepository.save(staff);
      let staffBrand = await this.staffBrandsRepository.findOne({
        where: { staff_id: staff.id },
      });

      if (staffBrand) {
        staffBrand.brand_id = updateStaffDto.brand_id;
        staffBrand.updated_by = userId;

        await this.staffBrandsRepository.save(staffBrand);
      } else {
        staffBrand = this.staffBrandsRepository.create({
          staff_id: staff.id,
          brand_id: updateStaffDto.brand_id,
          access_key_id: staff.access_key_id,
          status_id: updateStaffDto.status_id || 1,
          created_by: userId,
          updated_by: userId,
        });

        await this.staffBrandsRepository.save(staffBrand);
      }

      let staffCategoryType = await this.staffCategoryTypesRepository.findOne({
        where: { staff_id: staff.id },
      });

      if (staffCategoryType) {
        staffCategoryType.category_type_id = updateStaffDto.category_type_id;
        staffCategoryType.updated_by = userId;

        await this.staffCategoryTypesRepository.save(staffCategoryType);
      } else {
        staffCategoryType = this.staffCategoryTypesRepository.create({
          staff_id: staff.id,
          category_type_id: updateStaffDto.category_type_id,
          access_key_id: staff.access_key_id,
          status_id: updateStaffDto.status_id || 1,
          created_by: userId,
          updated_by: userId,
        });

        await this.staffCategoryTypesRepository.save(staffCategoryType);
      }

      let staffVendorSalary = await this.staffVendorSalaryRepository.findOne({
        where: { staff_id: staff.id },
      });

      if (staffVendorSalary) {
        staffVendorSalary.vendor_id = updateStaffDto.vendor_id;
        staffVendorSalary.location_id = updateStaffDto.location_id;
        staffVendorSalary.salary_rate = updateStaffDto.salary_rate;
        staffVendorSalary.allowance = updateStaffDto.allowance;
        staffVendorSalary.updated_by = userId;

        await this.staffVendorSalaryRepository.save(staffVendorSalary);
      } else {
        staffVendorSalary = this.staffVendorSalaryRepository.create({
          staff_id: staff.id,
          vendor_id: updateStaffDto.vendor_id,
          location_id: updateStaffDto.location_id,
          access_key_id: staff.access_key_id,
          salary_rate: updateStaffDto.salary_rate,
          allowance: updateStaffDto.allowance,
          status_id: updateStaffDto.status_id || 1,
          created_by: userId,
          updated_by: userId,
        });

        await this.staffVendorSalaryRepository.save(staffVendorSalary);
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffsService",
          method: "update",
          raw_data: JSON.stringify(staff),
          description: `Updated staff ${staff.id} - ${staff.first_name} ${staff.last_name}`,
          status_id: 1,
        },
        userId,
      );

      const staffWithRelations = await this.staffsRepository.findOne({
        where: { id: staff.id },
        relations: [
          "status",
          "assignmentStatus",
          "createdBy",
          "updatedBy",
          "location",
          "vendor",
          "position",
          "staffBrands",
          "staffCategoryTypes",
          "staffVendorSalaries",
        ],
      });

      if (!staffWithRelations) {
        throw new Error("Failed to retrieve updated staff");
      }

      const response =
        this.responseMapperService.mapEntityToResponse(staffWithRelations);

      try {
        this.sseEventEmitter.emitUpdate("staffs", response.id, response);
        this.sseEventEmitter.emitUpdate("staff_brands", response.id, response);
        this.sseEventEmitter.emitUpdate(
          "staff_category_types",
          response.id,
          response,
        );
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
      console.error("UPDATE STAFF ERROR:", error);
      throw error;
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const staff = await this.staffsRepository.findOne({
        where: { id },
        relations: [
          "status",
          "assignmentStatus",
          "createdBy",
          "updatedBy",
          "location",
          "vendor",
          "position",
        ],
      });

      if (!staff) {
        throw new NotFoundException(`Staff with ID ${id} not found`);
      }

      const newStatusId = staff.status_id === 1 ? 2 : 1;
      const newStatusName = newStatusId === 1 ? "ACTIVE" : "INACTIVE";

      await this.staffsRepository.update(id, {
        status_id: newStatusId,
      });

      const updatedStaff = await this.staffsRepository.findOne({
        where: { id },
        relations: [
          "status",
          "assignmentStatus",
          "createdBy",
          "updatedBy",
          "location",
          "vendor",
          "position",
        ],
      });

      if (!updatedStaff) {
        throw new Error("Failed to retrieve updated staff");
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffsService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedStaff),
          description: `Toggled status for staff ${id} - ${staff.first_name} ${staff.last_name} to ${newStatusName}`,
          status_id: 1,
        },
        userId,
      );

      const response =
        this.responseMapperService.mapEntityToResponse(updatedStaff);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("staffs", response.id, response);
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
      throw new Error("Failed to toggle status for staff");
    }
  }

  async uploadExcel(
    file: Express.Multer.File,
    userId: number,
    accessKeyId?: number,
  ) {
    const XLSX = require("xlsx");

    const workbook = XLSX.readFile(file.path);

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      raw: false,
      dateNF: "yyyy-mm-dd",
      defval: null,
    });

    const success = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        // Skip completely empty row
        if (!row["First Name"] && !row["Last Name"]) {
          continue;
        }

        // REQUIRED FIELD VALIDATION
        const requiredFields = [
          "First Name",
          "Last Name",
          "Location",
          "Position",
          "Vendor",
          "Brand",
          "Category Type",
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

        const location = await this.locationRepository.findOne({
          where: { location_name: row["Location"] },
        });

        const position = await this.positionRepository.findOne({
          where: { position_name: row["Position"] },
        });

        const vendor = await this.vendorRepository.findOne({
          where: { service_provider_name: row["Vendor"] },
        });

        const brand = await this.brandRepository.findOne({
          where: { brand_name: row["Brand"] },
        });
        const categoryType = await this.categoryTypeRepository.findOne({
          where: { category_type_name: row["Category Type"] },
        });

        if (!location) {
          errors.push({
            row: i + 2,
            error: `Location '${row["Location"]}' not found`,
          });
          continue;
        }

        if (!position) {
          errors.push({
            row: i + 2,
            error: `Position '${row["Position"]}' not found`,
          });
          continue;
        }

        if (!vendor) {
          errors.push({
            row: i + 2,
            error: `Vendor '${row["Vendor"]}' not found`,
          });
          continue;
        }

        if (!brand) {
          errors.push({
            row: i + 2,
            error: `Brand '${row["Brand"]}' not found`,
          });
          continue;
        }
        if (!categoryType) {
          errors.push({
            row: i + 2,
            error: `Category Type '${row["Category Type"]}' not found`,
          });
          continue;
        }

        const firstName = row["First Name"].toUpperCase().trim();
        const lastName = row["Last Name"].toUpperCase().trim();
        const middleName = (row["Middle Name"] || "").toUpperCase().trim();
        const staffCode = row["Staff Code"]?.toString().trim();

        let existingRecord = null;

        if (staffCode) {
          existingRecord = await this.staffsRepository.findOne({
            where: {
              staff_code: staffCode,
            },
          });

          if (!existingRecord) {
            const whereCondition: any = {
              first_name: firstName,
              last_name: lastName,
            };

            if (middleName) {
              whereCondition.middle_name = middleName;
            }

            existingRecord = await this.staffsRepository.findOne({
              where: whereCondition,
            });
          }
        } else {
          const whereCondition: any = {
            first_name: firstName,
            last_name: lastName,
          };

          if (middleName) {
            whereCondition.middle_name = middleName;
          }

          existingRecord = await this.staffsRepository.findOne({
            where: whereCondition,
          });
        }

        let savedStaff;
        let savedStaffBrand;
        let savedStaffCategoryType;
        let savedStaffVendorSalary;

        if (existingRecord) {
          existingRecord.contact_number = row["Contact Number"];
          existingRecord.staff_code = staffCode;
          existingRecord.first_name = firstName;
          existingRecord.last_name = lastName;
          existingRecord.middle_name = middleName;
          existingRecord.birthday = parseExcelDate(row["Birthday"]);
          existingRecord.location_id = location.id;
          existingRecord.vendor_id = vendor.id;
          existingRecord.position_id = position.id;
          existingRecord.access_key_id = accessKeyId;
          existingRecord.assign_status_id = 13;
          existingRecord.store_request = row["Store Request"];
          existingRecord.sss_number = row["SSS Number"];
          existingRecord.tin = row["TIN"];
          existingRecord.pagibig_number = row["PAGIBIG Number"];
          existingRecord.remarks = row["Remarks"];
          existingRecord.hired_date = parseExcelDate(row["Hired Date"]);
          existingRecord.to_hr_date = parseExcelDate(row["To HR Date"]);
          existingRecord.separated_date = parseExcelDate(row["Seperated Date"]);
          existingRecord.to_sts_date = parseExcelDate(row["To STS Date"]);
          existingRecord.approved_eprf_date = parseExcelDate(
            row["Approved EPRF Date"],
          );
          existingRecord.req_completion_date = parseExcelDate(
            row["Req Completion Date"],
          );
          existingRecord.actual_deployment_date = parseExcelDate(
            row["Actual Deployment Date"],
          );
          existingRecord.overall_remarks = row["Overall Remarks"];
          existingRecord.updated_by = userId;

          savedStaff = await this.staffsRepository.save(existingRecord);

          let existingStaffBrand = await this.staffBrandsRepository.findOne({
            where: {
              staff_id: savedStaff.id,
              access_key_id: accessKeyId,
            },
          });

          if (existingStaffBrand) {
            existingStaffBrand.brand_id = brand.id;
            existingStaffBrand.status_id = 1;
            existingStaffBrand.updated_by = userId;

            savedStaffBrand =
              await this.staffBrandsRepository.save(existingStaffBrand);
          } else {
            savedStaffBrand = await this.staffBrandsRepository.save(
              this.staffBrandsRepository.create({
                staff_id: savedStaff.id,
                brand_id: brand.id,
                access_key_id: accessKeyId,
                status_id: 1,
                created_by: userId,
                updated_by: userId,
              }),
            );
          }

          let existingCategoryType =
            await this.staffCategoryTypesRepository.findOne({
              where: {
                staff_id: savedStaff.id,
                access_key_id: accessKeyId,
              },
            });

          if (existingCategoryType) {
            existingCategoryType.category_type_id = categoryType.id;
            existingCategoryType.status_id = 1;
            existingCategoryType.updated_by = userId;

            savedStaffCategoryType =
              await this.staffCategoryTypesRepository.save(
                existingCategoryType,
              );
          } else {
            savedStaffCategoryType =
              await this.staffCategoryTypesRepository.save(
                this.staffCategoryTypesRepository.create({
                  staff_id: savedStaff.id,
                  category_type_id: categoryType.id,
                  access_key_id: accessKeyId,
                  status_id: 1,
                  created_by: userId,
                  updated_by: userId,
                }),
              );
          }

          let existingVendorSalary =
            await this.staffVendorSalaryRepository.findOne({
              where: {
                staff_id: savedStaff.id,
                access_key_id: accessKeyId,
              },
            });

          if (existingVendorSalary) {
            existingVendorSalary.vendor_id = vendor.id;
            existingVendorSalary.location_id = location.id;
            existingVendorSalary.allowance = row["Allowance"] || null;
            existingVendorSalary.salary_rate = row["Salary Rate"] || null;
            existingVendorSalary.status_id = 1;
            existingVendorSalary.updated_by = userId;

            savedStaffVendorSalary =
              await this.staffVendorSalaryRepository.save(existingVendorSalary);
          } else {
            savedStaffVendorSalary =
              await this.staffVendorSalaryRepository.save(
                this.staffVendorSalaryRepository.create({
                  staff_id: savedStaff.id,
                  vendor_id: vendor.id,
                  location_id: location.id,
                  access_key_id: accessKeyId,
                  allowance: row["Allowance"] || null,
                  salary_rate: row["Salary Rate"] || null,
                  status_id: 1,
                  created_by: userId,
                  updated_by: userId,
                }),
              );
          }
        } else {
          const newStaff = this.staffsRepository.create({
            first_name: firstName,
            staff_code: staffCode,
            contact_number: row["Contact Number"],
            last_name: lastName,
            middle_name: middleName,
            birthday: parseExcelDate(row["Birthday"]),
            location_id: location.id,
            vendor_id: vendor.id,
            position_id: position.id,
            access_key_id: accessKeyId,
            assign_status_id: 13,
            store_request: row["Store Request"],
            sss_number: row["SSS Number"],
            tin: row["TIN"],
            pagibig_number: row["PAGIBIG Number"],
            remarks: row["Remarks"],
            hired_date: parseExcelDate(row["Hired Date"]),
            to_hr_date: parseExcelDate(row["To HR Date"]),
            separated_date: parseExcelDate(row["Seperated Date"]),
            to_sts_date: parseExcelDate(row["To STS Date"]),
            approved_eprf_date: parseExcelDate(row["Approved EPRF Date"]),
            req_completion_date: parseExcelDate(row["Req Completion Date"]),
            actual_deployment_date: parseExcelDate(
              row["Actual Deployment Date"],
            ),
            overall_remarks: row["Overall Remarks"],
            status_id: 20,
            created_by: userId,
            updated_by: userId,
          });

          savedStaff = await this.staffsRepository.save(newStaff);

          savedStaffBrand = await this.staffBrandsRepository.save(
            this.staffBrandsRepository.create({
              staff_id: savedStaff.id,
              brand_id: brand.id,
              access_key_id: accessKeyId,
              status_id: 1,
              created_by: userId,
              updated_by: userId,
            }),
          );

          savedStaffCategoryType = await this.staffCategoryTypesRepository.save(
            this.staffCategoryTypesRepository.create({
              staff_id: savedStaff.id,
              category_type_id: categoryType.id,
              access_key_id: accessKeyId,
              status_id: 1,
              created_by: userId,
              updated_by: userId,
            }),
          );

          savedStaffVendorSalary = await this.staffVendorSalaryRepository.save(
            this.staffVendorSalaryRepository.create({
              staff_id: savedStaff.id,
              vendor_id: vendor.id,
              location_id: location.id,
              access_key_id: accessKeyId,
              allowance: row["Allowance"] || null,
              salary_rate: row["Salary Rate"] || null,
              status_id: 1,
              created_by: userId,
              updated_by: userId,
            }),
          );
        }

        await this.userAuditTrailCreateService.create(
          {
            service: "StaffsService",
            method: "uploadExcel",
            raw_data: JSON.stringify(savedStaff),
            description: `Upload staff ${savedStaff.id} - ${savedStaff.first_name} ${savedStaff.last_name}`,
            status_id: 1,
          },
          userId,
        );

        if (savedStaffBrand) {
          await this.userAuditTrailCreateService.create(
            {
              service: "StaffsService",
              method: "create",
              raw_data: JSON.stringify(savedStaffBrand),
              description: `Staff Brand ${savedStaffBrand.id}`,
              status_id: 1,
            },
            userId,
          );
        }

        if (savedStaffCategoryType) {
          await this.userAuditTrailCreateService.create(
            {
              service: "StaffsService",
              method: "create",
              raw_data: JSON.stringify(savedStaffCategoryType),
              description: `Staff Category Type ${savedStaffCategoryType.id}`,
              status_id: 1,
            },
            userId,
          );
        }

        if (savedStaffVendorSalary) {
          await this.userAuditTrailCreateService.create(
            {
              service: "StaffsService",
              method: "create",
              raw_data: JSON.stringify(savedStaffVendorSalary),
              description: `Staff Vendor Salary ${savedStaffVendorSalary.id}`,
              status_id: 1,
            },
            userId,
          );
        }

        const staffWithRelations = await this.staffsRepository.findOne({
          where: { id: savedStaff.id },
          relations: [
            "status",
            "assignmentStatus",
            "createdBy",
            "updatedBy",
            "location",
            "vendor",
            "position",
            "staffBrands.brand",
            "staffCategoryTypes.categoryType",
            "staffVendorSalaries",
          ],
        });

        success.push({
          row: i + 2,
          action: existingRecord ? "updated" : "inserted",
          data: staffWithRelations,
        });
      } catch (error) {
        errors.push({
          row: i + 2,
          error: error instanceof Error ? error.message : "Unknown error",
        });
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

  async checkExistingStaff(dto: CheckStaffDto) {
    const firstName = dto.first_name.toUpperCase().trim();
    const lastName = dto.last_name.trim();
    const middleName = (dto.middle_name || "").toUpperCase().trim();

    const whereCondition: any = {
      first_name: firstName,
      last_name: lastName,
    };

    if (middleName) {
      whereCondition.middle_name = middleName;
    }

    const existingRecord = await this.staffsRepository.findOne({
      where: whereCondition,
    });

    return {
      exists: !!existingRecord,
      staff: existingRecord,
    };
  }
}
