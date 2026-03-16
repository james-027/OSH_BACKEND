import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SalesBudgetTransaction } from "../entities/SalesBudgetTransaction";
import { DwhLog } from "../entities/dwhLog";
import { getCtgiBudgetingConnection } from "../utils/dwh-datasources";
import { SSEEventEmitterHelper } from "./sse-event-emitter.helper";
import logger from "src/config/logger";

@Injectable()
export class SalesBudgetTransactionsDwhService {
  constructor(
    @InjectRepository(SalesBudgetTransaction)
    private salesBudgetTransactionsRepository: Repository<SalesBudgetTransaction>,
    @InjectRepository(DwhLog)
    private dwhLogRepository: Repository<DwhLog>,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async pullAndInsertFromDwh({
    batchSize = 2000,
    accessKeyId = 1,
    statusId = 1,
    database = "budgeting_2025_prod_db",
    salesYear = 2025,
    materialGroups = [5, 6],
  }: {
    batchSize?: number;
    accessKeyId?: number;
    statusId?: number;
    database?: string;
    salesYear?: number;
    materialGroups?: number[];
  }): Promise<{ success: number; failed: number }> {
    let logMessage = "";
    let logError = null;
    let success = 0;
    let failed = 0;
    try {
      const sourceConn = await getCtgiBudgetingConnection(database);

      // Use named parameters with spread for IN clause - SAFE FROM SQL INJECTION
      const materialGroupsToUse =
        materialGroups && materialGroups.length > 0 ? materialGroups : [5, 6];

      const query = `SELECT bc_name, bc_code, ifs_code, outlet_name, material_code, material_desc, material_group_name, SUM(sales_det_qty) AS sales_det_qty, SUM(sales_det_qty_2) AS sales_det_qty_2, MONTH(sales_det_date) AS sales_month, sales_det_date FROM ( SELECT g.bc_name, g.bc_code, d.ifs_code, d.outlet_name, f.brand_name, c.material_code, c.material_desc, i.vat_type_name, j.material_group_name, h.sales_det_date, h.sales_det_qty, h.sales_det_asp, c.material_id, h.sales_det_qty * IFNULL(( SELECT y.sales_live_alw_det_value FROM sales_live_alw_tbl x, sales_live_alw_detail_tbl y WHERE x.sales_live_alw_id = y.sales_live_alw_id AND x.bc_id = g.bc_id AND x.sales_live_alw_status = 1 AND y.sales_live_alw_det_status = 1 AND c.material_code = '9100100' AND x.sales_live_alw_year = :salesYear AND y.sales_live_alw_det_date = h.sales_det_date ), 1 ) AS sales_det_qty_2, IFNULL(( SELECT z.sales_tactical_det_price FROM sales_tactical_tbl x, sales_tactical_item_tbl y, sales_tactical_details_tbl z WHERE d.outlet_id = x.outlet_id AND x.sales_tactical_id = y.sales_tactical_id AND b.material_id = y.material_id AND y.sales_tactical_item_id = z.sales_tactical_item_id AND h.sales_det_date = z.sales_tactical_det_date AND x.sales_tactical_status = 1 AND y.sales_tactical_item_status = 1 AND z.sales_tactical_det_status = 1 ), 0 ) AS tactical, j.material_group_id, IFNULL(( SELECT y.sales_live_alw_det_value FROM sales_live_alw_tbl x, sales_live_alw_detail_tbl y WHERE x.sales_live_alw_id = y.sales_live_alw_id AND x.bc_id = g.bc_id AND x.sales_live_alw_status = 1 AND y.sales_live_alw_det_status = 1 AND c.material_code = '9100100' AND x.sales_live_alw_year = :salesYear AND y.sales_live_alw_det_date = h.sales_det_date ), 1 ) AS alw, IFNULL(( SELECT x.sales_unit_equivalent FROM material_unit_tbl x WHERE c.material_id = x.material_id AND x.material_unit_status = 1 LIMIT 1 ), 0 ) AS sales_unit FROM sales_tbl a JOIN sales_item_tbl b ON a.sales_id = b.sales_id AND a.sales_status = 1 AND b.sales_item_status = 1 JOIN material_tbl c ON b.material_id = c.material_id JOIN outlet_tbl d ON a.outlet_id = d.outlet_id JOIN outlet_brand_tbl e ON d.outlet_id = e.outlet_id JOIN brand_tbl f ON e.brand_id = f.brand_id JOIN bc_tbl g ON d.bc_id = g.bc_id JOIN sales_details_tbl h ON b.sales_item_id = h.sales_item_id JOIN vat_type_tbl i ON c.vat_type_id = i.vat_type_id JOIN material_group_tbl j ON c.material_group_id = j.material_group_id AND a.sales_year = :salesYear AND j.material_group_id IN (:...materialGroups) WHERE e.outlet_brand_status = 1 ) x GROUP BY bc_code, material_code, MONTH(sales_det_date), ifs_code ORDER BY ifs_code, material_code, sales_month`;

      // Named parameters object with spread operator for IN clause
      const queryParams = {
        salesYear,
        materialGroups: materialGroupsToUse,
      };

      const [rows] = await sourceConn.execute(query, queryParams);
      const rowsArray = rows as any[];
      logMessage = `Pulled ${rowsArray.length} rows from DWH with params: db=${database}, year=${salesYear}, groups=${materialGroupsToUse}`;
      const total = rowsArray.length;
      for (let i = 0; i < total; i += batchSize) {
        const batch = rowsArray.slice(i, i + batchSize);
        // Build unique keys for batch
        const keys = batch.map((row) => ({
          bc_code: row.bc_code,
          sales_month: row.sales_month,
          ifs_code: row.ifs_code,
          material_code: row.material_code,
        }));
        // Update all existing records for this batch to status_id = 2
        if (keys.length > 0) {
          await this.salesBudgetTransactionsRepository
            .createQueryBuilder()
            .update(SalesBudgetTransaction)
            .set({ status_id: 2 })
            .where(
              keys
                .map(
                  (k, idx) =>
                    `(bc_code = :bc_code${idx} AND sales_month = :sales_month${idx} AND ifs_code = :ifs_code${idx} AND material_code = :material_code${idx})`,
                )
                .join(" OR "),
              Object.assign(
                {},
                ...keys.map((k, idx) => ({
                  [`bc_code${idx}`]: k.bc_code,
                  [`sales_month${idx}`]: k.sales_month,
                  [`ifs_code${idx}`]: k.ifs_code,
                  [`material_code${idx}`]: k.material_code,
                })),
              ),
            )
            .execute();
        }
        // Prepare new records for insert
        const toInsert = batch.map((row) => ({
          bc_name: row.bc_name,
          bc_code: row.bc_code,
          ifs_code: row.ifs_code,
          outlet_name: row.outlet_name,
          material_code: row.material_code,
          material_desc: row.material_desc,
          material_group_name: row.material_group_name,
          sales_det_qty: row.sales_det_qty,
          sales_det_qty_2: row.sales_det_qty_2,
          sales_month: row.sales_month,
          sales_date: row.sales_det_date,
          access_key_id: accessKeyId,
          status_id: statusId,
        }));
        if (toInsert.length > 0) {
          await this.salesBudgetTransactionsRepository.manager.transaction(
            async (manager) => {
              await manager
                .getRepository(SalesBudgetTransaction)
                .insert(toInsert);
            },
          );
          success += toInsert.length;
        }
      }
      await sourceConn.release();
    } catch (err) {
      logError = err?.message || String(err);
      failed = 1;
    } finally {
      await this.dwhLogRepository.insert({
        type: "sales budget transactions",
        message: logError ? `ERROR: ${logError}` : logMessage,
        row_data: JSON.stringify({
          batchSize,
          accessKeyId,
          statusId,
          database,
          salesYear,
          materialGroups,
        }),
      });
    }
    if (success > 0) {
      // SSE Events
      try {
        this.sseEventEmitter.emitCreateSignal("sales_budget_transactions", 0);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }
    }
    return { success, failed };
  }
}
