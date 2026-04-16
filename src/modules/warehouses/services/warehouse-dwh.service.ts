import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Warehouse } from "../../../entities/Warehouse";
import { WarehouseDwhLog } from "../../../entities/WarehouseDwhLog";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import { getCtgiSemsConnection } from "../../../utils/dwh-datasources";
import logger from "src/config/logger";
import { CacheInvalidationService } from "../../cache/services/cache-invalidation.service";

@Injectable()
export class WarehouseDwhService {
  constructor(
    @InjectRepository(Warehouse)
    private warehouseRepository: Repository<Warehouse>,
    @InjectRepository(WarehouseDwhLog)
    private logRepository: Repository<WarehouseDwhLog>,
    private sseEventEmitter: SSEEventEmitterHelper,
    private cacheInvalidationService: CacheInvalidationService,
  ) {}

  async pullAndInsertFromOutlets(
    batchSize = 1000,
    accessKeyId: number = 1,
  ): Promise<{
    inserted: number;
    failed: number;
    fullUniqueUpdates: number;
    individualUpdates: number;
  }> {
    const sourceConn = await getCtgiSemsConnection();
    const [rows] = await sourceConn.execute(
      `SELECT outletIFS, outletCode, outletDesc, brnID, ownID, address, status FROM outlets where status < 7`,
    );
    let inserted = 0;
    let failed = 0;
    let fullUniqueUpdates = 0;
    let individualUpdates = 0;
    const total = (rows as any[]).length;
    for (let i = 0; i < total; i += batchSize) {
      let batch = (rows as any[]).slice(i, i + batchSize);
      // Filter out duplicates within the batch by warehouse_ifs, warehouse_code, warehouse_name
      const seenIfs = new Set();
      const seenCode = new Set();
      const seenName = new Set();
      batch = batch.filter((row) => {
        const ifsKey = row.outletIFS;
        const codeKey = row.outletCode;
        const nameKey = row.outletDesc;
        const statusMap: { [key: number]: number } = {
          1: 8,
          0: 9,
          2: 10,
          3: 11,
          4: 12,
        };
        const statusNum = Number(row.status);
        row.remStatusId = statusMap.hasOwnProperty(statusNum)
          ? statusMap[statusNum]
          : 8;

        if (
          seenIfs.has(ifsKey) ||
          seenCode.has(codeKey) ||
          seenName.has(nameKey)
        ) {
          return false;
        }
        seenIfs.add(ifsKey);
        seenCode.add(codeKey);
        seenName.add(nameKey);
        return true;
      });
      for (const row of batch) {
        try {
          // 1. Try to find by full unique combination
          let existing = await this.warehouseRepository.findOne({
            where: {
              warehouse_ifs: row.outletIFS,
              warehouse_code: row.outletCode,
              warehouse_name: row.outletDesc,
            },
          });
          // 2. If not found, check individually by warehouse_ifs, warehouse_code, warehouse_name
          if (!existing) {
            existing = await this.warehouseRepository.findOne({
              where: { warehouse_ifs: row.outletIFS },
            });
            if (!existing) {
              existing = await this.warehouseRepository.findOne({
                where: { warehouse_code: row.outletCode },
              });
            }
            if (!existing) {
              existing = await this.warehouseRepository.findOne({
                where: { warehouse_name: row.outletDesc },
              });
            }
            // If found by individual field, update all fields to match the source
            if (existing) {
              let needsUpdate = false;
              if (existing.warehouse_ifs !== row.outletIFS) {
                existing.warehouse_ifs = row.outletIFS;
                needsUpdate = true;
              }
              if (existing.warehouse_code !== row.outletCode) {
                existing.warehouse_code = row.outletCode;
                needsUpdate = true;
              }
              if (existing.warehouse_name !== row.outletDesc) {
                existing.warehouse_name = row.outletDesc;
                needsUpdate = true;
              }
              if (existing.location_id !== row.brnID) {
                existing.location_id = row.brnID;
                needsUpdate = true;
              }
              if (existing.segment_id !== row.ownID) {
                existing.segment_id = row.ownID;
                needsUpdate = true;
              }
              if (existing.address !== row.address && existing.address != "") {
                existing.address = row.address ? row.address : "";
                needsUpdate = true;
              }
              if (existing.rem_status_id !== row.remStatusId) {
                existing.rem_status_id = row.remStatusId;
                needsUpdate = true;
              }
              if (needsUpdate) {
                existing.access_key_id = accessKeyId;
                await this.warehouseRepository.save(existing);
                individualUpdates++;
              }
              continue;
            }
          } else {
            // If found by full unique combination, update location_id, brand_id, address if needed
            let needsUpdate = false;
            let remarks = "";
            if (existing.location_id !== row.brnID) {
              existing.location_id = row.brnID;
              needsUpdate = true;
            }
            if (existing.segment_id !== row.ownID) {
              existing.segment_id = row.ownID;
              needsUpdate = true;
            }
            if (existing.address !== row.address && existing.address != "") {
              existing.address = row.address ? row.address : "";
              needsUpdate = true;
            }
            if (existing.rem_status_id !== row.remStatusId) {
              existing.rem_status_id = row.remStatusId;
              needsUpdate = true;
            }
            if (needsUpdate) {
              existing.access_key_id = accessKeyId;
              await this.warehouseRepository.save(existing);
              fullUniqueUpdates++;
            }
            continue;
          }
          // 3. If not found at all, insert new warehouse
          const warehouse = this.warehouseRepository.create({
            warehouse_ifs: row.outletIFS,
            warehouse_code: row.outletCode,
            warehouse_name: row.outletDesc,
            location_id: row.brnID,
            segment_id: row.ownID,
            address: row.address ? row.address : "",
            status_id: 1,
            rem_status_id: row.remStatusId,
            warehouse_type_id: 1,
            access_key_id: accessKeyId,
          });
          await this.warehouseRepository.save(warehouse);
          inserted++;
        } catch (err) {
          failed++;
          const error = err as Error;
          await this.logRepository.save(
            this.logRepository.create({
              error: error.message,
              row_data: JSON.stringify(row),
            }),
          );
        }
      }
    }

    if (inserted > 0) {
      // SSE Events
      try {
        this.sseEventEmitter.emitCreateSignal("warehouses", 0);
        this.sseEventEmitter.emitUpdateSignal("req_transactions", 0);
        await this.cacheInvalidationService.invalidateReqTransactions();
        await this.cacheInvalidationService.invalidateWarehouseRequirements();
        await this.cacheInvalidationService.invalidateWarehouses();
      } catch (err) {
        logger.error("SSE event failed:", err);
      }
    }
    if (fullUniqueUpdates + individualUpdates > 0) {
      // SSE Events
      try {
        this.sseEventEmitter.emitUpdateSignal("warehouses", 0);
        this.sseEventEmitter.emitUpdateSignal("req_transactions", 0);
        await this.cacheInvalidationService.invalidateReqTransactions();
        await this.cacheInvalidationService.invalidateWarehouseRequirements();
        await this.cacheInvalidationService.invalidateWarehouses();
      } catch (err) {
        logger.error("SSE event failed for update:", err);
      }
    }

    await sourceConn.release();
    return { inserted, failed, fullUniqueUpdates, individualUpdates };
  }

  async scheduledPullAndInsertFromOutlets(
    batchSize: number,
    accessKeyId: number,
  ): Promise<void> {
    await this.pullAndInsertFromOutlets(batchSize, accessKeyId);
  }
}
