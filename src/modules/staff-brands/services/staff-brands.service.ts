import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { StaffBrand } from "src/entities/StaffBrand";
import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import { CreateStaffBrandDto } from "src/modules/staff-brands/dto/CreateStaffBrandDto";
import { UpdateStaffBrandDto } from "src/modules/staff-brands/dto/UpdateStaffBrandDto";
import logger from "../../../config/logger";

@Injectable()
export class StaffBrandsService {
  private readonly entityName = "StaffBrand";
  private readonly relationFields = [
    "status",
    "createdBy",
    "updatedBy",
    "staff",
    "brand",
  ];

  constructor(
    @InjectRepository(StaffBrand)
    private staffBrandsRepository: Repository<StaffBrand>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async findAll(): Promise<any[]> {
    try {
      const records = await this.staffBrandsRepository.find({
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
      const record = await this.staffBrandsRepository.findOne({
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
    createStaffBrandDto: CreateStaffBrandDto,
    userId: number,
  ): Promise<any> {
    try {
      const user = await this.usersService.findUserById(userId);
      if (!user) {
        throw new BadRequestException("Authenticated user not found");
      }

      const existingRecord = await this.staffBrandsRepository.findOne({
        where: {
          staff_id: createStaffBrandDto.staff_id,
          brand_id: createStaffBrandDto.brand_id,
        },
      });

      if (existingRecord) {
        throw new BadRequestException("Staff brand mapping with this staff  and brand already exists");
      }

      const newRecord = this.staffBrandsRepository.create({
        staff_id: createStaffBrandDto.staff_id,
        brand_id: createStaffBrandDto.brand_id,
        status_id: createStaffBrandDto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedRecord = await this.staffBrandsRepository.save(newRecord);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffBrandsService",
          method: "create",
          raw_data: JSON.stringify(savedRecord),
          description: `Created staff brand mapping for staff ${savedRecord.staff_id}`,
          status_id: 1,
        },
        userId,
      );

      const recordWithRelations = await this.staffBrandsRepository.findOne({
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
        this.sseEventEmitter.emitCreate("staff_brands", response.id, response);
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
    updateStaffBrandDto: UpdateStaffBrandDto,
    userId: number,
  ): Promise<any> {
    try {
      const record = await this.staffBrandsRepository.findOne({
        where: { id },
      });

      if (!record) {
        throw new NotFoundException(
          `${this.entityName} with ID ${id} not found`,
        );
      }

          const staffId = updateStaffBrandDto.staff_id ?? record.staff_id;
          const brandId = updateStaffBrandDto.brand_id ?? record.brand_id;

          const existingRecord = await this.staffBrandsRepository.findOne({
            where: {
              staff_id: staffId,
              brand_id: brandId,
            },
          });

          if (existingRecord && existingRecord.id !== id) {
            throw new BadRequestException(
              `Staff brand mapping already exists`,
            );
          }

      const user = await this.usersService.findUserById(userId);
      if (!user) {
        throw new BadRequestException("Authenticated user not found");
      }

      Object.assign(record, updateStaffBrandDto, {
        updated_by: userId,
      });

      await this.staffBrandsRepository.save(record);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffBrandsService",
          method: "update",
          raw_data: JSON.stringify(record),
          description: `Updated staff brand mapping ${id}`,
          status_id: 1,
        },
        userId,
      );

      const recordWithRelations = await this.staffBrandsRepository.findOne({
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
        this.sseEventEmitter.emitUpdate("staff_brands", response.id, response);
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
      const record = await this.staffBrandsRepository.findOne({
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

      await this.staffBrandsRepository.update(id, {
        status_id: newStatusId,
      } as any);

      const updatedRecord = await this.staffBrandsRepository.findOne({
        where: { id },
        relations: this.relationFields,
      });

      if (!updatedRecord) {
        throw new Error(`Failed to retrieve updated ${this.entityName}`);
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffBrandsService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedRecord),
          description: `Toggled status for staff brand ${id} to ${newStatusName}`,
          status_id: 1,
        },
        userId,
      );

      const response =
        this.responseMapperService.mapEntityToResponse(updatedRecord);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("staff_brands", response.id, response);
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
