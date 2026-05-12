import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";

import { AuditForm } from "src/entities/AuditForm";
import { CreateAuditFormDto } from "src/modules/audit-forms/dto/CreateAuditFormDto";
import { UpdateAuditFormDto } from "src/modules/audit-forms/dto/UpdateAuditFormDto";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "../../../config/logger";

@Injectable()
export class AuditFormService {
  constructor(
    @InjectRepository(AuditForm)
    private auditFormsRepository: Repository<AuditForm>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async findAll(): Promise<any[]> {
    try {
      const auditForms = await this.auditFormsRepository.find({
        relations: ["status", "createdBy", "updatedBy"],
        order:{
          id:"DESC"
        }
      });

      return this.responseMapperService.mapEntitiesToResponse(auditForms);
    } catch (error) {
      console.error("Error fetching audit forms:", error);
      throw new Error("Failed to fetch audit forms");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const auditForm = await this.auditFormsRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],

      });

      if (!auditForm) {
        throw new NotFoundException(`Audit form with ID ${id} not found`);
      }

      return this.responseMapperService.mapEntityToResponse(auditForm);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching audit forms:", error);
      throw new Error("Failed to fetch audit forms");
    }
  }

  async create(
    createAuditFormDto: CreateAuditFormDto,
    userId: number,
  ): Promise<any> {
    try {
      // Check if audit form with this name already exists
      const existingAuditForm = await this.auditFormsRepository.findOne({
        where: { audit_form_name: createAuditFormDto.audit_form_name },
      });

      if (existingAuditForm) {
        throw new BadRequestException("Audit form with this name already exists");
      }

      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newAuditForm = this.auditFormsRepository.create({
        audit_form_name: createAuditFormDto.audit_form_name.toUpperCase(),
        status_id: createAuditFormDto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedAuditForm = await this.auditFormsRepository.save(newAuditForm);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "AuditFormsService",
          method: "create",
          raw_data: JSON.stringify(savedAuditForm),
          description: `Created audit form ${savedAuditForm.id} - ${savedAuditForm.audit_form_name}`,
          status_id: 1,
        },
        userId,
      );

      const auditFormWithRelations = await this.auditFormsRepository.findOne({
        where: { id: savedAuditForm.id },
             relations: ["status", "createdBy", "updatedBy"],

      });

      if (!auditFormWithRelations) {
        throw new Error("Failed to retrieve created audit form");
      }

      const response = this.responseMapperService.mapEntityToResponse(
        auditFormWithRelations,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitCreate("audit_forms", response.id, response);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error("Failed to create category");
    }
  }

  async update(
    id: number,
    updateAuditFormDto: UpdateAuditFormDto,
    userId: number,
  ): Promise<any> {
    try {
      const auditForm = await this.auditFormsRepository.findOne({
        where: { id },
        relations: ["createdBy"],
      });

      if (!auditForm) {
        throw new NotFoundException(`Audit form with ID ${id} not found`);
      }

      // Check for unique constraints if updating name
      if (updateAuditFormDto.audit_form_name) {
        const whereConditions = [];
        if (updateAuditFormDto.audit_form_name) {
          whereConditions.push({
            audit_form_name: updateAuditFormDto.audit_form_name,
          });
        }

        const existingAuditForm = await this.auditFormsRepository.findOne({
          where: whereConditions,
        });

        if (existingAuditForm && existingAuditForm.id !== id) {
          throw new BadRequestException(
            "Audit form with this name already exists",
          );
        }
      }

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      if (updateAuditFormDto.audit_form_name) {
        updateAuditFormDto.audit_form_name =
          updateAuditFormDto.audit_form_name.toUpperCase();
      }

      Object.assign(auditForm, updateAuditFormDto, {
        updated_by: userId,
      });

      await this.auditFormsRepository.save(auditForm);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "AuditFormsService",
          method: "update",
          raw_data: JSON.stringify(auditForm),
          description: `Updated audit form ${auditForm.id} - ${auditForm.audit_form_name}`,
          status_id: 1,
        },
        userId,
      );

      const auditFormWithRelations = await this.auditFormsRepository.findOne({
        where: { id: auditForm.id },
               relations: ["status", "createdBy", "updatedBy"],

      });

      if (!auditFormWithRelations) {
        throw new Error("Failed to retrieve updated audit form");
      }

      const response = this.responseMapperService.mapEntityToResponse(
        auditFormWithRelations,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("audit_forms", response.id, response);
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
      throw new Error("Failed to update audit form");
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const auditForm = await this.auditFormsRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!auditForm) {
        throw new NotFoundException(`Audit form with ID ${id} not found`);
      }

      const newStatusId = auditForm.status_id === 1 ? 2 : 1;
      const newStatusName = newStatusId === 1 ? "ACTIVE" : "INACTIVE";

      await this.auditFormsRepository.update(id, {
        status_id: newStatusId,
      });

      const updatedAuditForm = await this.auditFormsRepository.findOne({
        where: { id },
               relations: ["status", "createdBy", "updatedBy"],

      });

      if (!updatedAuditForm) {
        throw new Error("Failed to retrieve updated audit form");
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "AuditFormsService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedAuditForm),
          description: `Toggled status for audit form ${id} - ${auditForm.audit_form_name} to ${newStatusName}`,
          status_id: 1,
        },
        userId,
      );

      const response =
        this.responseMapperService.mapEntityToResponse(updatedAuditForm);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("audit_forms", response.id, response);
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
      throw new Error("Failed to toggle status for audit form");
    }
  }
}
