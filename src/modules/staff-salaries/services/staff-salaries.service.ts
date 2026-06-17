import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";

import { StaffSalary } from "src/entities/StaffSalary";
import { CreateStaffSalaryDto } from "src/modules/staff-salaries/dto/CreateStaffSalaryDto";
import { UpdateStaffSalaryDto } from "src/modules/staff-salaries/dto/UpdateStaffSalaryDto";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "../../../config/logger";

@Injectable()
export class StaffSalariesService {
  constructor(
    @InjectRepository(StaffSalary)
    private staffSalariesRepository: Repository<StaffSalary>,
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
      const staffVendorSalaries = await this.staffSalariesRepository.find(
        {
          where,
          relations: [
            "status",
            "createdBy",
            "updatedBy",
            "staff",
            "vendor",
            "accessKey",
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
      const staffSalary =
        await this.staffSalariesRepository.findOne({
          where: { id },
          relations: [
            "status",
            "createdBy",
            "updatedBy",
            "staff",
            "vendor",
            "accessKey",
          ],
        });

      if (!staffSalary) {
        throw new NotFoundException(
          `Staff Salary with ID ${id} not found`,
        );
      }

      return this.responseMapperService.mapEntityToResponse(staffSalary);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching staff salaries:", error);
      throw new Error("Failed to fetch staff salaries");
    }
  }

  async create(
    createStaffSalaryDto: CreateStaffSalaryDto,
    userId: number,
    accessKeyId?: number,
  ): Promise<any> {
    try {
      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newStaffSalary = this.staffSalariesRepository.create({
        staff_id: createStaffSalaryDto.staff_id,
        staff_vendor_id: createStaffSalaryDto.staff_vendor_id,
        access_key_id: accessKeyId,
        status_id: createStaffSalaryDto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedStaffSalary =
        await this.staffSalariesRepository.save(newStaffSalary);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffSalariesService",
          method: "create",
          raw_data: JSON.stringify(savedStaffSalary),
          description: `Created staff vendor salary ${savedStaffSalary.id}`,
          status_id: 1,
        },
        userId,
      );

      const staffSalaryWithRelations =
        await this.staffSalariesRepository.findOne({
          where: { id: savedStaffSalary.id },
          relations: [
            "status",
            "createdBy",
            "updatedBy",
            "staff",
            "vendor",
            "accessKey",
          ],
        });

      if (!staffSalaryWithRelations) {
        throw new Error("Failed to retrieve created staff salary");
      }

      const response = this.responseMapperService.mapEntityToResponse(
        staffSalaryWithRelations,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitCreate(
          "staff_salaries",
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
    updateStaffSalaryDto: UpdateStaffSalaryDto,
    userId: number,
  ): Promise<any> {
    try {
      const staffSalary =
        await this.staffSalariesRepository.findOne({
          where: { id },
          relations: ["createdBy"],
        });

      if (!staffSalary) {
        throw new NotFoundException(
          `Staff Salary with ID ${id} not found`,
        );
      }

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      Object.assign(staffSalary, updateStaffSalaryDto, {
        updated_by: userId,
      });

      await this.staffSalariesRepository.save(staffSalary);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffVendorSalariesService",
          method: "update",
          raw_data: JSON.stringify(staffSalary),
          description: `Updated staff vendor salary ${staffSalary.id}`,
          status_id: 1,
        },
        userId,
      );

      const staffVendorSalaryWithRelations =
        await this.staffSalariesRepository.findOne({
          where: { id: staffSalary.id },
          relations: [
            "status",
            "createdBy",
            "updatedBy",
            "staff",
            "vendor",
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
      const staffSalary =
        await this.staffSalariesRepository.findOne({
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

      if (!staffSalary) {
        throw new NotFoundException(
          `Staff Salary with ID ${id} not found`,
        );
      }

      const newStatusId = staffSalary.status_id === 1 ? 2 : 1;
      const newStatusName = newStatusId === 1 ? "ACTIVE" : "INACTIVE";

      await this.staffSalariesRepository.update(id, {
        status_id: newStatusId,
      });

      const updatedStaffSalary =
        await this.staffSalariesRepository.findOne({
          where: { id },
          relations: [
            "status",
            "createdBy",
            "updatedBy",
            "staff",
            "vendor",
          ],
        });

      if (!updatedStaffSalary) {
        throw new Error("Failed to retrieve updated staff salary");
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffVendorSalariesService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedStaffSalary),
          description: `Toggled status for staff salary ${id} to ${newStatusName}`,
          status_id: 1,
        },
        userId,
      );

      const response = this.responseMapperService.mapEntityToResponse(
        updatedStaffSalary,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate(
          "staff_salaries",
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
