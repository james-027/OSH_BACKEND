import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { SalesBudgetTransaction } from "../../../entities/SalesBudgetTransaction";
import { CreateSalesBudgetTransactionDto } from "../dto/CreateSalesBudgetTransactionDto";
import { UpdateSalesBudgetTransactionDto } from "../dto/UpdateSalesBudgetTransactionDto";
import { UserLocationsService } from "../../users/services/user-locations.service";
import * as XLSX from "xlsx";
import { Warehouse } from "../../../entities/Warehouse";
import { UserLocations } from "../../../entities/UserLocations";

@Injectable()
export class SalesBudgetTransactionsService {
  constructor(
    @InjectRepository(SalesBudgetTransaction)
    private salesBudgetTransactionsRepository: Repository<SalesBudgetTransaction>,
    private userLocationsService: UserLocationsService,
  ) {}

  async findAll(
    accessKeyId?: number,
    userId?: number,
    roleId?: number,
    sales_year?: number,
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
    const qb = this.salesBudgetTransactionsRepository
      .createQueryBuilder("sbt")
      .leftJoinAndSelect("sbt.status", "status")
      .leftJoinAndSelect("sbt.accessKey", "accessKey")
      .innerJoin(
        Warehouse,
        "warehouse",
        "sbt.ifs_code = warehouse.warehouse_ifs",
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
    if (sales_year !== undefined) {
      qb.andWhere("YEAR(sbt.sales_date) = :sales_year", { sales_year });
    }
    qb.andWhere("sbt.status_id = :activeStatusId", { activeStatusId: 1 });
    const records = await qb.getMany();
    return records.map((rec: any) => {
      const { status, accessKey, ...rest } = rec;
      return {
        ...rest,
        status_id: status ? status.id : null,
        status_name: status ? status.status_name : null,
        access_key_id: accessKey ? accessKey.id : null,
        access_key_name: accessKey ? accessKey.access_key_name : null,
      };
    });
  }

  async findOne(id: number): Promise<any> {
    const rec = await this.salesBudgetTransactionsRepository.findOne({
      where: { id },
      relations: ["status", "accessKey"],
    });
    if (!rec) throw new NotFoundException("Sales budget transaction not found");
    return {
      ...rec,
      status_name: rec.status ? rec.status.status_name : null,
      access_key_name: rec.accessKey ? rec.accessKey.access_key_name : null,
    };
  }

  async create(
    createDto: CreateSalesBudgetTransactionDto,
  ): Promise<SalesBudgetTransaction> {
    const rec = this.salesBudgetTransactionsRepository.create(createDto);
    return this.salesBudgetTransactionsRepository.save(rec);
  }

  async update(
    id: number,
    updateDto: UpdateSalesBudgetTransactionDto,
  ): Promise<SalesBudgetTransaction> {
    const rec = await this.salesBudgetTransactionsRepository.findOne({
      where: { id },
    });
    if (!rec) throw new NotFoundException("Sales budget transaction not found");
    Object.assign(rec, updateDto);
    return this.salesBudgetTransactionsRepository.save(rec);
  }

  async remove(id: number): Promise<void> {
    const rec = await this.salesBudgetTransactionsRepository.findOne({
      where: { id },
    });
    if (!rec) throw new NotFoundException("Sales budget transaction not found");
    await this.salesBudgetTransactionsRepository.remove(rec);
  }

  async findAllPerLocation(
    user_id?: number,
    role_id?: number,
    current_access_key?: number,
    sales_year?: number,
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
    const qb = this.salesBudgetTransactionsRepository
      .createQueryBuilder("budget")
      .select([
        "location.id AS location_id",
        "location.location_name AS location_name",
        "DATE_FORMAT(budget.sales_date, '%Y-%m-%d') AS sales_date",
        "DATE_FORMAT(DATE(budget.sales_date), '%M %Y') AS month",
        "COUNT(DISTINCT budget.ifs_code) AS num_stores",
        "SUM(budget.sales_det_qty_2) AS budget_volume",
        "budget.status_id AS status_id",
      ])
      .innerJoin(
        "location",
        "location",
        "budget.bc_code = location.location_code",
      )
      .where("budget.status_id = 1");
    if (allowedLocationIds && allowedLocationIds.length > 0) {
      qb.andWhere("location.id IN (:...allowedLocationIds)", {
        allowedLocationIds,
      });
    }
    if (current_access_key) {
      qb.andWhere("budget.access_key_id = :access_key_id", {
        access_key_id: current_access_key,
      });
    }
    if (sales_year !== undefined) {
      qb.andWhere("YEAR(budget.sales_date) = :sales_year", { sales_year });
    }
    qb.groupBy("location.id")
      .addGroupBy("DATE(budget.sales_date)")
      .addGroupBy("budget.status_id")
      .orderBy("location.location_name")
      .addOrderBy("DATE(budget.sales_date)");

    const rows = await qb.getRawMany();
    return rows.map((row) => ({
      location_id: row.location_id,
      location_name: row.location_name,
      sales_date: row.sales_date,
      month: row.month,
      num_stores: Number(row.num_stores),
      budget_volume: Number(row.budget_volume),
      status_name: row.status_id == 1 ? "ACTIVE" : "INACTIVE",
    }));
  }

  async findOnePerLocation(
    location_id: number,
    sales_date: string,
  ): Promise<any[]> {
    // Join location to get location_code, then group by ifs_code (store)
    const qb = this.salesBudgetTransactionsRepository
      .createQueryBuilder("budget")
      .select([
        "budget.ifs_code AS store_ifs",
        "budget.outlet_name AS store_name",
        "DATE_FORMAT(DATE(budget.sales_date), '%M %Y') AS month",
        "COUNT(DISTINCT budget.material_code) AS num_items",
        "GROUP_CONCAT(DISTINCT budget.material_group_name) AS item_categories",
        "SUM(budget.sales_det_qty_2) AS budget_volume",
      ])
      .innerJoin(
        "location",
        "location",
        "budget.bc_code = location.location_code",
      )
      .where("location.id = :location_id", { location_id })
      .andWhere("DATE(budget.sales_date) = :sales_date", { sales_date })
      .andWhere("budget.status_id = 1")
      .groupBy("budget.ifs_code, budget.outlet_name, DATE(budget.sales_date)")
      .orderBy("budget.outlet_name");

    const rows = await qb.getRawMany();
    return rows.map((row) => ({
      id: row.store_ifs,
      store_ifs: row.store_ifs,
      store_name: row.store_name,
      month: row.month,
      num_items: Number(row.num_items),
      item_categories: row.item_categories
        ? row.item_categories.split(",")
        : [],
      budget_volume: Number(row.budget_volume),
    }));
  }

  /**
   * Batch upload for sales budget transactions from Excel-style data.
   * @param rows Array of objects representing Excel rows (with __rowNum__ for row tracking)
   * @param user User object (must have current_access_key, id for created_by)
   */
  async uploadBatch(
    rows: any[],
    user: { current_access_key: number; id: number; role_id?: number },
  ) {
    const inserted_row_numbers: number[] = [];
    const updated_row_numbers: number[] = [];
    const errors: any[] = [];
    const success: any[] = [];
    let inserted_count = 0;
    let updated_count = 0;

    // 1. Get all unique ifs_codes from rows
    const allIfsCodes = Array.from(
      new Set(
        rows
          .map((row) => String(row["STORE IFS"] || "").trim())
          .filter(Boolean),
      ),
    );
    // 2. Get all warehouses for these ifs_codes
    const warehouses = await this.salesBudgetTransactionsRepository.manager
      .getRepository(Warehouse)
      .find({
        where: { warehouse_ifs: In(allIfsCodes) },
      });
    // 3. Map ifs_code to location_id
    const ifsToLocation: Record<string, number> = {};
    for (const wh of warehouses) {
      ifsToLocation[wh.warehouse_ifs] = wh.location_id;
    }
    // 4. Get allowed location_ids for user
    let allowedLocationIds: number[] = [];
    if (user.id && user.role_id) {
      const userLocs = await this.salesBudgetTransactionsRepository.manager
        .getRepository(UserLocations)
        .find({
          where: { user_id: user.id, role_id: user.role_id, status_id: 1 },
        });
      allowedLocationIds = userLocs.map((ul) => ul.location_id);
    }
    // Prepare all unique keys from input for batch DB query
    const uniqueKeys = rows.map((row) => ({
      bc_code: String(row["BC CODE"] || "").trim(),
      sales_month: Number(row["BUDGET MONTH"]),
      ifs_code: String(row["STORE IFS"] || "").trim(),
      material_code: String(row["MATERIAL CODE"] || "").trim(),
      __rowNum__: row["__rowNum__"] || null,
    }));
    // Query all existing records for these keys
    const orConditions = uniqueKeys
      .map(
        (k, idx) =>
          `(bc_code = :bc_code${idx} AND sales_month = :sales_month${idx} AND ifs_code = :ifs_code${idx} AND material_code = :material_code${idx} AND status_id = 1)`,
      )
      .join(" OR ");
    const params = Object.assign(
      {},
      ...uniqueKeys.map((k, idx) => ({
        [`bc_code${idx}`]: k.bc_code,
        [`sales_month${idx}`]: k.sales_month,
        [`ifs_code${idx}`]: k.ifs_code,
        [`material_code${idx}`]: k.material_code,
      })),
    );
    let existing: SalesBudgetTransaction[] = [];
    if (orConditions) {
      existing = await this.salesBudgetTransactionsRepository
        .createQueryBuilder()
        .where(orConditions, params)
        .getMany();
    }
    // Map for quick lookup
    const existingMap = new Map<string, SalesBudgetTransaction[]>();
    for (const rec of existing) {
      const key = `${rec.bc_code}|${rec.sales_month}|${rec.ifs_code}|${rec.material_code}`;
      if (!existingMap.has(key)) existingMap.set(key, []);
      existingMap.get(key)!.push(rec);
    }
    // Process each row
    for (const row of rows) {
      const rowNum = row["__rowNum__"] || null;
      const bc_code = String(row["BC CODE"] || "").trim();
      const sales_month = Number(row["BUDGET MONTH"]);
      const ifs_code = String(row["STORE IFS"] || "").trim();
      const material_code = String(row["MATERIAL CODE"] || "").trim();
      const key = `${bc_code}|${sales_month}|${ifs_code}|${material_code}`;
      // LOCATION FILTER: check if user can upload for this ifs_code
      const location_id = ifsToLocation[ifs_code];
      if (
        !location_id ||
        (allowedLocationIds.length > 0 &&
          !allowedLocationIds.includes(location_id))
      ) {
        errors.push({
          row: rowNum,
          error: `User not allowed to upload for IFS ${ifs_code} (location_id: ${
            location_id ?? "N/A"
          })`,
        });
        continue;
      }
      const found = existingMap.get(key) || [];
      // If any existing with from_repo=1, error
      if (found.some((f) => Boolean(f.from_repo))) {
        errors.push({
          row: rowNum,
          error: `${bc_code}, Budget Month ${sales_month}, IFS ${ifs_code}, Material ${material_code} already exist from the repository server. Cannot be changed.`,
        });
        continue;
      }
      // If any existing with from_repo=0, deactivate all and proceed to insert
      const foundFromRepo0 = found.filter((f) => !Boolean(f.from_repo));
      if (foundFromRepo0.length > 0) {
        const idsToUpdate = foundFromRepo0.map((f) => f.id);
        await this.salesBudgetTransactionsRepository
          .createQueryBuilder()
          .update(SalesBudgetTransaction)
          .set({ status_id: 2, updated_by: user.id })
          .whereInIds(idsToUpdate)
          .execute();
        updated_row_numbers.push(rowNum);
        updated_count++;
      }
      // Insert new record
      try {
        const entity = this.salesBudgetTransactionsRepository.create({
          bc_name: row["BC NAME"] || "",
          bc_code,
          ifs_code,
          outlet_name: row["STORE NAME"] || "",
          material_code: row["MATERIAL CODE"] || "",
          material_desc: row["MATERIAL NAME"] || "",
          material_group_name: row["MATERIAL GROUP NAME"] || "",
          sales_det_qty: Number(row["BUDGET VOLUME"]),
          sales_det_qty_2: Number(row["BUDGET VOLUME"]),
          sales_month,
          sales_date: this.getBudgetMonthDate(row["BUDGET MONTH"]),
          access_key_id: user.current_access_key,
          status_id: 1,
          from_repo: false,
          created_by: user.id,
        });
        const saved = await this.salesBudgetTransactionsRepository.save(entity);
        inserted_row_numbers.push(rowNum);
        inserted_count++;
        success.push({ ...saved, __rowNum__: rowNum });
      } catch (err) {
        errors.push({ row: rowNum, error: err?.message || String(err) });
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

  /**
   * Helper to convert BUDGET MONTH to YYYY-MM-01 string (first day of month)
   * Accepts Excel date serial, date string (e.g. 1/1/2025, 2/2025, MM/YYYY, M/D/YYYY, or month number)
   */
  getBudgetMonthDate(month: number | string): string {
    if (!month) return "";
    // Excel serial date handling
    if (typeof month === "number" && month > 30000) {
      // Excel serial date to JS Date
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const jsDate = new Date(excelEpoch.getTime() + month * 86400000);
      const y = jsDate.getUTCFullYear();
      const m = jsDate.getUTCMonth() + 1;
      return `${y}-${m.toString().padStart(2, "0")}-01`;
    }
    // Try to parse as date string (e.g. 1/1/2025, 2/2025, MM/YYYY, M/D/YYYY)
    let m: number | undefined, y: number | undefined;
    if (typeof month === "string") {
      const parts = month.split("/");
      if (parts.length === 2) {
        m = Number(parts[0]);
        y = Number(parts[1]);
      } else if (parts.length === 3) {
        m = Number(parts[0]);
        y = Number(parts[2]);
      }
    }
    if (!m || !y || isNaN(m) || isNaN(y)) {
      m = Number(month);
      y = new Date().getFullYear();
    }
    if (!m || m < 1 || m > 12) m = 1;
    if (!y || y < 2000 || y > 2100) y = new Date().getFullYear();
    return `${y}-${m.toString().padStart(2, "0")}-01`;
  }
}
