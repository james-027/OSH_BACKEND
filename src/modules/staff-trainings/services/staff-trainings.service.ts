import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";

import { StaffTraining } from "src/entities/StaffTrainings";
import { CreateStaffTrainingDto } from "src/modules/staff-trainings/dto/CreateStaffTrainingDto";
import { UpdateStaffTrainingDto } from "src/modules/staff-trainings/dto/UpdateStaffTrainingDto";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "../../../config/logger";

@Injectable()
export class StaffTrainingService {
  constructor(
    @InjectRepository(StaffTraining)
    private staffTrainingsRepository: Repository<StaffTraining>,
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
      const staffTrainings = await this.staffTrainingsRepository.find(
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
          ],
        },
      );

      return this.responseMapperService.mapEntitiesToResponse(
        staffTrainings,
      );
    } catch (error) {
      console.error("Error fetching staff trainings:", error);
      throw new Error("Failed to fetch staff trainings");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const staffTraining =
        await this.staffTrainingsRepository.findOne({
          where: { id },
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

      if (!staffTraining) {
        throw new NotFoundException(
          `Staff Training with ID ${id} not found`,
        );
      }

      return this.responseMapperService.mapEntityToResponse(staffTraining);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching staff trainings:", error);
      throw new Error("Failed to fetch staff trainings");
    }
  }

  async create(
    createStaffTrainingDto: CreateStaffTrainingDto,
    userId: number,
    accessKeyId?: number,
  ): Promise<any> {
    try {
      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newStaffTraining = this.staffTrainingsRepository.create({
        staff_id: createStaffTrainingDto.staff_id,
        training_id: createStaffTrainingDto.training_id,
        employee_id: createStaffTrainingDto.employee_id,
        sub_status_id: createStaffTrainingDto.sub_status_id,
        warehouse_id: createStaffTrainingDto.warehouse_id,
        training_start_date: createStaffTrainingDto.training_start_date,
        training_end_date: createStaffTrainingDto.training_end_date,
        ratings: createStaffTrainingDto.ratings,
        remarks: createStaffTrainingDto.remarks,
        status_id: createStaffTrainingDto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedStaffTraining =
        await this.staffTrainingsRepository.save(newStaffTraining);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffTrainingsService",
          method: "create",
          raw_data: JSON.stringify(savedStaffTraining),
          description: `Created staff training ${savedStaffTraining.id}`,
          status_id: 1,
        },
        userId,
      );

      const staffTrainingWithRelations =
        await this.staffTrainingsRepository.findOne({
          where: { id: savedStaffTraining.id },
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

      if (!staffTrainingWithRelations) {
        throw new Error("Failed to retrieve created staff training");
      }

      const response = this.responseMapperService.mapEntityToResponse(
        staffTrainingWithRelations,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitCreate(
          "staff_trainings",
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
      throw new Error("Failed to create staff training");
    }
  }

  async update(
    id: number,
    updateStaffTrainingDto: UpdateStaffTrainingDto,
    userId: number,
  ): Promise<any> {
    try {
      const staffTraining =
        await this.staffTrainingsRepository.findOne({
          where: { id },
          relations: ["createdBy"],
        });

      if (!staffTraining) {
        throw new NotFoundException(
          `Staff Training with ID ${id} not found`,
        );
      }

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      Object.assign(staffTraining, updateStaffTrainingDto, {
        updated_by: userId,
      });

      await this.staffTrainingsRepository.save(staffTraining);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffTrainingsService",
          method: "update",
          raw_data: JSON.stringify(staffTraining),
          description: `Updated staff training ${staffTraining.id}`,
          status_id: 1,
        },
        userId,
      );

      const staffTrainingWithRelations =
        await this.staffTrainingsRepository.findOne({
          where: { id: staffTraining.id },
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

      if (!staffTrainingWithRelations) {
        throw new Error("Failed to retrieve updated staff training");
      }

      const response = this.responseMapperService.mapEntityToResponse(
        staffTrainingWithRelations,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate(
          "staff_trainings",
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
      const staffTraining =
        await this.staffTrainingsRepository.findOne({
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

      if (!staffTraining) {
        throw new NotFoundException(
          `Staff Training with ID ${id} not found`,
        );
      }

      const newStatusId = staffTraining.status_id === 1 ? 2 : 1;
      const newStatusName = newStatusId === 1 ? "ACTIVE" : "INACTIVE";

      await this.staffTrainingsRepository.update(id, {
        status_id: newStatusId,
      });

      const updatedStaffTraining =
        await this.staffTrainingsRepository.findOne({
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

      if (!updatedStaffTraining) {
        throw new Error("Failed to retrieve updated staff training");
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffTrainingsService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedStaffTraining),
          description: `Toggled status for staff training ${id} to ${newStatusName}`,
          status_id: 1,
        },
        userId,
      );

      const response = this.responseMapperService.mapEntityToResponse(
        updatedStaffTraining,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate(
          "staff_trainings",
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
      throw new Error("Failed to toggle status for staff training");
    }
  }
}
