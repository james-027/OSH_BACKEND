import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { StaffWarehouse } from "src/entities/StaffWarehouse";
import { Staff } from "src/entities/Staff";
import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import { CreateStaffWarehouseDto } from "src/modules/staff-warehouses/dto/CreateStaffWarehouseDto";
import { UpdateStaffWarehouseDto } from "src/modules/staff-warehouses/dto/UpdateStaffWarehouseDto";
import logger from "../../../config/logger";

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
    "accessKey",
  ];

  constructor(
    @InjectRepository(StaffWarehouse)
    private staffWarehousesRepository: Repository<StaffWarehouse>,
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async findAll(accesskeyId?: number): Promise<any[]> {
    try {
      const where: any = {};
      if (accesskeyId !== undefined) {
        where.access_key_id = accesskeyId;
      }
      const records = await this.staffWarehousesRepository.find({
        where,
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
    accessKeyId?: number,
  ): Promise<any> {
    try {
      const user = await this.usersService.findUserById(userId);
      if (!user) {
        throw new BadRequestException("Authenticated user not found");
      }
      const staff = await this.staffRepository.findOne({
        where: { id: createStaffWarehouseDto.staff_id },
      });

      const newRecord = this.staffWarehousesRepository.create({
        staff_id: createStaffWarehouseDto.staff_id,
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
        access_key_id: accessKeyId,
        staff_code: staff.staff_code,
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

      const effectivity_date = updateStaffWarehouseDto.effectivity_date
        ? new Date(updateStaffWarehouseDto.effectivity_date)
        : null;

      const end_date = updateStaffWarehouseDto.end_date
        ? new Date(updateStaffWarehouseDto.end_date)
        : null;

      Object.assign(record, {
        staff: { id: updateStaffWarehouseDto.staff_id } as any,
        warehouse: { id: updateStaffWarehouseDto.warehouse_id } as any,
        location: { id: updateStaffWarehouseDto.location_id } as any,
        vendor: { id: updateStaffWarehouseDto.vendor_id } as any,
        effectivity_date,
        end_date,
        remarks: updateStaffWarehouseDto.remarks,
        status_id: updateStaffWarehouseDto.status_id,
        updated_by: userId,
      });

      await this.staffWarehousesRepository.save(record);

      await this.userAuditTrailCreateService.create(
        {
          service: "StaffWarehousesService",
          method: "update",
          raw_data: JSON.stringify({
            id: record.id,
            staff_id: updateStaffWarehouseDto.staff_id,
            warehouse_id: updateStaffWarehouseDto.warehouse_id,
            location_id: updateStaffWarehouseDto.location_id,
            vendor_id: updateStaffWarehouseDto.vendor_id,
            effectivity_date,
            end_date,
            status_id: updateStaffWarehouseDto.status_id,
          }),
          description: `Updated staff warehouse assignment ${id}`,
          status_id: 1,
        },
        userId,
      );

      const recordWithRelations = await this.staffWarehousesRepository.findOne({
        where: { id },
        relations: this.relationFields,
      });

      if (!recordWithRelations) {
        throw new Error(`Failed to retrieve updated ${this.entityName}`);
      }

      const response =
        this.responseMapperService.mapEntityToResponse(recordWithRelations);

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
      logger.error(error);

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
