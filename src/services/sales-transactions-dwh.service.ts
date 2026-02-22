import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as mysql from "mysql2/promise";
import { SalesTransaction } from "../entities/SalesTransaction";
import { DwhLog } from "../entities/dwhLog";
import { Location } from "../entities/Location";

@Injectable()
export class SalesTransactionsDwhService {
  constructor(
    @InjectRepository(SalesTransaction)
    private salesTransactionsRepository: Repository<SalesTransaction>,
    @InjectRepository(DwhLog)
    private dwhLogRepository: Repository<DwhLog>,
    @InjectRepository(Location)
    private locationsRepository: Repository<Location>,
  ) {}

  async pullAndInsertFromDwh({
    batchSize = 1000,
    accessKeyId = 1,
    statusId = 1,
    startDate,
    endDate,
    category = "ROASTED CHICKEN",
  }: {
    batchSize?: number;
    accessKeyId?: number;
    statusId?: number;
    startDate: string;
    endDate: string;
    category?: string;
  }): Promise<{ success: number; failed: number }> {
    let logMessage = "";
    let logError = null;
    let success = 0;
    let failed = 0;
    const unmatchedBusinessCenters = new Map<string, number>(); // Track unmatched BC with row count

    try {
      // Fetch all locations once for O(1) lookup (optimal for DWH performance)
      // Map: location_name (uppercase) -> { code, name }
      const allLocations = await this.locationsRepository.find({
        where: { status_id: 1 },
        select: ["location_code", "location_name"],
      });
      const locationMap = new Map<string, { code: string; name: string }>();
      allLocations.forEach((loc) => {
        locationMap.set(loc.location_name.toUpperCase(), {
          code: loc.location_code,
          name: loc.location_name,
        });
      });

      const sourceConn = await mysql.createConnection({
        host: "10.2.4.122",
        user: "akatok",
        password: "nF+G5-M%",
        database: "ctgi",
      });
      // Build dynamic WHERE clauses based on parameters
      const whereClauses = [
        "(DOCSTATUS = 'O' OR DOCSTATUS = 'C')",
        "DOCDATE >= ?",
        "DOCDATE <= ?",
        "arinvoices.COMPANY = 'CTGI'",
        "arinvoices.BRANCH = 'HO'",
      ];
      const queryParams: any[] = [startDate, endDate];
      if (category) {
        whereClauses.push("s.U_PRDCLASS = ?");
        queryParams.push(category);
      }
      const query = `
      SELECT
        MONTH( DOCDATE ) AS MONTH_DOCDATE,
        STR_TO_DATE( CONCAT( YEAR ( DOCDATE ), '-', MONTH ( DOCDATE ), '-01' ), '%Y-%m-%d' ) AS DOCDATE,
        arinvoices.U_BUSINESS_CENTER as U_BUSINESSCENTER,
        arinvoices.U_DIVISION,
        arinvoiceitems.WHSCODE,
        warehouses.WAREHOUSENAME,
        arinvoices.U_DISTRIBUTION_CHANNEL AS U_DCHANNEL,
        arinvoiceitems.ITEMCODE,
        arinvoiceitems.ITEMDESC,
        arinvoiceitems.VATCODE,
        ROUND( SUM( arinvoiceitems.QUANTITY * arinvoiceitems.UNITPRICE), 6 ) AS GROSSSALES,
        SUM( arinvoiceitems.LINETOTAL - arinvoiceitems.VATAMOUNT ) AS NETSALES,
        SUM( arinvoiceitems.QUANTITY ) AS QUANTITY,
        ROUND( SUM( arinvoiceitems.QUANTITY * s.U_AMOUNT), 6 ) AS CONVERTED_QUANTITY,
        SUM( arinvoiceitems.LINETOTAL ) AS LINETOTAL,
        arinvoiceitems.UNITPRICE AS UNITPRICE,
        SUM( arinvoiceitems.VATAMOUNT ) AS VATAMOUNT,
        SUM( arinvoiceitems.LINECOST ) AS LINECOST,
        SUM( arinvoiceitems.ITEMCOST ) AS ITEMCOST,
        SUM( arinvoiceitems.DISCAMOUNT ) AS DISCAMOUNT,
        arinvoiceitems.VATRATE AS VATRATE,
        s.U_VARIANT as U_CAT01,
        s.U_PRDCLASS as U_CAT02,
        s.U_AMOUNT as U_SALESCONV,
        0 as U_SALESUNITEQ,
        i.ITEMGROUP,
        i.UOM 
      FROM
        arinvoices
        INNER JOIN arinvoiceitems ON arinvoiceitems.DOCID = arinvoices.DOCID 
        AND arinvoiceitems.COMPANY = arinvoices.COMPANY 
        AND arinvoiceitems.BRANCH = arinvoices.BRANCH
        INNER JOIN warehouses ON warehouses.WAREHOUSE = arinvoiceitems.WHSCODE 
        AND warehouses.BRANCH = arinvoiceitems.BRANCH 
        AND warehouses.COMPANY = arinvoiceitems.COMPANY
        INNER JOIN items i ON arinvoiceitems.ITEMCODE = i.ITEMCODE
        INNER JOIN u_salesunitequivalents s ON i.ITEMCODE = s.CODE AND s.COMPANY = 'CTGI' 
        AND s.BRANCH = 'HO' 
        WHERE ${whereClauses.join(" AND ")}
        GROUP BY arinvoiceitems.WHSCODE, arinvoiceitems.ITEMCODE
        ORDER BY arinvoiceitems.WHSCODE, arinvoiceitems.ITEMCODE
    `;

      // console.log("Executing query:", query);
      // console.log("Query params:", queryParams);

      const [rows] = await sourceConn.execute(query, queryParams);
      const rowsArray = rows as any[];
      logMessage = `Pulled ${rowsArray.length} rows from DWH with params: db=ctgi, category=${category}, start=${startDate}, end=${endDate}`;
      logMessage += `\nQuery: ${query}`;
      const total = rowsArray.length;
      for (let i = 0; i < total; i += batchSize) {
        const batch = rowsArray.slice(i, i + batchSize);

        // Filter batch: match U_BUSINESSCENTER against locations
        const toInsert: any[] = [];
        for (const row of batch) {
          const bcUpperCase = (row.U_BUSINESSCENTER || "").toUpperCase();

          if (locationMap.has(bcUpperCase)) {
            // Match found, retrieve location code
            const locationInfo = locationMap.get(bcUpperCase);
            toInsert.push({
              doc_date: row.DOCDATE,
              doc_date_month: row.MONTH_DOCDATE,
              bc_code: locationInfo.code, // Use location_code instead of raw U_BUSINESSCENTER
              division: row.U_DIVISION,
              whs_code: row.WHSCODE,
              whs_name: row.WAREHOUSENAME,
              dchannel: row.U_DCHANNEL,
              item_code: row.ITEMCODE,
              item_desc: row.ITEMDESC,
              vat_cdoe: row.VATCODE,
              gross_sales: row.GROSSSALES,
              net_sales: row.NETSALES,
              quantity: row.QUANTITY,
              converted_quantity: row.CONVERTED_QUANTITY,
              line_total: row.LINETOTAL,
              unit_price: row.UNITPRICE,
              vat_amount: row.VATAMOUNT,
              line_cost: row.LINECOST,
              item_cost: row.ITEMCOST,
              disc_amount: row.DISCAMOUNT,
              vat_rate: row.VATRATE,
              cat01: row.U_CAT01,
              cat02: row.U_CAT02,
              sales_conv: row.U_SALESCONV,
              sales_unit_eq: row.U_SALESUNITEQ,
              item_group: row.ITEMGROUP,
              uom: row.UOM,
              access_key_id: accessKeyId,
              status_id: statusId,
            });
          } else {
            // No match, track as unmatched
            unmatchedBusinessCenters.set(
              row.U_BUSINESSCENTER,
              (unmatchedBusinessCenters.get(row.U_BUSINESSCENTER) || 0) + 1,
            );
          }
        }

        // 1. Build unique keys for insert batch
        const keys = toInsert.map((row) => ({
          item_code: row.item_code,
          whs_code: row.whs_code,
          doc_date_month: row.doc_date_month,
        }));

        // 2. Update all existing records for this batch to status_id = 2
        if (keys.length > 0) {
          await this.salesTransactionsRepository
            .createQueryBuilder()
            .update(SalesTransaction)
            .set({ status_id: 2 })
            .where(
              keys
                .map(
                  (k, idx) =>
                    `(item_code = :item_code${idx} AND whs_code = :whs_code${idx} AND doc_date_month = :doc_date_month${idx})`,
                )
                .join(" OR "),
              Object.assign(
                {},
                ...keys.map((k, idx) => ({
                  [`item_code${idx}`]: k.item_code,
                  [`whs_code${idx}`]: k.whs_code,
                  [`doc_date_month${idx}`]: k.doc_date_month,
                })),
              ),
            )
            .execute();
        }

        // 3. Bulk insert new records in a transaction
        if (toInsert.length > 0) {
          await this.salesTransactionsRepository.manager.transaction(
            async (manager) => {
              await manager.getRepository(SalesTransaction).insert(toInsert);
            },
          );
          success += toInsert.length;
        }
      }
      await sourceConn.end();
    } catch (err) {
      logError = err?.message || String(err);
      failed = 1;
    } finally {
      // Build unmatched business centers log message
      let unmatchedMessage = "";
      if (unmatchedBusinessCenters.size > 0) {
        const unmatchedList = Array.from(unmatchedBusinessCenters.entries())
          .map(([bc, count]) => `${bc} (${count} rows not included)`)
          .join(", ");
        unmatchedMessage = `\nUnmatched Business Centers: ${unmatchedList}`;
      }

      await this.dwhLogRepository.insert({
        type: "sales transactions",
        message: logError
          ? `ERROR: ${logError}`
          : logMessage + unmatchedMessage,
        row_data: JSON.stringify({
          batchSize,
          accessKeyId,
          statusId,
          startDate,
          endDate,
          category,
          success,
          unmatchedBusinessCenters: Object.fromEntries(
            unmatchedBusinessCenters,
          ),
        }),
      });
    }
    return { success, failed };
  }
}
