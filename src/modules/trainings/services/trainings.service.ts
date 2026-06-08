import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";

import { Training } from "src/entities/Training";
import { CreateTrainingDto } from "src/modules/trainings/dto/CreateTrainingDto";
import { UpdateTrainingDto } from "src/modules/trainings/dto/UpdateTrainingDto";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "../../../config/logger";

@Injectable()
export class TrainingService {
  constructor(
    @InjectRepository(Training)
    private trainingsRepository: Repository<Training>,
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

      const trainings = await this.trainingsRepository.find({
        where,
        relations: [
          "status",
          "createdBy",
          "updatedBy",
          "accessKey",
        ],
      });

      return this.responseMapperService.mapEntitiesToResponse(trainings);
    } catch (error) {
      console.error("Error fetching trainings:", error);
      throw new Error("Failed to fetch trainings");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const training = await this.trainingsRepository.findOne({
        where: { id },
        relations: [
          "status",
          "createdBy",
          "updatedBy",
          "category",
          "accessKey",
        ],
      });

      if (!training) {
        throw new NotFoundException(`Training with ID ${id} not found`);
      }

      return this.responseMapperService.mapEntityToResponse(training);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching trainings:", error);
      throw new Error("Failed to fetch trainings");
    }
  }

  async create(
    createTrainingDto: CreateTrainingDto,
    userId: number,
    accessKeyId?: number,
  ): Promise<any> {
    try {
      // Check if training with this name already exists
      const existingTraining = await this.trainingsRepository.findOne({
        where: { training_name: createTrainingDto.training_name.toUpperCase() },
      });

      if (existingTraining) {
        throw new BadRequestException("Training with this name already exists");
      }

      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newTraining = this.trainingsRepository.create({
        training_name: createTrainingDto.training_name.toUpperCase(),
        training_abbr: createTrainingDto.training_abbr.toUpperCase(),
        access_key_id: accessKeyId,
        status_id: createTrainingDto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedTraining = await this.trainingsRepository.save(newTraining);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "TrainingsService",
          method: "create",
          raw_data: JSON.stringify(savedTraining),
          description: `Created training ${savedTraining.id} - ${savedTraining.training_name}`,
          status_id: 1,
        },
        userId,
      );

      const trainingWithRelations = await this.trainingsRepository.findOne({
        where: { id: savedTraining.id },
        relations: ["status", "createdBy", "updatedBy", "category"],
      });

      if (!trainingWithRelations) {
        throw new Error("Failed to retrieve created training");
      }

      const response =
        this.responseMapperService.mapEntityToResponse(trainingWithRelations);

      // SSE Events
      try {
        this.sseEventEmitter.emitCreate("trainings", response.id, response);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error("Failed to create training");
    }
  }

  async update(
    id: number,
    updateTrainingDto: UpdateTrainingDto,
    userId: number,
  ): Promise<any> {
    try {
      const training = await this.trainingsRepository.findOne({
        where: { id },
        relations: ["createdBy"],
      });

      if (!training) {
        throw new NotFoundException(`Training with ID ${id} not found`);
      }

      // Check for unique constraints if updating code
      if (updateTrainingDto.training_name) {
        const existingTraining = await this.trainingsRepository.findOne({
          where: {
            training_name: updateTrainingDto.training_name.toUpperCase(),
          },
        });

        if (existingTraining && existingTraining.id !== id) {
          throw new BadRequestException("Training with this name already exists");
        }
      }

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

        Object.assign(training, updateTrainingDto, {
        updated_by: userId,
      });

      await this.trainingsRepository.save(training);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "TrainingsService",
          method: "update",
          raw_data: JSON.stringify(training),
          description: `Updated training ${training.id} - ${training.training_name}`,
          status_id: 1,
        },
        userId,
      );

      const trainingWithRelations = await this.trainingsRepository.findOne({
        where: { id: training.id },
        relations: ["status", "createdBy", "updatedBy", "category"],
      });

      if (!trainingWithRelations) {
        throw new Error("Failed to retrieve updated training");
      }

      const response =
        this.responseMapperService.mapEntityToResponse(trainingWithRelations);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("trainings", response.id, response);
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
      throw new Error("Failed to update training");
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const training = await this.trainingsRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!training) {
        throw new NotFoundException(`Training with ID ${id} not found`);
      }

      const newStatusId = training.status_id === 1 ? 2 : 1;
      const newStatusName = newStatusId === 1 ? "ACTIVE" : "INACTIVE";

      await this.trainingsRepository.update(id, {
        status_id: newStatusId,
      });

      const updatedTraining = await this.trainingsRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy", "category"],
      });

      if (!updatedTraining) {
        throw new Error("Failed to retrieve updated training");
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "TrainingsService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedTraining),
          description: `Toggled status for training ${id} - ${training.training_name} to ${newStatusName}`,
          status_id: 1,
        },
        userId,
      );

      const response =
        this.responseMapperService.mapEntityToResponse(updatedTraining);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("trainings", response.id, response);
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
      throw new Error("Failed to toggle status for vendor");
    }
  }
}
