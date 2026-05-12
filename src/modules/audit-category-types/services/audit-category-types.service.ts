import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UsersService } from "src/modules/users/services/users.service";
import { UserAuditTrailCreateService } from "src/modules/users/services/user-audit-trail-create.service";

import { AuditFormCategoryTypes } from "src/entities/AuditFormCategoryTypes";
import { CreateAuditCategoryTypeDto } from "src/modules/audit-category-types/dto/CreateAuditCategoryTypeDto";
import { UpdateAuditCategoryTypeDto } from "src/modules/audit-category-types/dto/UpdateAuditCategoryTypeDto";
import { ResponseMapperService } from "src/services/response-mapper.service";
import { SSEEventEmitterHelper } from "src/modules/sse/services/sse-event-emitter.helper";
import logger from "src/config/logger";

@Injectable()
export class AuditCategoryTypesService {
  constructor(
    @InjectRepository(AuditFormCategoryTypes)
    private auditFormCategoryTypesRepository: Repository<AuditFormCategoryTypes>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async findAll(): Promise<any[]> {
    try {
      const categoryTypes = await this.auditFormCategoryTypesRepository.find({
        relations: ["status", "createdBy", "updatedBy", "categoryType", "auditForm"],
      });

      return this.responseMapperService.mapEntitiesToResponse(categoryTypes);
    } catch (error) {
      console.error("Error fetching category types:", error);
      throw new Error("Failed to fetch category types");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const categoryType = await this.auditFormCategoryTypesRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy", "categoryType", "auditForm"],
      });

      if (!categoryType) {
        throw new NotFoundException(`CategoryType with ID ${id} not found`);
      }

      return this.responseMapperService.mapEntityToResponse(categoryType);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching category types:", error);
      throw new Error("Failed to fetch category types");
    }
  }

  async create(
    createAuditCategoryTypeDto: CreateAuditCategoryTypeDto,
    userId: number,
  ): Promise<any> {
    try {
      const existingAuditCategoryType = await this.auditFormCategoryTypesRepository.findOne({
        where: {
          audit_form_id: createAuditCategoryTypeDto.audit_form_id,
          category_type_id: createAuditCategoryTypeDto.category_type_id,
        }
        
      });

      if (existingAuditCategoryType) {
        throw new BadRequestException(
          "Audit Category Type with this ID already exists",
        );
      }

      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newAuditCategoryType = this.auditFormCategoryTypesRepository.create({
        audit_form_id: createAuditCategoryTypeDto.audit_form_id,
        category_type_id: createAuditCategoryTypeDto.category_type_id,
        status_id: createAuditCategoryTypeDto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });
      
      const savedAuditCategoryType =
        await this.auditFormCategoryTypesRepository.save(newAuditCategoryType);


      const auditCategoryTypeWithRelations =
        await this.auditFormCategoryTypesRepository.findOne({
          where: { id: savedAuditCategoryType.id },
          relations: ["status", "createdBy", "updatedBy", "categoryType", "auditForm"],
        });

      if (!auditCategoryTypeWithRelations) {
        throw new Error("Failed to retrieve created audit category type");
      }


      // Audit trail
    await this.userAuditTrailCreateService.create(
      {
        service: "AuditCategoryTypesService",
        method: "create",
        raw_data: JSON.stringify(auditCategoryTypeWithRelations),
        description: `Created category type ${
          auditCategoryTypeWithRelations.categoryType?.category_type_name
        } for audit form ${
          auditCategoryTypeWithRelations.auditForm?.audit_form_name
        }`,
        status_id: 1,
      },
      userId,
    );


      const response = this.responseMapperService.mapEntityToResponse(
        auditCategoryTypeWithRelations,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitCreate(
          "audit_category_types",
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
       const err = error as Error;

       throw new InternalServerErrorException({
        message: "Failed to create  Audit category type",
        error: err,
      });
    }
  }

 async update(
  id: number,
  updateAuditCategoryTypeDto: UpdateAuditCategoryTypeDto,
  userId: number,
): Promise<any> {
  try {
    const auditCategoryType = await this.auditFormCategoryTypesRepository.findOne({
      where: { id },
      relations: ["categoryType", "auditForm", "createdBy"],
    });

    if (!auditCategoryType) {
      throw new NotFoundException(`CategoryType with ID ${id} not found`);
    }

    const newCategoryTypeId =
      updateAuditCategoryTypeDto.category_type_id ??
      auditCategoryType.category_type_id;

    const newAuditFormId =
      updateAuditCategoryTypeDto.audit_form_id ??
      auditCategoryType.audit_form_id;




    const existing = await this.auditFormCategoryTypesRepository.findOne({
      where: {
        auditForm: { id: newAuditFormId },
        categoryType: { id: newCategoryTypeId },
      },
      relations: ["categoryType", "auditForm"],
    });


    if (existing && existing.id !== id) {
      throw new BadRequestException(
        `Category Type "${existing.categoryType?.category_type_name}" 
         already exists in Audit Form "${existing.auditForm?.audit_form_name}"`
      );
    }

    const updatedByUser = await this.usersService.findUserById(userId);
    if (!updatedByUser) {
      throw new BadRequestException("Authenticated user not found");
    }
    Object.assign(auditCategoryType, updateAuditCategoryTypeDto);

    auditCategoryType.auditForm = { id: newAuditFormId } as any;
    auditCategoryType.categoryType = { id: newCategoryTypeId } as any;
    auditCategoryType.updated_by = userId;



    await this.auditFormCategoryTypesRepository.save(auditCategoryType);

    


    const auditCategoryTypeWithRelations =
      await this.auditFormCategoryTypesRepository.findOne({
        where: { id },
        relations: [
          "status",
          "createdBy",
          "updatedBy",
          "categoryType",
          "auditForm",
        ],
      });

    if (!auditCategoryTypeWithRelations) {
      throw new Error("Failed to retrieve updated audit category type");
    }

    await this.userAuditTrailCreateService.create(
      {
        service: "AuditCategoryTypesService",
        method: "update",
        raw_data: JSON.stringify(auditCategoryTypeWithRelations),
        description: `Updated category type ${
          auditCategoryTypeWithRelations.categoryType?.category_type_name
        } for audit form ${
          auditCategoryTypeWithRelations.auditForm?.audit_form_name
        }`,
        status_id: 1,
      },
      userId,
    );

    const response = this.responseMapperService.mapEntityToResponse(
      auditCategoryTypeWithRelations,
    );

    // SSE Events
    try {
      this.sseEventEmitter.emitUpdate(
        "audit_category_types",
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
    throw new Error("Failed to update category type");
  }
} 

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const auditCategoryType = await this.auditFormCategoryTypesRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!auditCategoryType) {
        throw new NotFoundException(`CategoryType with ID ${id} not found`);
      }

      const newStatusId = auditCategoryType.status_id === 1 ? 2 : 1;
      const newStatusName = newStatusId === 1 ? "ACTIVE" : "INACTIVE";

      await this.auditFormCategoryTypesRepository.update(id, {
        status_id: newStatusId,
      });

      const updatedCategoryType = await this.auditFormCategoryTypesRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy", "categoryType", "auditForm"],
      });

      if (!updatedCategoryType) {
        throw new Error("Failed to retrieve updated category type");
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "CategoryTypesService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedCategoryType),
          description: `Toggled status for category type ${id} - ${updatedCategoryType.categoryType?.category_type_name} to ${newStatusName}`,
          status_id: 1,
        },
        userId,
      );

      const response =
        this.responseMapperService.mapEntityToResponse(updatedCategoryType);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate(
          "audit_category_types",
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
      throw new Error("Failed to toggle status for category type");
    }
  }
}
