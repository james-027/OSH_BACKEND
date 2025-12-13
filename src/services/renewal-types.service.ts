import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { UsersService } from "./users.service";
import { UserAuditTrailCreateService } from "./user-audit-trail-create.service";

import { RenewalType } from "src/entities/RenewalType";
import { CreateRenewalTypeDto } from "src/dto/CreateRenewalTypeDto";
import { UpdateRenewalTypeDto } from "src/dto/UpdateRenewalTypeDto";
import { ResponseMapperService } from "./response-mapper.service";
import { SSEEventEmitterHelper } from "./sse-event-emitter.helper";
import logger from "../config/logger";

@Injectable()
export class RenewalTypesService {
  constructor(
    @InjectRepository(RenewalType)
    private renewalTypesRepository: Repository<RenewalType>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper
  ) {}

  async findAll(): Promise<any[]> {
    try {
      const renewalTypes = await this.renewalTypesRepository.find({
        relations: ["status", "createdBy", "updatedBy"],
      });

      return this.responseMapperService.mapEntitiesToResponse(renewalTypes);
    } catch (error) {
      console.error("Error fetching renewal types:", error);
      throw new Error("Failed to fetch renewal types");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const renewalType = await this.renewalTypesRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!renewalType) {
        throw new NotFoundException(`RenewalType with ID ${id} not found`);
      }

      return this.responseMapperService.mapEntityToResponse(renewalType);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching renewal types:", error);
      throw new Error("Failed to fetch renewal types");
    }
  }

  async create(
    createRenewalTypeDto: CreateRenewalTypeDto,
    userId: number
  ): Promise<any> {
    try {
      // Check if renewal type with this name already exists
      const existingRenewalType = await this.renewalTypesRepository.findOne({
        where: { renewal_type_name: createRenewalTypeDto.renewal_type_name },
      });

      if (existingRenewalType) {
        throw new BadRequestException(
          "Renewal Type with this name already exists"
        );
      }

      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newRenewalType = this.renewalTypesRepository.create({
        renewal_type_name: createRenewalTypeDto.renewal_type_name.toUpperCase(),
        status_id: createRenewalTypeDto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedRenewalType =
        await this.renewalTypesRepository.save(newRenewalType);
      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "RenewalTypesService",
          method: "create",
          raw_data: JSON.stringify(savedRenewalType),
          description: `Created renewal type ${savedRenewalType.id} - ${savedRenewalType.renewal_type_name}`,
          status_id: 1,
        },
        userId
      );

      const renewalTypeWithRelations =
        await this.renewalTypesRepository.findOne({
          where: { id: savedRenewalType.id },
          relations: ["status", "createdBy", "updatedBy"],
        });

      if (!renewalTypeWithRelations) {
        throw new Error("Failed to retrieve created renewal type");
      }

      const response = this.responseMapperService.mapEntityToResponse(
        renewalTypeWithRelations
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitCreate("renewal_types", response.id, response);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error("Failed to create renewal type");
    }
  }

  async update(
    id: number,
    updateRenewalTypeDto: UpdateRenewalTypeDto,
    userId: number
  ): Promise<any> {
    try {
      const renewalType = await this.renewalTypesRepository.findOne({
        where: { id },
        relations: ["createdBy"],
      });

      if (!renewalType) {
        throw new NotFoundException(`Renewal Type with ID ${id} not found`);
      }

      // Check for unique constraints if updating name
      if (updateRenewalTypeDto.renewal_type_name) {
        const whereConditions = [];
        if (updateRenewalTypeDto.renewal_type_name) {
          whereConditions.push({
            renewal_type_name: updateRenewalTypeDto.renewal_type_name,
          });
        }

        const existingRenewalType = await this.renewalTypesRepository.findOne({
          where: whereConditions,
        });

        if (existingRenewalType && existingRenewalType.id !== id) {
          throw new BadRequestException(
            "Renewal Type with this name already exists"
          );
        }
      }

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      if (updateRenewalTypeDto.renewal_type_name) {
        updateRenewalTypeDto.renewal_type_name =
          updateRenewalTypeDto.renewal_type_name.toUpperCase();
      }
      Object.assign(renewalType, updateRenewalTypeDto, {
        updated_by: userId,
      });

      await this.renewalTypesRepository.save(renewalType);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "RenewalTypesService",
          method: "update",
          raw_data: JSON.stringify(renewalType),
          description: `Updated renewal type ${renewalType.id} - ${renewalType.renewal_type_name}`,
          status_id: 1,
        },
        userId
      );

      const renewalTypeWithRelations =
        await this.renewalTypesRepository.findOne({
          where: { id: renewalType.id },
          relations: ["status", "createdBy", "updatedBy"],
        });

      if (!renewalTypeWithRelations) {
        throw new Error("Failed to retrieve created renewal type");
      }

      const response = this.responseMapperService.mapEntityToResponse(
        renewalTypeWithRelations
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("renewal_types", response.id, response);
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
      throw new Error("Failed to create renewal type");
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const renewalType = await this.renewalTypesRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!renewalType) {
        throw new NotFoundException(`Renewal Type with ID ${id} not found`);
      }

      const newStatusId = renewalType.status_id === 1 ? 2 : 1;
      const newStatusName = newStatusId === 1 ? "ACTIVE" : "INACTIVE"; // For audit trail

      await this.renewalTypesRepository.update(id, {
        status_id: newStatusId,
      });
      const updatedRenewalType = await this.renewalTypesRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });
      if (!updatedRenewalType) {
        throw new Error("Failed to retrieve updated renewal type");
      }
      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "RenewalTypesService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedRenewalType),
          description: `Toggled status for renewal type ${id} - ${renewalType.renewal_type_name} to ${newStatusName}`,
          status_id: 1,
        },
        userId
      );

      const response =
        this.responseMapperService.mapEntityToResponse(updatedRenewalType);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("renewal_types", response.id, response);
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
      throw new Error("Failed to toggle status for company");
    }
  }
}
