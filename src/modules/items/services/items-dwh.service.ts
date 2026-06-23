import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Item } from "src/entities/Item";
import { ItemCategory } from "src/entities/ItemCategory";
import { DwhLog } from "src/entities/dwhLog";
import { getCtgiBosDwhConnection } from "src/utils/dwh-datasources";

@Injectable()
export class ItemsDwhService {
  constructor(
    @InjectRepository(Item)
    private itemRepository: Repository<Item>,
    @InjectRepository(ItemCategory)
    private itemCategoryRepository: Repository<ItemCategory>,
    @InjectRepository(DwhLog)
    private logRepository: Repository<DwhLog>,
  ) {}

  async pullAndInsertFromDwh(
    batchSize = 1000,
  ): Promise<{ success: number; failed: number }> {
    // const sourceConn = await getCtgiItemsConnection();
    // const oldSql = `select i.ITEMCODE, i.ITEMDESC, i.ITEMGROUP, i.UOM, i.UOMSA, i.U_CAT01, i.U_CAT02, i.U_SALESCONV, i.U_SALESUNITEQ
    //     from items i
    //     where i.ITEMGROUP IN ('FIN_GO', 'TRD_GO', 'RAW_MAT', 'PAC_MAT')
    //     and i.ISVALID = 1`;
    const sourceConn = await getCtgiBosDwhConnection();
    const sql = `SELECT
                  i.ITEMCODE,
                  i.ITEMDESC,
                  i.ITEMGROUP,
                  i.UOM,
                  i.UOMSA,
                  s.U_VARIANT AS U_CAT01,
                  s.U_PRDCLASS AS U_CAT02,
                  s.U_QUANTITY AS U_SALESCONV,
                  0 AS U_SALESUNITEQ 
                FROM
                  items i
                  INNER JOIN u_salesunitequivalents s ON i.ITEMCODE = s.CODE 
                  AND s.COMPANY = 'CTGI' 
                  AND s.BRANCH = 'HO' 
                WHERE
                  i.ITEMGROUP IN ( 'FIN_GO', 'TRD_GO', 'RAW_MAT', 'PAC_MAT' ) 
                  AND i.ISVALID = 1`;
    const [rows] = await sourceConn.execute(sql);
    let success = 0;
    let failed = 0;
    const total = (rows as any[]).length;
    for (let i = 0; i < total; i += batchSize) {
      const batch = (rows as any[]).slice(i, i + batchSize);
      for (const row of batch) {
        try {
          // Find category1_id
          let category1 = null;
          if (row.U_CAT01) {
            category1 = await this.itemCategoryRepository.findOne({
              where: { code: row.U_CAT01, level: 1 },
            });
          }
          // Find category2_id
          let category2 = null;
          if (row.U_CAT02) {
            category2 = await this.itemCategoryRepository.findOne({
              where: { code: row.U_CAT02, level: 2 },
            });
          }
          // Upsert logic: try to find by item_code
          let existing = await this.itemRepository.findOne({
            where: { item_code: row.ITEMCODE },
          });
          if (existing) {
            existing.item_name = row.ITEMDESC;
            existing.item_group = row.ITEMGROUP;
            existing.uom = row.UOM;
            existing.uom_sa = row.UOMSA;
            existing.category1_id = category1 ? category1.id : null;
            existing.category2_id = category2 ? category2.id : null;
            existing.sales_conv = row.U_SALESCONV;
            existing.sales_unit_eq = row.U_SALESUNITEQ;
            await this.itemRepository.save(existing);
          } else {
            const item = this.itemRepository.create({
              item_code: row.ITEMCODE,
              item_name: row.ITEMDESC,
              item_group: row.ITEMGROUP,
              uom: row.UOM,
              uom_sa: row.UOMSA,
              category1_id: category1 ? category1.id : null,
              category2_id: category2 ? category2.id : null,
              sales_conv: row.U_SALESCONV,
              sales_unit_eq: row.U_SALESUNITEQ,
              status_id: 1,
              created_by: 1, // system user or scheduler
              updated_by: 1,
            });
            await this.itemRepository.save(item);
          }
          success++;
        } catch (err: unknown) {
          failed++;
          const errorMessage = err instanceof Error ? err.message : String(err);
          await this.logRepository.save({
            type: "ITEMS_DWH_PULL",
            message: `Error for ITEMCODE ${row.ITEMCODE}: ${errorMessage}`,
          });
        }
      }
    }
    await sourceConn.release();
    return { success, failed };
  }
}
