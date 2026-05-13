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

import { AuditFormDetails } from "src/entities/AuditFormDetails";
import { CreateAuditFormDetailsDto } from "src/modules/audit-form-details/dto/CreateAuditFormDetailsDto";
import { UpdateAuditFormDetailsDto } from "src/modules/audit-form-details/dto/UpdateAuditFormDetailsDto";
import { ResponseMapperService } from "src/services/response-mapper.service";
import { SSEEventEmitterHelper } from "src/modules/sse/services/sse-event-emitter.helper";
import logger from "src/config/logger";
import { Employee } from "src/entities/Employee";

@Injectable()
export class AuditFormDetailsService {
  constructor(
    @InjectRepository(AuditFormDetails)
    private auditFormDetailsRepository: Repository<AuditFormDetails>,
  @ InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async findAll(): Promise<any[]> {
    try {
      const auditFormDetails = await this.auditFormDetailsRepository.find({
        relations: ["status", "createdBy", "updatedBy", "auditForm","groupBusinessCenterHead","regionalHead","areaHead","groupAreaHead","location", "warehouse", "auditBy"],
      });



      return this.responseMapperService.mapEntitiesToResponse(auditFormDetails);
    } catch (error) {
      console.error("Error fetching audit form details:", error);
      throw new Error("Failed to fetch audit form details");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const auditFormDetail = await this.auditFormDetailsRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy", "auditForm","groupBusinessCenterHead","regionalHead","areaHead","groupAreaHead","location", "warehouse", "auditBy"],
      });

      if (!auditFormDetail) {
        throw new NotFoundException(`AuditFormDetail with ID ${id} not found`);
      }

      return this.responseMapperService.mapEntityToResponse(auditFormDetail);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching audit form details:", error);
      throw new Error("Failed to fetch audit form details");
    }
  }

  async create(
    createAuditFormDetailsDto: CreateAuditFormDetailsDto,
    userId: number,
  ): Promise<any> {
    try {
      const existingAuditFormDetails = await this.auditFormDetailsRepository.findOne({
        where: {
          audit_reference_id: createAuditFormDetailsDto.audit_reference_id,
        }
        
      });

      if (existingAuditFormDetails) {
        throw new BadRequestException(
          "Audit Form Reference ID already exists",
        );
      }

      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const storeSpecialist = await this.employeeRepository.findOne({
        where: {
          employee_number: createAuditFormDetailsDto.store_specialist,
        },
      });



      if (!storeSpecialist) {
        throw new BadRequestException("Store specialist not found");
      }

      return storeSpecialist.id;

      const newAuditFormDetail = this.auditFormDetailsRepository.create({
        audit_reference_id: createAuditFormDetailsDto.audit_reference_id,
        audit_month: createAuditFormDetailsDto.audit_month,
        audit_date: createAuditFormDetailsDto.audit_date,
        store_crew_name: createAuditFormDetailsDto.store_crew_name,
        store_crew_code: createAuditFormDetailsDto.store_crew_code,
        agency: createAuditFormDetailsDto.agency,
        food_safety_score: createAuditFormDetailsDto.food_safety_score,
        work_instruction_score: createAuditFormDetailsDto.work_instruction_score,
        product_quality_score: createAuditFormDetailsDto.product_quality_score,
        ssop_score: createAuditFormDetailsDto.ssop_score,
        audit_final_score: createAuditFormDetailsDto.audit_final_score,
        computed_at: createAuditFormDetailsDto.computed_at,
        audit_by: createAuditFormDetailsDto.audit_by,
        store_id: createAuditFormDetailsDto.store_id,
        store_specialist_id: storeSpecialist.id,
        location_id: createAuditFormDetailsDto.location_id,
        audit_form_id: createAuditFormDetailsDto.audit_form_id,
        status_id: createAuditFormDetailsDto.status_id || 1,
      });

      
      const savedAuditFormDetail =
        await this.auditFormDetailsRepository.save(newAuditFormDetail );


      const auditFormDetailWithRelations =
        await this.auditFormDetailsRepository.findOne({
          where: { id: savedAuditFormDetail.id },
          relations: ["status", "createdBy", "updatedBy", "auditForm","groupBusinessCenterHead","regionalHead","areaHead","groupAreaHead","location", "warehouse", "auditBy"],

        });



      if (!auditFormDetailWithRelations) {
        throw new Error("Failed to retrieve created audit form detail");
      }


      // Audit trail
    await this.userAuditTrailCreateService.create(
      {
        service: "AuditFormDetailsService",
        method: "create",
        raw_data: JSON.stringify(auditFormDetailWithRelations),
        description: `Created audit form detail for audit form ${
          auditFormDetailWithRelations.auditForm?.audit_form_name
        }`,
        status_id: 1,
      },
      userId,
    );


      const response = this.responseMapperService.mapEntityToResponse(
        auditFormDetailWithRelations,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitCreate(
          "audit_form_details",
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
        message: "Failed to create  Audit form detail",
        error: err,
      });
    }
  }


  
 async update(
  id: number,
    updateAuditFormDetailsDto: UpdateAuditFormDetailsDto,
  userId: number,
): Promise<any> {
  try {
    const auditFormDetail = await this.auditFormDetailsRepository.findOne({
      where: { id },
      relations: ["categoryType", "auditForm", "createdBy"],
    });

    if (!auditFormDetail) {
      throw new NotFoundException(`AuditFormDetail with ID ${id} not found`);
    }


    const newAuditFormId =
      updateAuditFormDetailsDto.audit_form_id ??
      auditFormDetail.audit_form_id;




    const existing = await this.auditFormDetailsRepository.findOne({
      where: {
        auditForm: { id: newAuditFormId },
      },
      relations: ["categoryType", "auditForm"],
    });



    const updatedByUser = await this.usersService.findUserById(userId);
    if (!updatedByUser) {
      throw new BadRequestException("Authenticated user not found");
    }
    Object.assign(auditFormDetail, updateAuditFormDetailsDto);

    auditFormDetail.auditForm = { id: newAuditFormId } as any;
    auditFormDetail.updated_by = userId;



    await this.auditFormDetailsRepository.save(auditFormDetail);

    


    const auditFormDetailWithRelations =
      await this.auditFormDetailsRepository.findOne({
        where: { id },
        relations: [
          "status",
          "createdBy",
          "updatedBy",
          "categoryType",
          "auditForm",
        ],
      });

    if (!auditFormDetailWithRelations) {
      throw new Error("Failed to retrieve updated audit form detail");
    }

    await this.userAuditTrailCreateService.create(
      {
        service: "AuditFormDetailsService",
        method: "update",
        raw_data: JSON.stringify(auditFormDetailWithRelations),
        description: `Updated audit form detail for audit form ${
          auditFormDetailWithRelations.auditForm?.audit_form_name
        } for audit form ${
          auditFormDetailWithRelations.auditForm?.audit_form_name
        }`,
        status_id: 1,
      },
      userId,
    );

    const response = this.responseMapperService.mapEntityToResponse(
      auditFormDetailWithRelations,
    );

    // SSE Events
    try {
      this.sseEventEmitter.emitUpdate(
        "audit_form_details",
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
      const auditFormDetail = await this.auditFormDetailsRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!auditFormDetail) {
        throw new NotFoundException(`AuditFormDetail with ID ${id} not found`);
      }

      const newStatusId = auditFormDetail.status_id === 1 ? 2 : 1;
      const newStatusName = newStatusId === 1 ? "ACTIVE" : "INACTIVE";

      await this.auditFormDetailsRepository.update(id, {
        status_id: newStatusId,
      });

      const updatedAuditFormDetail = await this.auditFormDetailsRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy", "categoryType", "auditForm"],
      });

      if (!updatedAuditFormDetail) {
        throw new Error("Failed to retrieve updated audit form detail");
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "AuditFormDetailsService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedAuditFormDetail),
          description: `Toggled status for audit form detail ${id} - ${updatedAuditFormDetail.auditForm?.audit_form_name} to ${newStatusName}`,
          status_id: 1,
        },
        userId,
      );

      const response =
        this.responseMapperService.mapEntityToResponse(updatedAuditFormDetail);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate(
          "audit_form_details",
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
