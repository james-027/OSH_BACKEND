import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, Not, In } from "typeorm";
import { TransactionHeader } from "../../../entities/TransactionHeader";
import { TransactionDetail } from "../../../entities/TransactionDetail";
import { CreateTransactionHeaderDto } from "../dto/CreateTransactionHeaderDto";
import { UpdateTransactionHeaderDto } from "../dto/UpdateTransactionHeaderDto";
import { CreateTransactionDetailDto } from "../dto/CreateTransactionDetailDto";
import { UpdateTransactionDetailDto } from "../dto/UpdateTransactionDetailDto";
import { LocationsService } from "../../locations/services/locations.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { CreateUserAuditTrailDto } from "../../users/dto/CreateUserAuditTrailDto";
import { UserLocationsService } from "../../users/services/user-locations.service";
import { CommonUtilitiesService } from "../../../services/common-utilities.service";
import { filter } from "rxjs";
import logger from "src/config/logger";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(TransactionHeader)
    private headerRepo: Repository<TransactionHeader>,
    @InjectRepository(TransactionDetail)
    private detailRepo: Repository<TransactionDetail>,
    private locationsService: LocationsService,
    private dataSource: DataSource,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private userLocationsService: UserLocationsService,
    private commonUtilitiesService: CommonUtilitiesService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  // HEADER CRUD
  async createHeader(dto: CreateTransactionHeaderDto) {
    return this.headerRepo.save(dto);
  }

  async findAllHeaders(
    user_id?: number,
    role_id?: number,
    current_access_key?: number,
  ) {
    let allowedLocationIds: number[] | undefined = undefined;
    if (user_id && role_id) {
      allowedLocationIds =
        await this.commonUtilitiesService.getUserAllowedLocationIds(
          user_id,
          role_id,
        );
    }
    const where: any = {};
    if (allowedLocationIds && allowedLocationIds.length > 0) {
      where.location_id = In(allowedLocationIds);
    }
    if (current_access_key) {
      where.access_key_id = current_access_key;
    }
    const headers = await this.headerRepo.find({
      where,
      relations: [
        "location",
        "status",
        "access_key",
        "created_by_user",
        "updated_by_user",
        "details",
      ],
    });
    return headers.map((header) => ({
      header: {
        trans_id: header.id,
        trans_number: header.trans_number ? header.trans_number : header.id,
        trans_date: header.trans_date,
        location_id: header.location_id,
        location_name: header.location?.location_name,
        status_id: header.status_id,
        status_name: header.status?.status_name,
        created_by: header.created_by,
        access_key_id: header.access_key_id,
        updated_by: header.updated_by,
        created_user: header.created_by_user
          ? `${header.created_by_user.first_name} ${header.created_by_user.last_name}`
          : null,
        updated_user: header.updated_by_user
          ? `${header.updated_by_user.first_name} ${header.updated_by_user.last_name}`
          : null,
        id: header.id,
        created_at: header.created_at,
        modified_at: header.modified_at,
      },
      details: (header.details || []).map((d) => ({
        warehouse_id: d.warehouse_id,
        budget_volume: d.budget_volume,
        sales_qty: d.sales_qty,
        ss_hurdle_qty: d.ss_hurdle_qty,
        rate: d.rate,
        details_status_id: d.status_id,
      })),
    }));
  }

  async findHeaderById(id: number) {
    const header = await this.headerRepo.findOne({
      where: { id },
      relations: [
        "location",
        "status",
        "access_key",
        "created_by_user",
        "updated_by_user",
        "details",
        "details.warehouse",
      ],
    });
    if (!header) return null;
    return {
      header: {
        trans_id: header.id,
        trans_date: header.trans_date,
        location_id: header.location_id,
        location_name: header.location?.location_name,
        status_id: header.status_id,
        status_name: header.status?.status_name,
        created_by: header.created_by,
        access_key_id: header.access_key_id,
        updated_by: header.updated_by,
        created_user: header.created_by_user
          ? `${header.created_by_user.first_name} ${header.created_by_user.last_name}`
          : null,
        updated_user: header.updated_by_user
          ? `${header.updated_by_user.first_name} ${header.updated_by_user.last_name}`
          : null,
        id: header.id,
        created_at: header.created_at,
        modified_at: header.modified_at,
      },
      details: (header.details || []).map((d) => ({
        details_id: d.id,
        warehouse_id: d.warehouse_id,
        warehouse_name: d.warehouse?.warehouse_name,
        budget_volume: d.budget_volume,
        sales_qty: d.sales_qty,
        ss_hurdle_qty: d.ss_hurdle_qty,
        rate: d.rate,
        details_status_id: d.status_id,
      })),
    };
  }

  async updateHeader(id: number, dto: UpdateTransactionHeaderDto) {
    await this.headerRepo.update(id, dto);
    return this.findHeaderById(id);
  }

  async removeHeader(id: number) {
    return this.headerRepo.delete(id);
  }

  // Toggle status of a transaction header
  async toggleStatus(id: number, status_id: number, user_id: number) {
    await this.headerRepo.update(id, { status_id });
    await this.userAuditTrailCreateService.create(
      {
        service: "transactions",
        method: "toggleStatus",
        raw_data: JSON.stringify({ id, status_id }),
        description: `Toggled status to ${status_id} for transaction header ${id}`,
        status_id: 1,
      },
      user_id,
    );
    return this.findHeaderById(id);
  }

  // Post transaction (set status_id to 4)
  async postTransaction(id: number, user_id: number) {
    // Update header status
    const header = await this.headerRepo.findOne({
      where: { id },
      relations: ["location"],
    });
    if (!header) throw new Error("Transaction header not found");
    if (header.status_id === 4) {
      throw new Error("Transaction is already posted.");
    }
    // Check for duplicates (not cancelled)
    const duplicate = await this.headerRepo.findOne({
      where: {
        location_id: header.location_id,
        trans_date: header.trans_date,
        access_key_id: header.access_key_id,
        status_id: 4,
        id: Not(id),
      },
    });
    if (duplicate) {
      throw new Error(
        `A transaction already exists for this location, date: ${header.trans_date}, (posted).`,
      );
    }
    const dataToUpdate: any = {
      status_id: 4,
      updated_by: user_id,
    };
    // Generate trans_number if not set
    if (!header.trans_number) {
      // Get location_abbr
      const location_abbr = header.location?.location_abbr || "LOC";
      const access_key_id = header.access_key_id;
      const trans_date = new Date(header.trans_date);

      // Generate using bulletproof service with database-level locking
      const trans_number =
        await this.commonUtilitiesService.generateTransactionNumber({
          transaction_type: "INCENTIVES",
          location_id: header.location_id,
          access_key_id,
          format: "{abbr}{key}{year}-{seq:4}",
          reset_per_year: true,
          currentDate: trans_date,
          abbr: location_abbr,
        });

      dataToUpdate.trans_number = trans_number;
      header.trans_number = trans_number;
    }
    await this.headerRepo.update(id, dataToUpdate);
    await this.userAuditTrailCreateService.create(
      {
        service: "transactions",
        method: "postTransaction",
        raw_data: JSON.stringify({ id }),
        description: `Posted transaction header ${id}`,
        status_id: 1,
      },
      user_id,
    );
    // Update all related details status
    await this.detailRepo.update(
      { transaction_header_id: id },
      { status_id: 4 },
    );
    // SSE Events
    try {
      this.sseEventEmitter.emitUpdateSignal("transactions", id);
      this.sseEventEmitter.emitUpdateSignal("dashboard", id);
    } catch (err) {
      logger.error("SSE event failed for update:", err);
    }
    return this.findHeaderById(id);
  }

  // Cancel transaction (set status_id to 5)
  async cancelTransaction(id: number, user_id: number, cancel_reason: string) {
    const header = await this.headerRepo.findOne({
      where: { id },
    });
    if (!header) throw new Error("Transaction header not found");
    if (header.status_id === 5) {
      throw new Error("Transaction header is already cancelled.");
    }

    // Update header status
    await this.headerRepo.update(id, {
      status_id: 5,
      updated_by: user_id,
      cancel_reason,
    });
    await this.userAuditTrailCreateService.create(
      {
        service: "transactions",
        method: "cancelTransaction",
        raw_data: JSON.stringify({ id }),
        description: `Cancelled transaction header ${id}, with reason: ${cancel_reason}`,
        status_id: 1,
      },
      user_id,
    );
    // Update all related details status
    await this.detailRepo.update(
      { transaction_header_id: id },
      { status_id: 5 },
    );
    // SSE Events
    try {
      this.sseEventEmitter.emitUpdateSignal("transactions", id);
      this.sseEventEmitter.emitUpdateSignal("dashboard", id);
    } catch (err) {
      logger.error("SSE event failed for update:", err);
    }
    return this.findHeaderById(id);
  }

  // Revert transaction (set status_id to 3)
  async revertTransaction(id: number, user_id: number, undo_reason: string) {
    const header = await this.headerRepo.findOne({
      where: {
        id,
      },
    });
    if (!header) {
      throw new Error("Transaction header not found.");
    }
    if (header.status_id === 3) {
      throw new Error("Transaction is already reverted.");
    }
    const duplicate = await this.headerRepo.findOne({
      where: {
        location_id: header.location_id,
        trans_date: header.trans_date,
        access_key_id: header.access_key_id,
        status_id: Not(5),
        id: Not(id),
      },
    });
    if (duplicate) {
      throw new Error(
        `A transaction already exists for this location, date: ${header.trans_date}, (not cancelled).`,
      );
    }
    // Update header status
    await this.headerRepo.update(id, {
      status_id: 3,
      updated_by: user_id,
      undo_reason,
    });
    await this.userAuditTrailCreateService.create(
      {
        service: "transactions",
        method: "revertTransaction",
        raw_data: JSON.stringify({ id }),
        description: `Reverted transaction header ${id}, with reason: ${undo_reason}`,
        status_id: 1,
      },
      user_id,
    );
    // Update all related details status
    await this.detailRepo.update(
      { transaction_header_id: id },
      { status_id: 3 },
    );
    // SSE Events
    try {
      this.sseEventEmitter.emitUpdateSignal("transactions", id);
      this.sseEventEmitter.emitUpdateSignal("dashboard", id);
    } catch (err) {
      logger.error("SSE event failed for update:", err);
    }
    return this.findHeaderById(id);
  }

  // DETAIL CRUD
  async createDetail(dto: CreateTransactionDetailDto) {
    return this.detailRepo.save(dto);
  }

  async findAllDetails(headerId?: number) {
    if (headerId) {
      return this.detailRepo.find({
        where: { transaction_header_id: headerId },
        relations: ["warehouse", "status", "transaction_header"],
      });
    }
    return this.detailRepo.find({
      relations: ["warehouse", "status", "transaction_header"],
    });
  }

  async findDetailById(id: number) {
    return this.detailRepo.findOne({
      where: { id },
      relations: ["warehouse", "status", "transaction_header"],
    });
  }

  async updateDetail(id: number, dto: UpdateTransactionDetailDto) {
    await this.detailRepo.update(id, dto);
    // SSE Events
    try {
      this.sseEventEmitter.emitUpdateSignal("transactions", id);
      this.sseEventEmitter.emitUpdateSignal("dashboard", id);
    } catch (err) {
      logger.error("SSE event failed for update:", err);
    }
    return this.findDetailById(id);
  }

  async removeDetail(id: number) {
    return this.detailRepo.delete(id);
  }

  /**
   * Create transaction headers and details for multiple locations by merging sales_budget_transactions and sales_transactions
   * @param dto { location_ids, trans_date, created_by, access_key_id }
   */
  async createTransaction(dto: {
    location_ids: number[];
    trans_date: string;
    created_by: number;
    access_key_id: number;
    user_id?: number;
    role_id?: number;
  }) {
    const {
      location_ids,
      trans_date,
      created_by,
      access_key_id,
      user_id,
      role_id,
    } = dto;
    // Validate allowed locations for user
    let allowedLocationIds: number[] | undefined = undefined;
    if (user_id && role_id) {
      allowedLocationIds =
        await this.commonUtilitiesService.getUserAllowedLocationIds(
          user_id,
          role_id,
        );
    }
    const filteredLocationIds = allowedLocationIds
      ? location_ids.filter((id) => allowedLocationIds.includes(id))
      : location_ids;
    if (filteredLocationIds.length === 0) {
      throw new Error(
        "You are not allowed to create transactions for the selected locations.",
      );
    }

    if (
      !Array.isArray(filteredLocationIds) ||
      filteredLocationIds.length === 0
    ) {
      throw new Error("location_ids must be a non-empty array.");
    }
    // 0. Batch check for duplicates (not cancelled)
    const existingHeaders = await this.headerRepo.find({
      where: filteredLocationIds.map((location_id) => ({
        location_id,
        trans_date,
        access_key_id,
        status_id: Not(5),
      })),
      relations: ["location", "status"],
    });
    const existingMap = new Map(existingHeaders.map((h) => [h.location_id, h]));
    const results = [];
    for (const location_id of filteredLocationIds) {
      if (existingMap.has(location_id)) {
        const existing = existingMap.get(location_id);
        results.push({
          location_id,
          location_name: existing.location?.location_name || null,
          status: "skipped",
          reason: `A transaction already exists for location: ${
            existing.location?.location_name || location_id
          }, date: ${trans_date}, status: ${
            existing.status?.status_name || existing.status_id
          }`,
        });
        continue;
      }
      // 1. Get location_code and location_name
      const locationRow = await this.dataSource
        .createQueryBuilder()
        .select([
          "location.id",
          "location.location_code",
          "location.location_name",
        ])
        .from("location", "location")
        .where("location.id = :id", { id: location_id })
        .getRawOne();
      if (!locationRow) {
        results.push({
          location_id,
          location_name: null,
          status: "skipped",
          reason: "Location not found",
        });
        continue;
      }
      const location_code = locationRow.location_location_code;
      const location_name = locationRow.location_location_name;
      // 2. Query sales_budget_transactions
      // Calculate quarter months based on trans_date
      // sales_month is 1-based (1=Jan, 12=Dec)
      const transDateObj = new Date(trans_date);
      const year = transDateObj.getFullYear();
      const month = transDateObj.getMonth() + 1; // 1-based month
      const quarter = Math.floor((month - 1) / 3) + 1;
      const quarterStartMonth = (quarter - 1) * 3 + 1; // 1, 4, 7, 10
      const quarterEndMonth = quarterStartMonth + 2; // 3, 6, 9, 12

      const budgetRows = await this.dataSource.query(
        `
        SELECT
          a.bc_name,
          a.bc_code,
          a.ifs_code,
          a.outlet_name,
          SUM(a.sales_det_qty) as sales_det_qty,
          SUM(a.sales_det_qty_2) as sales_det_qty_2,
          b.category2_id,
          b.category1_id,
          a.sales_month,
	        QUARTER(sales_date) as sales_quarter
        FROM sales_budget_transactions a
        INNER JOIN items b on a.material_code = b.item_code
        INNER JOIN warehouses c on a.ifs_code = c.warehouse_ifs
        LEFT JOIN warehouse_hurdles d ON d.warehouse_id = c.id 
        AND d.hurdle_date = a.sales_date 
        AND d.status_id = 7
        LEFT JOIN warehouse_hurdle_categories e ON e.item_category_id = b.category2_id 
        AND e.warehouse_hurdle_id = d.id 
        AND e.status_id = 7
        WHERE a.status_id = 1 
          AND YEAR(a.sales_date) = ?
          AND QUARTER(a.sales_date) = ?
          AND a.bc_code = ?
        GROUP BY a.bc_code, a.ifs_code, sales_quarter
        ORDER BY a.bc_code
      `,
        [year, quarter, location_code],
      );

      const budgetRowsMonthly = await this.dataSource.query(
        `
        SELECT
          a.bc_name,
          a.bc_code,
          a.ifs_code,
          a.outlet_name,
          SUM(a.sales_det_qty) as sales_det_qty,
          SUM(a.sales_det_qty_2) as sales_det_qty_2,
          b.category2_id,
          b.category1_id,
          a.sales_month,
	        QUARTER(sales_date) as sales_quarter
        FROM sales_budget_transactions a
        INNER JOIN items b on a.material_code = b.item_code
        INNER JOIN warehouses c on a.ifs_code = c.warehouse_ifs
        LEFT JOIN warehouse_hurdles d ON d.warehouse_id = c.id 
        AND d.hurdle_date = a.sales_date 
        AND d.status_id = 7
        LEFT JOIN warehouse_hurdle_categories e ON e.item_category_id = b.category2_id 
        AND e.warehouse_hurdle_id = d.id 
        AND e.status_id = 7
        WHERE a.status_id = 1 
          AND a.sales_date = ?
          AND a.bc_code = ?
        GROUP BY a.bc_code, a.ifs_code, a.sales_month
        ORDER BY a.bc_code
      `,
        [trans_date, location_code],
      );
      // 3. Query sales_transactions
      const salesRows = await this.dataSource.query(
        `
        SELECT
          a.bc_code,
          a.whs_code,
          c.id as warehouse_id,
          c.warehouse_name as whs_name,
          c.warehouse_ifs as warehouse_ifs,
          SUM(a.quantity) AS quantity,
          SUM(a.converted_quantity) AS converted_quantity,
          a.doc_date,
          a.doc_date_month,
          b.category2_id,
          b.category1_id,
          d.ss_hurdle_qty,
          f.warehouse_rate
        FROM sales_transactions a
        INNER JOIN items b ON b.item_code = a.item_code
        INNER JOIN warehouses c ON c.warehouse_ifs = a.whs_code
        LEFT JOIN warehouse_hurdles d ON d.warehouse_id = c.id 
        AND d.hurdle_date = a.doc_date 
        AND d.status_id = 7
        LEFT JOIN warehouse_hurdle_categories e ON e.item_category_id = b.category2_id 
        AND e.warehouse_hurdle_id = d.id 
        AND e.status_id = 7
        LEFT JOIN warehouse_rates f ON f.warehouse_id = c.id 
        AND f.status_id = a.status_id 
        WHERE a.status_id = 1 and a.doc_date = ? and a.bc_code = ?
        GROUP by a.bc_code, a.whs_code, c.id
      `,
        [trans_date, location_code],
      );
      // 4. Merge by whs_code (sales) as base, match to ifs_code (budget)
      const budgetMap = new Map();
      for (const b of budgetRows) {
        budgetMap.set(b.ifs_code, b);
      }
      // Map for monthly budget
      const budgetMonthlyMap = new Map();
      for (const b of budgetRowsMonthly) {
        budgetMonthlyMap.set(b.ifs_code, b);
      }
      const merged = [];
      for (const s of salesRows) {
        const budget = budgetMap.get(s.whs_code);
        const budgetMonthly = budgetMonthlyMap.get(s.whs_code);
        merged.push({
          warehouse_id: s.warehouse_id,
          warehouse_ifs: s.warehouse_ifs,
          warehouse_name: s.whs_name,
          sales_det_qty_2: budget ? Number(budget.sales_det_qty_2) : 0,
          budget_volume_monthly: budgetMonthly
            ? Number(budgetMonthly.sales_det_qty_2)
            : 0,
          converted_qty: Number(s.converted_quantity),
          ss_hurdle_qty: s.ss_hurdle_qty ? Number(s.ss_hurdle_qty) : 0,
          rate: s.warehouse_rate ? Number(s.warehouse_rate) : 0,
        });
      }
      if (!merged.length) {
        results.push({
          location_id,
          location_name,
          status: "skipped",
          reason: "No matching sales data to merge for transaction details.",
        });
        continue;
      }

      // Validate that all warehouses have assigned personnel for this period
      const warehousesWithNoAssignment: Array<{
        warehouse_ifs: string;
        warehouse_name: string;
      }> = [];
      for (const row of merged) {
        const empRecord = await this.dataSource.query(
          `SELECT assigned_ss FROM warehouse_employees WHERE warehouse_id = ? AND assignment_date = ? AND status_id = 1`,
          [row.warehouse_id, trans_date],
        );
        const hasAssignment =
          empRecord && empRecord.length > 0 && empRecord[0].assigned_ss;
        if (!hasAssignment) {
          warehousesWithNoAssignment.push({
            warehouse_ifs: row.warehouse_ifs,
            warehouse_name: row.warehouse_name,
          });
        }
      }

      if (warehousesWithNoAssignment.length > 0) {
        const warehouseList = warehousesWithNoAssignment
          .map((w) => `${w.warehouse_ifs} - ${w.warehouse_name}`)
          .join(", ");

        results.push({
          location_id,
          location_name,
          status: "skipped",
          reason: `The following warehouses have no assigned personnel for this period: ${warehouseList}. Please contact your location admin to assign personnel before creating this transaction.`,
        });

        // Send notification email asynchronously (fire and forget)
        this.sendNoAssignmentNotificationEmails(
          location_id,
          location_name,
          warehousesWithNoAssignment,
          created_by,
          trans_date,
        ).catch((err) => {
          logger.error(
            `Background email sending failed for location ${location_name}:`,
            err,
          );
        });

        continue;
      }

      // 5. Insert transaction_header
      const header = await this.headerRepo.save({
        trans_date,
        location_id,
        status_id: 3, // Pending
        created_by,
        access_key_id,
      });
      // 6. Batch insert transaction_details
      const detailEntities = merged.map((row) =>
        this.detailRepo.create({
          transaction_header_id: header.id,
          warehouse_id: row.warehouse_id,
          budget_volume: row.sales_det_qty_2,
          budget_volume_monthly: row.budget_volume_monthly,
          ss_hurdle_qty: row.ss_hurdle_qty,
          sales_qty: row.converted_qty,
          rate: row.rate,
          status_id: 3,
        }),
      );
      await this.detailRepo.save(detailEntities);

      // Update assigned employees on transactional
      await this.dataSource.query(
        `
        UPDATE transaction_details a
        INNER JOIN warehouse_employees b ON a.warehouse_id = b.warehouse_id AND b.assignment_date <= ? AND b.status_id = 1
        SET
          a.assigned_ss = b.assigned_ss,
          a.assigned_ah = b.assigned_ah,
          a.assigned_bch = b.assigned_bch,
          a.assigned_gbch = b.assigned_gbch,
          a.assigned_rh = b.assigned_rh,
          a.assigned_grh = b.assigned_grh
        WHERE b.status_id = 1 AND a.transaction_header_id = ?
      `,
        [trans_date, header.id],
      );

      // Audit trail for transaction creation
      await this.userAuditTrailCreateService.create(
        {
          service: "transactions",
          method: "createTransaction",
          raw_data: JSON.stringify({ header, details: merged }),
          description: `Created transaction header ${header.id} with ${merged.length} details for location ${location_id} (${location_code})`,
          status_id: 1,
        },
        created_by,
      );
      results.push({
        location_id,
        location_name,
        status: "created",
        header_id: header.id,
        details_count: merged.length,
      });
    }
    if (results.length > 0) {
      // SSE Events
      try {
        this.sseEventEmitter.emitCreate("transactions", 0);
        this.sseEventEmitter.emitCreate("dashboard", 0);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }
    }
    return results;
  }

  /**
   * Batch update transaction_details and transaction_headers fields.
   * @param payload { header_updates: [{transaction_header_id, trans_date?}], detail_updates: [{transaction_header_id, rate?, ss_hurdle_qty?, budget_volume?}] }
   */
  async batchUpdateTransactions(payload: {
    header_updates?: Array<{
      transaction_header_id: number;
      trans_date?: string;
    }>;
    detail_updates?: Array<{
      transaction_header_id: number;
      rate?: number;
      ss_hurdle_qty?: number;
      budget_volume?: number;
    }>;
  }) {
    const results = { header_updates: [], detail_updates: [] };
    // 1. Batch update transaction_details
    if (payload.detail_updates && payload.detail_updates.length > 0) {
      for (const upd of payload.detail_updates) {
        const updateFields: any = {};
        if (typeof upd.rate === "number") updateFields.rate = upd.rate;
        if (typeof upd.ss_hurdle_qty === "number")
          updateFields.ss_hurdle_qty = upd.ss_hurdle_qty;
        if (typeof upd.budget_volume === "number")
          updateFields.budget_volume = upd.budget_volume;
        if (Object.keys(updateFields).length > 0) {
          await this.detailRepo.update(
            { transaction_header_id: upd.transaction_header_id },
            updateFields,
          );
          results.detail_updates.push({
            transaction_header_id: upd.transaction_header_id,
            ...updateFields,
          });
        }
      }
    }
    // 2. Batch update transaction_headers (trans_date)
    if (payload.header_updates && payload.header_updates.length > 0) {
      for (const upd of payload.header_updates) {
        if (upd.trans_date) {
          // Get header to update
          const header = await this.headerRepo.findOne({
            where: { id: upd.transaction_header_id },
          });
          if (!header) {
            results.header_updates.push({
              transaction_header_id: upd.transaction_header_id,
              status: "skipped",
              reason: "Header not found",
            });
            continue;
          }
          // Check for duplicate (not cancelled)
          const duplicate = await this.headerRepo.findOne({
            where: {
              location_id: header.location_id,
              trans_date: upd.trans_date,
              access_key_id: header.access_key_id,
              status_id: Not(5),
              id: Not(header.id),
            },
          });
          if (duplicate) {
            results.header_updates.push({
              transaction_header_id: upd.transaction_header_id,
              status: "skipped",
              reason: `A transaction already exists for location: ${header.location_id}, date: ${upd.trans_date}, status: ${duplicate.status_id}`,
            });
            continue;
          }
          await this.headerRepo.update(header.id, {
            trans_date: upd.trans_date,
          });
          results.header_updates.push({
            transaction_header_id: upd.transaction_header_id,
            trans_date: upd.trans_date,
            status: "updated",
          });
        }
      }
    }
    // SSE Events
    try {
      this.sseEventEmitter.emitUpdateSignal("transactions", 0);
      this.sseEventEmitter.emitUpdateSignal("dashboard", 0);
    } catch (err) {
      logger.error("SSE event failed for update:", err);
    }
    return results;
  }

  /**
   * Generate a report joining transaction_details to warehouse_employees and employees for assigned roles
   * Returns: For each detail, includes assigned employee full names for each warehouse role
   * Optional filters: location_ids (array), trans_date (full date string, e.g. '2025-05-01'), warehouse_id, status_id
   * Now includes region.region_name in the response
   * Now validates allowed locations and access_key based on user JWT
   */
  async generateTransactionReport(filters?: {
    location_ids?: number[];
    trans_date?: string; // format: 'YYYY-MM-DD'
    warehouse_id?: number;
    status_id?: number;
    user_id?: number;
    role_id?: number;
    current_access_key?: number;
  }) {
    // Validate allowed locations for user
    let allowedLocationIds: number[] | undefined = undefined;
    if (filters?.user_id && filters?.role_id) {
      allowedLocationIds =
        await this.commonUtilitiesService.getUserAllowedLocationIds(
          filters.user_id,
          filters.role_id,
        );
    }

    // Build query for details with joins to header, warehouse, status, location, region, and employees for assigned roles
    const qb = this.detailRepo
      .createQueryBuilder("detail")
      .leftJoinAndSelect("detail.transaction_header", "header")
      .leftJoinAndSelect("header.location", "location")
      .leftJoinAndSelect("location.region", "region")
      .leftJoinAndSelect("header.status", "status")
      .leftJoinAndSelect("detail.warehouse", "warehouse")
      .leftJoinAndSelect("detail.assignedSs", "assignedSs")
      .leftJoinAndSelect("detail.assignedAh", "assignedAh")
      .leftJoinAndSelect("detail.assignedBch", "assignedBch")
      .leftJoinAndSelect("detail.assignedGbch", "assignedGbch")
      .leftJoinAndSelect("detail.assignedRh", "assignedRh")
      .leftJoinAndSelect("detail.assignedGrh", "assignedGrh");

    // Filter by allowed locations (user)
    if (allowedLocationIds && allowedLocationIds.length > 0) {
      qb.andWhere("header.location_id IN (:...allowedLocationIds)", {
        allowedLocationIds,
      });
    }
    // Filter by current_access_key (user)
    if (filters?.current_access_key) {
      qb.andWhere("header.access_key_id = :access_key_id", {
        access_key_id: filters.current_access_key,
      });
    }
    // Optional filters
    if (filters?.location_ids && filters.location_ids.length > 0) {
      qb.andWhere("header.location_id IN (:...location_ids)", {
        location_ids: filters.location_ids,
      });
    }
    if (filters?.warehouse_id) {
      qb.andWhere("detail.warehouse_id = :warehouse_id", {
        warehouse_id: filters.warehouse_id,
      });
    }
    if (filters?.trans_date) {
      qb.andWhere("header.trans_date = :trans_date", {
        trans_date: filters.trans_date,
      });
    }
    if (filters?.status_id) {
      qb.andWhere("header.status_id = :status_id", {
        status_id: filters.status_id,
      });
    }

    const details = await qb.getMany();
    if (!details.length) return [];

    // Build report using employee names for assigned roles
    const report = details.map((detail) => {
      const header = detail.transaction_header;
      return {
        detail_id: detail.id,
        transaction_header_id: detail.transaction_header_id,
        warehouse_id: detail.warehouse_id,
        warehouse_ifs: detail.warehouse?.warehouse_ifs,
        warehouse_name: detail.warehouse?.warehouse_name,
        budget_volume: detail.budget_volume,
        budget_volume_monthly: detail.budget_volume_monthly,
        sales_qty: detail.sales_qty,
        ss_hurdle_qty: detail.ss_hurdle_qty,
        rate: detail.rate,
        details_status_id: detail.status_id,
        assigned_ss_name: detail.assignedSs
          ? `${detail.assignedSs.employee_first_name} ${detail.assignedSs.employee_last_name}`
          : null,
        assigned_ah_name: detail.assignedAh
          ? `${detail.assignedAh.employee_first_name} ${detail.assignedAh.employee_last_name}`
          : null,
        assigned_bch_name: detail.assignedBch
          ? `${detail.assignedBch.employee_first_name} ${detail.assignedBch.employee_last_name}`
          : null,
        assigned_gbch_name: detail.assignedGbch
          ? `${detail.assignedGbch.employee_first_name} ${detail.assignedGbch.employee_last_name}`
          : null,
        assigned_rh_name: detail.assignedRh
          ? `${detail.assignedRh.employee_first_name} ${detail.assignedRh.employee_last_name}`
          : null,
        assigned_grh_name: detail.assignedGrh
          ? `${detail.assignedGrh.employee_first_name} ${detail.assignedGrh.employee_last_name}`
          : null,
        // Transaction header info
        trans_number: header?.trans_number,
        location_name: header?.location?.location_name,
        location_abbr: header?.location?.location_abbr,
        location_id: header?.location_id,
        trans_date: header?.trans_date,
        trans_year: header?.trans_date
          ? new Date(header.trans_date).getFullYear()
          : null,
        status_name: header?.status?.status_name,
        status_id: header?.status_id,
        region_name: header?.location?.region?.region_name || null,
      };
    });
    return report;
  }
}
