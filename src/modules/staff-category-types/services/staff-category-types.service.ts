import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { StaffCategoryType } from "src/entities/StaffCategoryType";
import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import { CreateStaffCategoryTypeDto } from "src/modules/staff-category-types/dto/CreateStaffCategoryTypeDto";
import { UpdateStaffCategoryTypeDto } from "src/modules/staff-category-types/dto/UpdateStaffCategoryTypeDto";
import logger from "../../../config/logger";

@Injectable()
export class StaffCategoryTypesService {
  private readonly entityName = "StaffCategoryType";
  private readonly relationFields = [
    "status",
    "createdBy",
    "updatedBy",
    "staff",
    "categoryType",
  ];

  constructor(
    @InjectRepository(StaffCategoryType)
    private staffCategoryTypesRepository: Repository<StaffCategoryType>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async findAll(): Promise<any[]> {
    try {
      const records = await this.staffCategoryTypesRepository.find({
        relations: this.relationFields,
      });
      return this.responseMapperService.mapEntitiesToResponse(records);
    } catch (error) {
      console.error(`Error fetching ${this.entityName}:`, error);
      throw new Error(`Failed to fetch ${this.entityName}`);
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const record = await this.staffCategoryTypesRepository.findOne({
        where: { id },
        relations: this.relationFields,
      });

      if (!record) {
        throw new NotFoundException(
          `${this.entityName} with ID ${id} not found`,
        );
      }

      return this.responseMapperService.mapEntityToResponse(record);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(`Error fetching ${this.entityName}:`, error);
      throw new Error(`Failed to fetch ${this.entityName}`);
    }
  }

  async create(
    createStaffCategoryTypeDto: CreateStaffCategoryTypeDto,
    userId: number,
  ): Promise<any> {
    try {
      const user = await this.usersService.findUserById(userId);
      if (!user) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newRecord = this.staffCategoryTypesRepository.create({
        staff_id: createStaffCategoryTypeDto.staff_id,
        category_type_id: createStaffCategoryTypeDto.category_type_id,
        status_id: createStaffCategoryTypeDto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedRecord =
        await this.staffCategoryTypesRepository.save(newRecord);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffCategoryTypesService",
          method: "create",
          raw_data: JSON.stringify(savedRecord),
          description: `Created staff category type mapping for staff ${savedRecord.staff_id}`,
          status_id: 1,
        },
        userId,
      );

      const recordWithRelations =
        await this.staffCategoryTypesRepository.findOne({
          where: { id: savedRecord.id },
          relations: this.relationFields,
        });

      if (!recordWithRelations) {
        throw new Error(`Failed to retrieve created ${this.entityName}`);
      }

      const response =
        this.responseMapperService.mapEntityToResponse(recordWithRelations);

      // SSE Events
      try {
        this.sseEventEmitter.emitCreate(
          "staff_category_types",
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
      throw new Error(`Failed to create ${this.entityName}`);
    }
  }

  async update(
    id: number,
    updateStaffCategoryTypeDto: UpdateStaffCategoryTypeDto,
    userId: number,
  ): Promise<any> {
    try {
      const record = await this.staffCategoryTypesRepository.findOne({
        where: { id },
      });

      if (!record) {
        throw new NotFoundException(
          `${this.entityName} with ID ${id} not found`,
        );
      }

      const user = await this.usersService.findUserById(userId);
      if (!user) {
        throw new BadRequestException("Authenticated user not found");
      }

      Object.assign(record, updateStaffCategoryTypeDto, {
        updated_by: userId,
      });

      await this.staffCategoryTypesRepository.save(record);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffCategoryTypesService",
          method: "update",
          raw_data: JSON.stringify(record),
          description: `Updated staff category type mapping ${id}`,
          status_id: 1,
        },
        userId,
      );

      const recordWithRelations =
        await this.staffCategoryTypesRepository.findOne({
          where: { id: record.id },
          relations: this.relationFields,
        });

      if (!recordWithRelations) {
        throw new Error(`Failed to retrieve updated ${this.entityName}`);
      }

      const response =
        this.responseMapperService.mapEntityToResponse(recordWithRelations);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate(
          "staff_category_types",
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
      throw new Error(`Failed to update ${this.entityName}`);
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const record = await this.staffCategoryTypesRepository.findOne({
        where: { id },
        relations: this.relationFields,
      });

      if (!record) {
        throw new NotFoundException(
          `${this.entityName} with ID ${id} not found`,
        );
      }

      const newStatusId = record.status_id === 1 ? 2 : 1;
      const newStatusName = newStatusId === 1 ? "ACTIVE" : "INACTIVE";

      await this.staffCategoryTypesRepository.update(id, {
        status_id: newStatusId,
      } as any);

      const updatedRecord = await this.staffCategoryTypesRepository.findOne({
        where: { id },
        relations: this.relationFields,
      });

      if (!updatedRecord) {
        throw new Error(`Failed to retrieve updated ${this.entityName}`);
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffCategoryTypesService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedRecord),
          description: `Toggled status for staff category type ${id} to ${newStatusName}`,
          status_id: 1,
        },
        userId,
      );

      const response =
        this.responseMapperService.mapEntityToResponse(updatedRecord);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate(
          "staff_category_types",
          response.id,
          response,
        );
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Failed to toggle status for ${this.entityName}`);
    }
  }
}
