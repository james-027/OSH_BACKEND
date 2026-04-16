import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Not } from "typeorm";
import { WarehouseRate } from "../../../entities/WarehouseRate";
import { CreateWarehouseRateDto } from "../dto/CreateWarehouseRateDto";
import { UpdateWarehouseRateDto } from "../dto/UpdateWarehouseRateDto";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { WarehousesService } from "./warehouses.service";
import { UsersService } from "../../users/services/users.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "src/config/logger";

@Injectable()
export class WarehouseRatesService {
  constructor(
    @InjectRepository(WarehouseRate)
    private warehouseRatesRepository: Repository<WarehouseRate>,
    private auditTrailService: UserAuditTrailCreateService,
    private warehousesService: WarehousesService,
    private usersService: UsersService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async findAll(
    accessKeyId?: number,
    userId?: number,
    roleId?: number,
  ): Promise<any[]> {
    let allowedLocationIds: number[] | undefined = undefined;
    if (userId && roleId) {
      const userLocations = await this.usersService[
        "userLocationsRepository"
      ].find({
        where: { user_id: userId, role_id: roleId, status_id: 1 },
        select: ["location_id"],
      });
      allowedLocationIds = userLocations.map((ul) => ul.location_id);
    }
    const query = this.warehouseRatesRepository
      .createQueryBuilder("wr")
      .innerJoinAndSelect("wr.warehouse", "warehouse")
      .innerJoinAndSelect("warehouse.location", "location")
      .innerJoinAndSelect("wr.status", "status")
      .innerJoinAndSelect("wr.createdBy", "createdBy")
      .leftJoinAndSelect("wr.updatedBy", "updatedBy");
    if (accessKeyId !== undefined) {
      query.andWhere("warehouse.access_key_id = :accessKeyId", { accessKeyId });
    }
    if (allowedLocationIds && allowedLocationIds.length > 0) {
      query.andWhere("warehouse.location_id IN (:...allowedLocationIds)", {
        allowedLocationIds,
      });
    }
    const rates = await query.getMany();
    return rates.map((rate) => ({
      id: rate.id,
      warehouse_id: rate.warehouse_id,
      warehouse_ifs: rate.warehouse?.warehouse_ifs,
      warehouse_name: rate.warehouse?.warehouse_name,
      location_id: rate.warehouse ? rate.warehouse.location_id : null,
      location_name:
        rate.warehouse && rate.warehouse.location
          ? rate.warehouse.location.location_name
          : null,
      warehouse_rate: rate.warehouse_rate,
      status_id: rate.status_id,
      status_name: rate.status?.status_name,
      created_at: rate.created_at,
      created_by: rate.created_by,
      updated_by: rate.updated_by,
      modified_at: rate.modified_at,
      created_user: rate.createdBy
        ? `${rate.createdBy.first_name} ${rate.createdBy.last_name}`
        : null,
      updated_user: rate.updatedBy
        ? `${rate.updatedBy.first_name} ${rate.updatedBy.last_name}`
        : null,
    }));
  }

  async findOne(id: number): Promise<any> {
    const rate = await this.warehouseRatesRepository.findOne({
      where: { id },
      relations: ["warehouse", "status", "createdBy", "updatedBy"],
    });
    if (!rate) throw new NotFoundException("Warehouse rate not found");
    return {
      id: rate.id,
      warehouse_id: rate.warehouse_id,
      warehouse_name: rate.warehouse?.warehouse_name,
      warehouse_rate: rate.warehouse_rate,
      status_id: rate.status_id,
      status_name: rate.status?.status_name,
      created_at: rate.created_at,
      created_by: rate.created_by,
      updated_by: rate.updated_by,
      modified_at: rate.modified_at,
      created_user: rate.createdBy
        ? `${rate.createdBy.first_name} ${rate.createdBy.last_name}`
        : null,
      updated_user: rate.updatedBy
        ? `${rate.updatedBy.first_name} ${rate.updatedBy.last_name}`
        : null,
    };
  }

  async create(
    createDto: CreateWarehouseRateDto,
    userId: number,
  ): Promise<any> {
    const { warehouse_ids, warehouse_rate, status_id } = createDto;
    const results = [];
    for (const warehouse_id of warehouse_ids) {
      // Check for duplicate (warehouse_id)
      const exists = await this.warehouseRatesRepository.findOne({
        where: { warehouse_id },
      });
      if (exists) {
        results.push({
          warehouse_id,
          error: "Active warehouse rate already exists for this warehouse.",
        });
        continue;
      }
      const entity = this.warehouseRatesRepository.create({
        warehouse_id,
        warehouse_rate,
        status_id: status_id ?? 1,
        created_by: userId,
        updated_by: userId,
      });
      const saved = await this.warehouseRatesRepository.save(entity);
      await this.auditTrailService.create(
        {
          service: "WarehouseRatesService",
          method: "create",
          raw_data: JSON.stringify({ ...createDto, warehouse_id }),
          description: `Created warehouse rate for warehouse_id ${warehouse_id}`,
          status_id: 1,
        },
        userId,
      );
      results.push(saved);
    }
    // SSE Events
    try {
      this.sseEventEmitter.emitCreateSignal("warehouse_rates", 0);
    } catch (err) {
      logger.error("SSE event failed:", err);
    }
    return results;
  }

  async update(
    id: number,
    updateDto: UpdateWarehouseRateDto,
    userId: number,
  ): Promise<any> {
    const { warehouse_ids, warehouse_rate, status_id } = updateDto;
    // If warehouse_ids is provided, update all matching records, else update the single record by id
    if (warehouse_ids && warehouse_ids.length > 0) {
      const results = [];
      for (const warehouse_id of warehouse_ids) {
        const rate = await this.warehouseRatesRepository.findOne({
          where: { warehouse_id },
        });
        if (!rate) {
          results.push({ warehouse_id, error: "Warehouse rate not found" });
          continue;
        }
        // Check for duplicate (warehouse_id) excluding current id
        const duplicate = await this.warehouseRatesRepository.findOne({
          where: { warehouse_id, id: Not(rate.id) },
        });
        if (duplicate) {
          results.push({
            warehouse_id,
            error: "Active warehouse rate already exists for this warehouse.",
          });
          continue;
        }
        Object.assign(rate, { warehouse_rate, status_id, updated_by: userId });
        const saved = await this.warehouseRatesRepository.save(rate);
        await this.auditTrailService.create(
          {
            service: "WarehouseRatesService",
            method: "update",
            raw_data: JSON.stringify({ ...updateDto, warehouse_id }),
            description: `Updated warehouse rate for warehouse_id ${warehouse_id}`,
            status_id: 1,
          },
          userId,
        );
        results.push(saved);
      }
      // SSE Events
      try {
        this.sseEventEmitter.emitUpdateSignal("warehouse_rates", 0);
      } catch (err) {
        logger.error("SSE event failed for update:", err);
      }
      return results;
    } else {
      // Fallback: update by id
      const rate = await this.warehouseRatesRepository.findOne({
        where: { id },
      });
      if (!rate) throw new NotFoundException("Warehouse rate not found");
      Object.assign(rate, updateDto, { updated_by: userId });
      const saved = await this.warehouseRatesRepository.save(rate);
      await this.auditTrailService.create(
        {
          service: "WarehouseRatesService",
          method: "update",
          raw_data: JSON.stringify(updateDto),
          description: `Updated warehouse rate id ${id}`,
          status_id: 1,
        },
        userId,
      );
      // SSE Events
      try {
        this.sseEventEmitter.emitUpdateSignal("warehouse_rates", 0);
      } catch (err) {
        logger.error("SSE event failed for update:", err);
      }
      return saved;
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    const rate = await this.warehouseRatesRepository.findOne({ where: { id } });
    if (!rate) throw new NotFoundException("Warehouse rate not found");
    rate.status_id = rate.status_id === 1 ? 2 : 1;
    rate.updated_by = userId;
    const newStatusName = rate.status_id === 1 ? "ACTIVE" : "INACTIVE";
    const saved = await this.warehouseRatesRepository.save(rate);
    await this.auditTrailService.create(
      {
        service: "WarehouseRatesService",
        method: "toggleStatus",
        raw_data: JSON.stringify({ id, new_status: rate.status_id }),
        description: `Toggled status for warehouse rate id ${id} to ${newStatusName}`,
        status_id: 1,
      },
      userId,
    );
    // SSE Events
    try {
      this.sseEventEmitter.emitUpdateSignal("warehouse_rates", id);
    } catch (err) {
      logger.error("SSE event failed for update:", err);
    }
    return saved;
  }

  async bulkUploadFromExcel(
    records: any[],
    userId: number,
    allowedLocationIds?: number[],
  ) {
    const warehouses = await this.warehousesService.findAll();
    let inserted_count = 0;
    let updated_count = 0;
    const inserted_row_numbers: number[] = [];
    const updated_row_numbers: number[] = [];
    const errors: any[] = [];
    const success: any[] = [];

    for (const row of records) {
      const warehouse = warehouses.find(
        (w) => w.warehouse_ifs == row.warehouse_ifs,
      );
      if (!warehouse) {
        errors.push({
          row: row.__rowNum__,
          error: `Store not found: STORE IFS ${row.warehouse_ifs}`,
        });
        continue;
      }
      // Location permission check
      if (
        allowedLocationIds &&
        !allowedLocationIds.includes(warehouse.location_id)
      ) {
        errors.push({
          row: row.__rowNum__,
          error: `You do not have permission to upload rates for STORE IFS ${row.warehouse_ifs} (${row.store_name}), based on your allowed location.`,
        });
        continue;
      }
      // Validate status
      let status_id = 1;
      if (row.status === "INACTIVE") status_id = 2;
      else if (row.status === "ACTIVE") status_id = 1;
      else {
        errors.push({
          row: row.__rowNum__,
          error: `Invalid STATUS: '${row.status}'. Allowed values: ACTIVE, INACTIVE.`,
        });
        continue;
      }
      // Validate rate
      if (row.warehouse_rate === null || isNaN(row.warehouse_rate)) {
        errors.push({
          row: row.__rowNum__,
          error: `Missing or invalid RATES value for STORE IFS ${row.warehouse_ifs} (${row.store_name}).`,
        });
        continue;
      }
      try {
        // Check for duplicate (active/inactive)
        const exists = await this.warehouseRatesRepository.findOne({
          where: { warehouse_id: warehouse.id },
        });
        if (!exists) {
          // Insert
          const entity = this.warehouseRatesRepository.create({
            warehouse_id: warehouse.id,
            warehouse_rate: row.warehouse_rate,
            status_id,
            created_by: userId,
            updated_by: userId,
          });
          await this.warehouseRatesRepository.save(entity);
          inserted_count++;
          inserted_row_numbers.push(row.__rowNum__);
          success.push({
            store_ifs: row.warehouse_ifs,
            store_name: row.store_name,
            warehouse_rate: row.warehouse_rate,
            status: row.status,
            __rowNum__: row.__rowNum__,
          });
        } else {
          // Update
          exists.warehouse_rate = row.warehouse_rate;
          exists.status_id = status_id;
          exists.updated_by = userId;
          await this.warehouseRatesRepository.save(exists);
          updated_count++;
          updated_row_numbers.push(row.__rowNum__);
          success.push({
            store_ifs: row.warehouse_ifs,
            store_name: row.store_name,
            warehouse_rate: row.warehouse_rate,
            status: row.status,
            __rowNum__: row.__rowNum__,
          });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        errors.push({ row: row.__rowNum__, error: errorMessage });
      }
    }
    if (inserted_count > 0 || updated_count > 0) {
      // SSE Events
      try {
        this.sseEventEmitter.emitCreateSignal("warehouse_rates", 0);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }
    }
    return {
      inserted_count,
      updated_count,
      inserted_row_numbers,
      updated_row_numbers,
      errors,
      success,
    };
  }
}
