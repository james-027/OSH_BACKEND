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
import { CreateStaffDto } from "src/modules/staffs/dto/CreateStaffDto";
import { UpdateStaffDto } from "src/modules/staffs/dto/UpdateStaffDto";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "../../../config/logger";

@Injectable()
export class StaffsService {
  constructor(
    @InjectRepository(Staff)
    private staffsRepository: Repository<Staff>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async findAll(accessKeyId?: number): Promise<any[]> {
    try {
      const where: any = {};
      if (accessKeyId !== undefined) {
        where.access_key_id = accessKeyId;
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
        ],
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

      const existingRecord = await this.staffsRepository.findOne({
        where: {
          first_name: createStaffDto.first_name.toUpperCase(),
          last_name: createStaffDto.last_name.toUpperCase(),
        },
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
        assign_status_id: createStaffDto.assign_status_id,
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
        status_id: createStaffDto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedStaff = await this.staffsRepository.save(newStaff);

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

      const existingRecord = await this.staffsRepository.findOne({
        where: {
          first_name: updateStaffDto.first_name.toUpperCase(),
          last_name: updateStaffDto.last_name.toUpperCase(),
        },
      });

      if (existingRecord && existingRecord.id !== id) {
        throw new BadRequestException(
          `Staff '${updateStaffDto.first_name} ${updateStaffDto.last_name}' may already exist`,
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

      // Convert date strings to Date objects
      const updateData: any = { ...updateStaffDto };
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

      // Uppercase name fields if provided
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
        updateData.staff_code = updateData.staff_code
          ? updateData.staff_code.toUpperCase()
          : "";
      }

      Object.assign(staff, updateData, {
        updated_by: userId,
      });

      await this.staffsRepository.save(staff);

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
        ],
      });

      if (!staffWithRelations) {
        throw new Error("Failed to retrieve updated staff");
      }

      const response =
        this.responseMapperService.mapEntityToResponse(staffWithRelations);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("staffs", response.id, response);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      console.error("UPDATE STAFF ERROR:", error);
      throw error;

      // if (
      //   error instanceof NotFoundException ||
      //   error instanceof BadRequestException
      // ) {
      //   throw error;
      // }
      // throw new Error("Failed to update staff");
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

  async uploadExcel(file: Express.Multer.File, userId: number) {
    const XLSX = require("xlsx");

    const workbook = XLSX.readFile(file.path);

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      raw: false,
      dateNF: "yyyy-mm-dd",
      defval: "",
    });


    const success = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        const dto: CreateStaffDto = {
          first_name: row["First Name"],
          last_name: row["Last Name"],
          middle_name: row["Middle Name"],
          birthday: row["Birthday"],
          location_id: row["Location"],
          vendor_id: row["Vendor"],
          position_id: row["Position"],
          access_key_id: row["Access Keys"],
          store_request: row["Store Request"],
          sss_number: row["SSS Number"],
          tin: row["TIN"],
          pagibig_number: row["PAGIBIG Number"],
          remarks: row["Remarks"],
          hired_date: row["Hired Date"],
          to_hr_date: row["To HR Date"],
          separated_date: row["Seperated Date"],
          to_sts_date: row["To STS Date"],
          approved_eprf_date: row["Approved EPRF Date"],
          req_completion_date: row["Req Completion Date"],
          actual_deployment_date: row["Actual Deployment Date"],
          overall_remarks: row["Overall Remarks"],
          assign_status_id: row["Assignment Status"],
        };

        return dto;
        const created = await this.create(dto, userId);

        success.push({
          row: i + 2,
          data: created,
        });
      } catch (error) {
        errors.push({
          row: i + 2,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      inserted_count: success.length,
      updated_count: 0,
      inserted_row_numbers: success.map((s) => s.row),
      updated_row_numbers: [],
      success,
      errors,
    };
  }
}
