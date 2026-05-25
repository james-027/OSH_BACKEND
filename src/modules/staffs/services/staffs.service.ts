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

  async create(createStaffDto: CreateStaffDto, userId: number): Promise<any> {
    try {
      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const existingRecord = await this.staffsRepository.findOne({
        where: {
          staff_code: createStaffDto.staff_code,
        },
      });

      if (existingRecord) {
        throw new BadRequestException(
          `Staff code '${createStaffDto.staff_code}' already exists`,
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
        access_key_id: createStaffDto.access_key_id,
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
          staff_code: updateStaffDto.staff_code,
        },
      });

      if (existingRecord && existingRecord.id !== id) {
        throw new BadRequestException(
          `Staff code '${updateStaffDto.staff_code}' already exists`,
        );
      }

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      // Convert date strings to Date objects
      const updateData: any = { ...updateStaffDto };
      if (updateData.hired_date && typeof updateData.hired_date === "string") {
        updateData.hired_date = new Date(updateData.hired_date);
      }
      if (updateData.to_hr_date && typeof updateData.to_hr_date === "string") {
        updateData.to_hr_date = new Date(updateData.to_hr_date);
      }
      if (
        updateData.to_sts_date &&
        typeof updateData.to_sts_date === "string"
      ) {
        updateData.to_sts_date = new Date(updateData.to_sts_date);
      }
      if (
        updateData.approved_eprf_date &&
        typeof updateData.approved_eprf_date === "string"
      ) {
        updateData.approved_eprf_date = new Date(updateData.approved_eprf_date);
      }
      if (
        updateData.req_completion_date &&
        typeof updateData.req_completion_date === "string"
      ) {
        updateData.req_completion_date = new Date(
          updateData.req_completion_date,
        );
      }
      if (
        updateData.actual_deployment_date &&
        typeof updateData.actual_deployment_date === "string"
      ) {
        updateData.actual_deployment_date = new Date(
          updateData.actual_deployment_date,
        );
      }
      if (
        updateData.separated_date &&
        typeof updateData.separated_date === "string"
      ) {
        updateData.separated_date = new Date(updateData.separated_date);
      }
      if (updateData.birthday && typeof updateData.birthday === "string") {
        updateData.birthday = new Date(updateData.birthday);
      }

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
        updateData.staff_code = updateData.staff_code.toUpperCase();
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
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error("Failed to update staff");
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
}
