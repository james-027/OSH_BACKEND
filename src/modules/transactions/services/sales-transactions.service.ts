import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SalesTransaction } from "../../../entities/SalesTransaction";
import { CreateSalesTransactionDto } from "../dto/CreateSalesTransactionDto";
import { UpdateSalesTransactionDto } from "../dto/UpdateSalesTransactionDto";
import { Status } from "../../../entities/Status";
import { AccessKey } from "../../../entities/AccessKey";
import { UserLocationsService } from "../../users/services/user-locations.service";
// import { access } from "fs";
import {
  ExcelValidationConfig,
  validateAndFormatExcelRow,
} from "src/utils/excel-validation";
import { Item } from "src/entities/Item";
import { Location } from "../../../entities/Location";
import logger from "src/config/logger";
import { DwhLog } from "src/entities/dwhLog";
import { getMonthNumber, parseToFirstDayOfMonth } from "src/utils/date.utils";

@Injectable()
export class SalesTransactionsService {
  constructor(
    @InjectRepository(SalesTransaction)
    private salesTransactionsRepository: Repository<SalesTransaction>,
    @InjectRepository(DwhLog)
    private dwhLogRepository: Repository<DwhLog>,
    @InjectRepository(Location)
    private locationsRepository: Repository<Location>,
    @InjectRepository(Item)
    private itemRepository: Repository<Item>,
    private userLocationsService: UserLocationsService,
  ) {}

  async findAll(
    accessKeyId?: number,
    userId?: number,
    roleId?: number,
    sales_date?: string,
  ): Promise<any[]> {
    // Get allowed location IDs for user
    let allowedLocationIds: number[] | undefined = undefined;
    if (userId && roleId) {
      const userLocations = await this.userLocationsService[
        "userLocationsRepository"
      ].find({
        where: { user_id: userId, role_id: roleId, status_id: 1 },
        select: ["location_id"],
      });
      allowedLocationIds = userLocations.map((ul) => ul.location_id);
    }
    // Query builder: join warehouses, filter by access_key_id and allowed locations
    const qb = this.salesTransactionsRepository
      .createQueryBuilder("st")
      .leftJoinAndSelect("st.accessKey", "accessKey")
      .leftJoinAndSelect("st.status", "status")
      .innerJoin(
        "warehouses",
        "warehouse",
        "st.whs_code = warehouse.warehouse_ifs",
      )
      .addSelect(["warehouse.access_key_id", "warehouse.location_id"]);
    if (accessKeyId !== undefined) {
      qb.andWhere("warehouse.access_key_id = :accessKeyId", { accessKeyId });
    }
    if (allowedLocationIds && allowedLocationIds.length > 0) {
      qb.andWhere("warehouse.location_id IN (:...allowedLocationIds)", {
        allowedLocationIds,
      });
    }
    if (sales_date !== undefined) {
      qb.andWhere("DATE(st.doc_date) = :sales_date", { sales_date });
    }
    qb.andWhere("st.status_id = :activeStatusId", { activeStatusId: 1 });
    const records = await qb.getMany();
    // Remove 'status' and 'accessKey' properties from each record
    return records.map((rec: any) => {
      const { status, accessKey, ...rest } = rec;
      return {
        ...rest,
        access_key_id: accessKey ? accessKey.id : null,
        access_key_name: accessKey ? accessKey.access_key_name : null,
        status_id: status ? status.id : null,
        status_name: status ? status.status_name : null,
      };
    });
  }

  async findOne(id: number): Promise<any> {
    const rec = await this.salesTransactionsRepository.findOne({
      where: { id },
      relations: ["accessKey", "status"],
    });
    if (!rec) throw new NotFoundException("Sales transaction not found");
    return {
      ...rec,
      access_key_name: rec.accessKey ? rec.accessKey.access_key_name : null,
      status_name: rec.status ? rec.status.status_name : null,
    };
  }

  async create(
    createDto: CreateSalesTransactionDto,
  ): Promise<SalesTransaction> {
    const rec = this.salesTransactionsRepository.create(createDto);
    return this.salesTransactionsRepository.save(rec);
  }

  async update(
    id: number,
    updateDto: UpdateSalesTransactionDto,
  ): Promise<SalesTransaction> {
    const rec = await this.salesTransactionsRepository.findOne({
      where: { id },
    });
    if (!rec) throw new NotFoundException("Sales transaction not found");
    Object.assign(rec, updateDto);
    return this.salesTransactionsRepository.save(rec);
  }

  async remove(id: number): Promise<void> {
    const rec = await this.salesTransactionsRepository.findOne({
      where: { id },
    });
    if (!rec) throw new NotFoundException("Sales transaction not found");
    await this.salesTransactionsRepository.remove(rec);
  }

  async findAllPerLocation(
    user_id?: number,
    role_id?: number,
    current_access_key?: number,
    sales_date?: string,
  ): Promise<any[]> {
    // Get allowed locations for user
    let allowedLocationIds: number[] | undefined = undefined;
    if (user_id && role_id) {
      const userLocations = await this.userLocationsService[
        "userLocationsRepository"
      ].find({
        where: { user_id, role_id, status_id: 1 },
        select: ["location_id"],
      });
      allowedLocationIds = userLocations.map((ul) => ul.location_id);
    }
    // Use query builder for aggregation and join
    const qb = this.salesTransactionsRepository
      .createQueryBuilder("sales")
      .select([
        "location.id AS location_id",
        "location.location_name AS location_name",
        "DATE_FORMAT(sales.doc_date, '%Y-%m-%d') AS sales_date",
        "DATE_FORMAT(DATE(sales.doc_date), '%M %Y') AS month",
        "COUNT(DISTINCT sales.whs_code) AS num_stores",
        "SUM(sales.gross_sales) AS gross_sales",
        "SUM(sales.net_sales) AS net_sales",
        "SUM(sales.quantity) AS total_base_sales_qty",
        "SUM(sales.converted_quantity) AS total_sales_qty",
        "IF(sales.status_id = 1, 'ACTIVE', 'INACTIVE') AS status_name",
        "sales.status_id AS status_id",
      ])
      .innerJoin(
        "location",
        "location",
        "sales.bc_code = location.location_code",
      )
      .where("sales.status_id = :statusId", { statusId: 1 });
    if (allowedLocationIds && allowedLocationIds.length > 0) {
      qb.andWhere("location.id IN (:...allowedLocationIds)", {
        allowedLocationIds,
      });
    }
    if (current_access_key) {
      qb.andWhere("sales.access_key_id = :access_key_id", {
        access_key_id: current_access_key,
      });
    }
    if (sales_date !== undefined) {
      qb.andWhere("DATE(sales.doc_date) = :sales_date", { sales_date });
    }
    qb.groupBy(
      "location.id, DATE_FORMAT(sales.doc_date, '%Y-%m-%d'), sales.status_id",
    )
      .orderBy("location.location_name")
      .addOrderBy("DATE(sales.doc_date)");

    console.log(qb.getSql());

    const rows = await qb.getRawMany();
    return rows.map((row) => ({
      location_id: row.location_id,
      location_name: row.location_name,
      month: row.month,
      sales_date: row.sales_date,
      num_stores: Number(row.num_stores),
      gross_sales: Number(row.gross_sales),
      net_sales: Number(row.net_sales),
      total_sales_qty: Number(row.total_sales_qty),
      total_base_sales_qty: Number(row.total_base_sales_qty),
      status_name: row.status_name,
      status_id: row.status_id,
    }));
  }

  async findOnePerLocation(
    location_id: number,
    doc_date: string,
  ): Promise<any[]> {
    // Join location to get location_code
    // Then group by whs_code (store)
    const qb = this.salesTransactionsRepository
      .createQueryBuilder("sales")
      .select([
        "sales.whs_code AS store_ifs",
        "sales.whs_name AS store_name",
        "sales.doc_date AS month",
        "COUNT(DISTINCT sales.item_code) AS num_items",
        "GROUP_CONCAT(DISTINCT sales.cat02) AS item_categories",
        "SUM(sales.gross_sales) AS gross_sales",
        "SUM(sales.net_sales) AS net_sales",
        "SUM(sales.converted_quantity) AS total_sales_qty",
        "SUM(sales.quantity) AS total_base_sales_qty",
      ])
      .innerJoin(
        "location",
        "location",
        "sales.bc_code = location.location_code",
      )
      .where("location.id = :location_id", { location_id })
      .andWhere("sales.doc_date = :doc_date", { doc_date })
      .andWhere("sales.status_id = :statusId", { statusId: 1 })
      .groupBy("sales.whs_code, sales.whs_name, sales.doc_date")
      .orderBy("sales.whs_name");

    const rows = await qb.getRawMany();
    return rows.map((row) => ({
      store_ifs: row.store_ifs,
      store_name: row.store_name,
      month: row.month,
      num_items: Number(row.num_items),
      item_categories: row.item_categories
        ? row.item_categories.split(",")
        : [],
      gross_sales: Number(row.gross_sales),
      net_sales: Number(row.net_sales),
      total_sales_qty: Number(row.total_sales_qty),
      total_base_sales_qty: Number(row.total_base_sales_qty),
    }));
  }

  /**
   * Process uploaded Excel file with sales transactions
   *
   * FLOW:
   * 1. Read Excel file using XLSX
   * 2. For each row:
   *    a. Validate using validateAndFormatExcelRow()
   *    b. Lookup location by BUSINESS CENTER name → get bc_code
   *    c. Lookup items by ITEMCODE → get cat01, cat02, salesconv, salesuniteq, itemgroup, uom
   *    d. Build row for insertion
   * 3. Batch processing (1000 rows at a time):
   *    a. Mark existing records as status_id=2 (inactive - same as DWH logic)
   *    b. Insert new records in transaction
   * 4. Create DWH log entry with summary
   *
   * @param filePath - Path to uploaded Excel file
   * @param userId - User ID who uploaded
   * @param accessKeyId - Current access key of user
   * @returns { success: number, failed: number }
   */
  async processUploadedSalesTransactions(
    filePath: string,
    userId: number,
    accessKeyId: number,
  ): Promise<any> {
    const XLSX = require("xlsx");
    const fs = require("fs");

    let inserted_count = 0;
    let failed = 0;
    let logMessage = "";
    let displayMessage = "";
    let logError = null;
    const errors: { row: number; error: string }[] = [];
    const inserted_row_numbers: number[] = []; // ✅ Track row numbers of successful inserts
    const unmatchedLocations = new Map<string, number>(); // Track unmatched locations
    const unmatchedItems = new Map<string, number>(); // Track unmatched items
    const toInsert: any[] = [];
    const toInsertRowNumbers: number[] = []; // ✅ Track original row numbers for toInsert
    let rows: any[] = []; // ✅ Declare outside try block
    let total = 0; // ✅ Declare outside try block

    try {
      // Step 1: Read Excel file
      const workbook = XLSX.read(fs.readFileSync(filePath), {
        type: "buffer",
      });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

      logMessage = `Processing Excel file with ${rows.length} rows`;

      if (rows.length === 0) {
        throw new Error("Excel file is empty");
      }

      // Step 2: Define validation configuration for sales transactions
      // These columns are from the Excel template provided
      const excelValidationConfig: ExcelValidationConfig = {
        requiredFields: {
          "SALES MONTH": { format: "trim" }, // e.g., "10/1/2025"
          "BUSINESS CENTER": { format: "uppercase-trim" }, // e.g., "SOUTHERN TAGALOG"
          U_DIVISION: { format: "uppercase-trim" },
          CODE: { format: "uppercase-trim" }, // Warehouse code
          STORE: { format: "uppercase-trim" }, // Store name
          U_DCHANNEL: { format: "uppercase-trim" }, // Distribution channel
          ITEMCODE: { format: "uppercase-trim" }, // Item code to lookup
          ITEM: { format: "uppercase-trim" }, // Item description
          VATCODE: { format: "uppercase-trim" },
          GROSSSALES: { format: "number-trim" },
          NETSALES: { format: "number-trim" },
          QUANTITY: { format: "number-trim" },
          LINETOTAL: { format: "number-trim" },
          UNITPRICE: { format: "number-trim" },
          VATAMOUNT: { format: "number-trim" },
          LINECOST: { format: "number-trim" },
          ITEMCOST: { format: "number-trim" },
          DISCAMOUNT: { format: "number-trim" },
          VATRATE: { format: "number-trim" },
        },
        optionalFields: {},
      };

      // Step 3: Pre-load lookups for O(1) access (optimization for large files)
      // Fetch all active locations: location_name (uppercase) → { id, code }
      const allLocations = await this.locationsRepository.find({
        where: { status_id: 1 },
        select: ["id", "location_code", "location_name"],
      });
      const locationMap = new Map<string, { id: number; code: string }>();
      allLocations.forEach((loc) => {
        locationMap.set(loc.location_name.toUpperCase(), {
          id: loc.id,
          code: loc.location_code,
        });
      });

      // Fetch all active warehouses: whs_code (uppercase) → { id }
      // Adjust select/relations based on actual Warehouse entity
      const allWarehouses = await this.salesTransactionsRepository.manager
        .getRepository("Warehouse") // Adjust entity name if different
        .find({
          where: { status_id: 1 },
          select: ["id", "warehouse_ifs"], // warehouse_ifs is the code column
        });
      const warehouseMap = new Map<string, number>();
      allWarehouses.forEach((whs) => {
        warehouseMap.set(whs.warehouse_ifs.toUpperCase(), whs.id);
      });

      // Fetch all items: ITEMCODE (uppercase) → { id, cat01, cat02, salesconv, salesuniteq, itemgroup, uom }
      const allItems = await this.itemRepository.find({
        where: { status_id: 1 },
        select: [
          "id", // ✅ ADD id for item_id
          "item_code",
          "sales_conv",
          "sales_unit_eq",
          "item_group",
          "uom",
        ],
        relations: ["category1", "category2"],
      });
      const itemMap = new Map<
        string,
        {
          id: number;
          cat01: string;
          cat02: string;
          salesconv: number;
          salesuniteq: number;
          itemgroup: string;
          uom: string;
        }
      >();
      allItems.forEach((item) => {
        itemMap.set(item.item_code.toUpperCase(), {
          id: item.id,
          cat01: item.category1?.name || null,
          cat02: item.category2?.name || null,
          salesconv: item.sales_conv,
          salesuniteq: item.sales_unit_eq,
          itemgroup: item.item_group,
          uom: item.uom,
        });
      });

      // Step 4: Process rows and build batch for insertion
      const batchSize = 1000;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // Excel row number (header is row 1)

        try {
          // Step 4a: Validate and format row data
          const formattedRow = validateAndFormatExcelRow(
            row,
            excelValidationConfig,
          );

          // Step 4b: Lookup location by BUSINESS CENTER
          const bcUpperCase = String(
            formattedRow["BUSINESS CENTER"],
          ).toUpperCase();
          if (!locationMap.has(bcUpperCase)) {
            // Location not found - track and skip this row
            unmatchedLocations.set(
              bcUpperCase,
              (unmatchedLocations.get(bcUpperCase) || 0) + 1,
            );
            errors.push({
              row: rowNum,
              error: `Location not found: ${bcUpperCase}`,
            });
            continue;
          }
          const locationInfo = locationMap.get(bcUpperCase);
          const bcCode = locationInfo.code; // ✅ Extract code
          const locationId = locationInfo.id; // ✅ Extract id

          // ✅ NEW: Lookup warehouse by CODE
          const whsCodeUpperCase = String(formattedRow["CODE"]).toUpperCase();
          if (!warehouseMap.has(whsCodeUpperCase)) {
            // Warehouse not found - track and skip this row
            errors.push({
              row: rowNum,
              error: `Warehouse not found: ${whsCodeUpperCase}`,
            });
            continue;
          }
          const warehouseId = warehouseMap.get(whsCodeUpperCase); // ✅ Extract warehouse_id

          // Step 4c: Lookup items by ITEMCODE to get cat01, cat02, etc.
          const itemCodeUpperCase = String(
            formattedRow["ITEMCODE"],
          ).toUpperCase();
          const itemLookup = itemMap.get(itemCodeUpperCase);

          if (!itemLookup) {
            // Item not found - track and skip this row
            unmatchedItems.set(
              itemCodeUpperCase,
              (unmatchedItems.get(itemCodeUpperCase) || 0) + 1,
            );
            errors.push({
              row: rowNum,
              error: `Item not found: ${itemCodeUpperCase}`,
            });
            continue;
          }
          const itemId = itemLookup.id;

          // Step 4d: Build insertion object with all fields
          toInsert.push({
            doc_date: parseToFirstDayOfMonth(formattedRow["SALES MONTH"]),
            doc_date_month: getMonthNumber(formattedRow["SALES MONTH"]),
            bc_code: bcCode,
            division: formattedRow["U_DIVISION"],
            whs_code: formattedRow["CODE"],
            whs_name: formattedRow["STORE"],
            dchannel: formattedRow["U_DCHANNEL"],
            item_code: itemCodeUpperCase,
            item_desc: formattedRow["ITEM"],
            vat_code: formattedRow["VATCODE"],
            gross_sales: Number(formattedRow["GROSSSALES"]) || 0,
            net_sales: Number(formattedRow["NETSALES"]) || 0,
            quantity: Number(formattedRow["QUANTITY"]) || 0,
            converted_quantity: Number(formattedRow["QUANTITY"]) || 0,
            line_total: Number(formattedRow["LINE TOTAL"]) || 0,
            unit_price: Number(formattedRow["UNITPRICE"]) || 0,
            vat_amount: Number(formattedRow["VATAMOUNT"]) || 0,
            line_cost: Number(formattedRow["LINECOST"]) || 0,
            item_cost: Number(formattedRow["ITEMCOST"]) || 0,
            disc_amount: Number(formattedRow["DISCAMOUNT"]) || 0,
            vat_rate: Number(formattedRow["VATRATE"]) || 0,
            // ← These are fetched from items lookup
            cat01: itemLookup.cat01 || "",
            cat02: itemLookup.cat02 || "",
            sales_conv: itemLookup.salesconv || "",
            sales_unit_eq: itemLookup.salesuniteq || "",
            item_group: itemLookup.itemgroup || "",
            uom: itemLookup.uom || "",
            // Foreign key references
            location_id: locationId, // ← From location lookup
            warehouse_id: warehouseId, // ← From warehouse lookup
            item_id: itemId, // ← From item lookup
            created_by: userId,
            access_key_id: accessKeyId,
            status_id: 1,
          });
          toInsertRowNumbers.push(rowNum); // ✅ Track row number
        } catch (rowError) {
          // Validation or lookup error - log and continue
          errors.push({
            row: rowNum,
            error:
              rowError instanceof Error ? rowError.message : String(rowError),
          });
        }
      }

      // Step 5: Batch insertion (same pattern as pullAndInsertFromDwh)
      const total_items = toInsert.length;
      total = total_items;
      for (let i = 0; i < total_items; i += batchSize) {
        const batch = toInsert.slice(i, i + batchSize);
        const batchRowNumbers = toInsertRowNumbers.slice(i, i + batchSize); // ✅ Get corresponding row numbers

        // Step 5a: Build unique keys for this batch
        const keys = batch.map((row) => ({
          item_code: row.item_code,
          whs_code: row.whs_code,
          doc_date: row.doc_date,
          unit_price: row.unit_price,
        }));

        // Step 5b: Mark existing records as inactive (status_id = 2)
        if (keys.length > 0) {
          await this.salesTransactionsRepository
            .createQueryBuilder()
            .update(SalesTransaction)
            .set({ status_id: 2 })
            .where(
              keys
                .map(
                  (k, idx) =>
                    `(item_code = :item_code${idx} AND whs_code = :whs_code${idx} AND doc_date = :doc_date${idx} AND unit_price = :unit_price${idx})`,
                )
                .join(" OR "),
              Object.assign(
                {},
                ...keys.map((k, idx) => ({
                  [`item_code${idx}`]: k.item_code,
                  [`whs_code${idx}`]: k.whs_code,
                  [`doc_date${idx}`]: k.doc_date,
                  [`unit_price${idx}`]: k.unit_price,
                })),
              ),
            )
            .execute();
        }

        // Step 5c: Bulk insert new records in transaction
        if (batch.length > 0) {
          await this.salesTransactionsRepository.manager.transaction(
            async (manager) => {
              await manager.getRepository(SalesTransaction).insert(batch);
            },
          );
          inserted_count += batch.length; // ✅ Update count
          inserted_row_numbers.push(...batchRowNumbers); // ✅ Track successful row numbers
        }
      }

      // Step 6: Build messages
      //   - displayMessage: concise summary for UI response (no raw JSON)
      //   - logMessage: detailed log for dwh_log table (includes error details)
      displayMessage += `Processed ${rows.length} rows (${total} passed validation).`;
      displayMessage += ` Inserted ${inserted_count} records.`;
      if (errors.length > 0) {
        displayMessage += ` ${errors.length} row(s) had errors.`;
      }
      if (unmatchedLocations.size > 0) {
        displayMessage += ` ${Array.from(unmatchedLocations.entries())
          .map(([loc, count]) => `${loc} (${count})`)
          .join(", ")} location(s) not matched.`;
      }
      if (unmatchedItems.size > 0) {
        displayMessage += ` ${Array.from(unmatchedItems.entries())
          .map(([item, count]) => `${item} (${count})`)
          .join(", ")} item(s) not matched.`;
      }

      // Detailed log for dwh_log (includes raw error data)
      logMessage += `\nProcessed: ${rows.length} rows (${total} passed validation)`;
      logMessage += `\nInserted: ${inserted_count} records`;
      if (errors.length > 0) {
        logMessage += `\nErrors: ${errors.length} rows`;
        logMessage += `\nError details (first 20): ${JSON.stringify(errors.slice(0, 20))}`;
      }
      if (unmatchedLocations.size > 0) {
        logMessage += `\nUnmatched Locations: ${Array.from(
          unmatchedLocations.entries(),
        )
          .map(([loc, count]) => `${loc} (${count} rows)`)
          .join(", ")}`;
      }
      if (unmatchedItems.size > 0) {
        logMessage += `\nUnmatched Items: ${Array.from(unmatchedItems.entries())
          .map(([item, count]) => `${item} (${count} rows)`)
          .join(", ")}`;
      }
    } catch (err) {
      logError = err instanceof Error ? err.message : String(err);
      failed = 1;
      logger.error("Error uploading sales transactions:", err);
    } finally {
      // Step 7: Create DWH log entry (same as pullAndInsertFromDwh)
      await this.dwhLogRepository.insert({
        type: "sales transactions upload",
        message: logError ? `ERROR: ${logError}` : logMessage,
        row_data: JSON.stringify({
          userId,
          accessKeyId,
          inserted_count,
          totalProcessed: toInsert.length,
          totalRead: rows.length,
          errors: errors.slice(0, 20), // Log first 20 errors
          unmatchedLocations: Object.fromEntries(unmatchedLocations),
          unmatchedItems: Object.fromEntries(unmatchedItems),
        }),
      });

      // Step 8: Clean up - remove uploaded file after processing
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        logger.warn("Could not delete uploaded file:", err);
      }
    }

    return {
      inserted_count, // Total inserted
      inserted_row_numbers, // Which rows were inserted (for user reference)
      total_rows_processed: total, // How many rows passed validation
      total_rows_read: rows.length, // Total rows in file
      errors, // All errors for user to fix
      error_count: errors.length, // Count of errors
      message: displayMessage, // Summary for logging/display
    };
  }
}
