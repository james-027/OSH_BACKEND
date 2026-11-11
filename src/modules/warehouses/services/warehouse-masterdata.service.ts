import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import axios from "axios";
import { Repository, DataSource } from "typeorm";

import { Warehouse } from "src/entities/Warehouse";
import logger from "src/config/logger";

@Injectable()
export class WarehouseMasterDataService {
    constructor(
        @InjectRepository(Warehouse)
        private readonly warehouseRepository: Repository<Warehouse>,
        private readonly dataSource: DataSource,
    ) {}

    async syncWarehouses(): Promise<any> {
        try {
            // 1. Fetch data from external API
            const requestBody = {
                userid: process.env.BOS_USER,
                jwt: process.env.BOS_JWT,
            };

            const response = await axios.post(
                `${process.env.BOS_Server}/master/syncwarehousestoctgi-osh.php`,
                requestBody,
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                },
            );

            const rawPayload = response.data?.data || response.data;
            const apiWarehouses = Array.isArray(rawPayload?.warehouses)
                ? rawPayload.warehouses
                : [];

            if (!apiWarehouses.length) {
                return { message: "No warehouse data returned from API." };
            }

            // 2. Fetch active warehouse_types to map `u_group` -> `warehouse_type_id`
            const warehouseTypes: { id: number; warehouse_type_abbr: string }[] =
                await this.dataSource.query(
                    `SELECT id, warehouse_type_abbr FROM warehouse_types WHERE status_id = 1`
                );

            const typeMap = new Map<string, number>();
            warehouseTypes.forEach((type) => {
                if (type.warehouse_type_abbr) {
                    typeMap.set(type.warehouse_type_abbr.trim().toUpperCase(), type.id);
                }
            });

            // 3. Get existing warehouse codes from DB (normalized to uppercase/trimmed)
            const existingWarehouses = await this.warehouseRepository.find({
                select: ["warehouse_code"],
            });

            const existingCodes = new Set(
                existingWarehouses
                    .filter((w) => w.warehouse_code)
                    .map((w) => w.warehouse_code.trim().toUpperCase())
            );

            // 4. Transform and filter out existing records
            const warehousesToInsert = [];
            let skippedExistingCount = 0;
            let skippedInvalidGroupCount = 0;

            for (const item of apiWarehouses) {
                const rawCode = item.warehouse ? String(item.warehouse).trim() : "";
                const normalizedCode = rawCode.toUpperCase();

                if (!rawCode) {
                    continue;
                }

                // Skip if warehouse_code already exists in DB OR was already queued in this loop
                if (existingCodes.has(normalizedCode)) {
                    skippedExistingCount++;
                    continue;
                }

                const groupAbbr = item.u_group ? String(item.u_group).trim().toUpperCase() : "";
                const warehouseTypeId = typeMap.get(groupAbbr);

                // Skip if u_group doesn't match any warehouse_type_abbr in DB
                if (!warehouseTypeId) {
                    // logger.warn(`Skipping warehouse ${rawCode}: Unknown u_group '${item.u_group}'`);
                    skippedInvalidGroupCount++;
                    continue;
                }

                // Add to Set immediately so duplicates inside the same API payload aren't added twice
                existingCodes.add(normalizedCode);

                warehousesToInsert.push({
                    warehouse_name: item.warehousename ? String(item.warehousename).trim() : "",
                    warehouse_ifs: item.u_profitcenter ? String(item.u_profitcenter).trim() : "",
                    warehouse_code: rawCode,
                    warehouse_type_id: warehouseTypeId,
                    location_id: 15,
                    segment_id: 2,
                    address: "", // Empty string to satisfy non-null varchar(255)
                    status_id: 1,
                    created_by: null,
                    updated_by: null,
                    access_key_id: 1,
                    rem_status_id: 8,
                    pos_availability_id: null,
                    allowance: 0,
                    created_at: new Date(),
                    modified_at: new Date(),
                    start_operation: null,
                    end_operation: null,
                    starting_time: null,
                    ending_time: null,
                });
            }

            // 5. Bulk insert new warehouses
            if (warehousesToInsert.length > 0) {
                await this.warehouseRepository
                    .createQueryBuilder()
                    .insert()
                    .into(Warehouse)
                    .values(warehousesToInsert)
                    .orIgnore()
                    .execute();
            }

            return {
                message: "Warehouse sync completed successfully.",
                totalFetched: apiWarehouses.length,
                totalInserted: warehousesToInsert.length,
                skippedExisting: skippedExistingCount,
                skippedInvalidGroup: skippedInvalidGroupCount,
                warehouses: apiWarehouses, // Returns the extracted warehouses array
            };
        } catch (error) {
            logger.error("Error syncing warehouse data:", error);
            throw new InternalServerErrorException("Failed to sync warehouse data.");
        }
    }

    async findAll() {
        return this.warehouseRepository
        .createQueryBuilder("warehouse")
        .innerJoin("warehouse.warehouseType", "warehouseType")
        .select([
            "warehouse.warehouse_name",
            "warehouse.warehouse_ifs",
            "warehouse.warehouse_code",
            "warehouse.warehouse_type_id",
        ])
        .where("warehouseType.warehouse_type_abbr IN (:...abbrs)", {
            abbrs: ["CG", "IBG"],
        })
        .orderBy("warehouse.id", "ASC")
        .getMany();
    }
}