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
import { CreateStaffVendorSalaryDto } from "src/modules/staff-vendor-salaries/dto/CreateStaffVendorSalaryDto";
import { UpdateStaffVendorSalaryDto } from "src/modules/staff-vendor-salaries/dto/UpdateStaffVendorSalaryDto";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "../../../config/logger";

@Injectable()
export class StaffVendorSalariesService {
  constructor(
    @InjectRepository(StaffVendorSalary)
    private staffVendorSalariesRepository: Repository<StaffVendorSalary>,
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
      });

      await this.staffVendorSalariesRepository.save(staffVendorSalary);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffVendorSalariesService",
          method: "update",
          raw_data: JSON.stringify(staffVendorSalary),
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
          ],
        });

      if (!staffVendorSalaryWithRelations) {
        throw new Error("Failed to retrieve updated staff vendor salary");
      }

      const response = this.responseMapperService.mapEntityToResponse(
        staffVendorSalaryWithRelations,
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
}
