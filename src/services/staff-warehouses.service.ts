import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { StaffWarehouse } from "src/entities/StaffWarehouse";
import { UsersService } from "./users.service";
import { UserAuditTrailCreateService } from "./user-audit-trail-create.service";
import { ResponseMapperService } from "./response-mapper.service";
import { SSEEventEmitterHelper } from "./sse-event-emitter.helper";
import { CreateStaffWarehouseDto } from "src/dto/CreateStaffWarehouseDto";
import { UpdateStaffWarehouseDto } from "src/dto/UpdateStaffWarehouseDto";
import logger from "../config/logger";

@Injectable()
export class StaffWarehousesService {
  private readonly entityName = "StaffWarehouse";
  private readonly relationFields = [
    "status",
    "createdBy",
    "updatedBy",
    "staff",
    "warehouse",
    "location",
    "vendor",
  ];

  constructor(
    @InjectRepository(StaffWarehouse)
    private staffWarehousesRepository: Repository<StaffWarehouse>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async findAll(): Promise<any[]> {
    try {
      const records = await this.staffWarehousesRepository.find({
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
      const record = await this.staffWarehousesRepository.findOne({
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
    createStaffWarehouseDto: CreateStaffWarehouseDto,
    userId: number,
  ): Promise<any> {
    try {
      const user = await this.usersService.findUserById(userId);
      if (!user) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newRecord = this.staffWarehousesRepository.create({
        staff_id: createStaffWarehouseDto.staff_id,
        staff_code: createStaffWarehouseDto.staff_code,
        warehouse_id: createStaffWarehouseDto.warehouse_id,
        location_id: createStaffWarehouseDto.location_id,
        vendor_id: createStaffWarehouseDto.vendor_id,
        effectivity_date: createStaffWarehouseDto.effectivity_date
          ? new Date(createStaffWarehouseDto.effectivity_date)
          : null,
        end_date: createStaffWarehouseDto.end_date
          ? new Date(createStaffWarehouseDto.end_date)
          : null,
        remarks: createStaffWarehouseDto.remarks || null,
        status_id: createStaffWarehouseDto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedRecord = await this.staffWarehousesRepository.save(newRecord);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffWarehousesService",
          method: "create",
          raw_data: JSON.stringify(savedRecord),
          description: `Created staff warehouse assignment for staff ${savedRecord.staff_id} at warehouse ${savedRecord.warehouse_id}`,
          status_id: 1,
        },
        userId,
      );

      const recordWithRelations = await this.staffWarehousesRepository.findOne({
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
          "staff_warehouses",
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
    updateStaffWarehouseDto: UpdateStaffWarehouseDto,
    userId: number,
  ): Promise<any> {
    try {
      const record = await this.staffWarehousesRepository.findOne({
        where: { id },
        relations: this.relationFields,
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

      // Handle date conversions
      const updateData = { ...updateStaffWarehouseDto };
      if (updateData.effectivity_date) {
        updateData.effectivity_date = new Date(
          updateData.effectivity_date,
        ) as any;
      }
      if (updateData.end_date) {
        updateData.end_date = new Date(updateData.end_date) as any;
      }

      Object.assign(record, updateData, {
        updated_by: userId,
      });

      await this.staffWarehousesRepository.save(record);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffWarehousesService",
          method: "update",
          raw_data: JSON.stringify(record),
          description: `Updated staff warehouse assignment ${id}`,
          status_id: 1,
        },
        userId,
      );

      const recordWithRelations = await this.staffWarehousesRepository.findOne({
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
          "staff_warehouses",
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
      const record = await this.staffWarehousesRepository.findOne({
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

      await this.staffWarehousesRepository.update(id, {
        status_id: newStatusId,
      } as any);

      const updatedRecord = await this.staffWarehousesRepository.findOne({
        where: { id },
        relations: this.relationFields,
      });

      if (!updatedRecord) {
        throw new Error(`Failed to retrieve updated ${this.entityName}`);
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "StaffWarehousesService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedRecord),
          description: `Toggled status for staff warehouse ${id} to ${newStatusName}`,
          status_id: 1,
        },
        userId,
      );

      const response =
        this.responseMapperService.mapEntityToResponse(updatedRecord);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate(
          "staff_warehouses",
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
