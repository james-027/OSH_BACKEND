import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ApiKey } from "../../../entities/ApiKey";
import { ApiAuthAccess } from "../../../entities/ApiAuthAccess";
import { ApiLogs } from "../../../entities/ApiLogs";
import { WarehouseHurdle } from "../../../entities/WarehouseHurdle";
import { WarehouseHurdleCategory } from "../../../entities/WarehouseHurdleCategory";
import { Warehouse } from "../../../entities/Warehouse";
import { WarehouseRequirement } from "../../../entities/WarehouseRequirement";
import { WarehouseRequirementDue } from "../../../entities/WarehouseRequirementDue";
import { ReqTransactionHeader } from "../../../entities/ReqTransactionHeader";
import { ReqTransactionDue } from "../../../entities/ReqTransactionDue";
import { ReqTransactionDetail } from "../../../entities/ReqTransactionDetail";
import {
  getCtgiSemsConnection,
  getCtgiBosDwhConnection,
} from "../../../utils/dwh-datasources";

@Injectable()
export class ApiService {
  constructor(
    @InjectRepository(ApiKey)
    private apiKeyRepository: Repository<ApiKey>,
    @InjectRepository(ApiAuthAccess)
    private apiAuthAccessRepository: Repository<ApiAuthAccess>,
    @InjectRepository(ApiLogs)
    private apiLogsRepository: Repository<ApiLogs>,
    @InjectRepository(WarehouseHurdle)
    private warehouseHurdleRepository: Repository<WarehouseHurdle>,
    @InjectRepository(WarehouseHurdleCategory)
    private warehouseHurdleCategoryRepository: Repository<WarehouseHurdleCategory>,
    @InjectRepository(Warehouse)
    private warehousesRepository: Repository<Warehouse>,
    @InjectRepository(WarehouseRequirement)
    private warehouseRequirementsRepository: Repository<WarehouseRequirement>,
    @InjectRepository(WarehouseRequirementDue)
    private warehouseRequirementDuesRepository: Repository<WarehouseRequirementDue>,
    @InjectRepository(ReqTransactionHeader)
    private reqTransactionHeaderRepository: Repository<ReqTransactionHeader>,
    @InjectRepository(ReqTransactionDue)
    private reqTransactionDueRepository: Repository<ReqTransactionDue>,
    @InjectRepository(ReqTransactionDetail)
    private reqTransactionDetailRepository: Repository<ReqTransactionDetail>,
  ) {}

  async validateApiKey(apiKey: string): Promise<ApiKey> {
    const key = await this.apiKeyRepository.findOne({
      where: { api_keys: apiKey, status_id: 1 },
    });

    if (!key) {
      throw new HttpException("Invalid API key", HttpStatus.UNAUTHORIZED);
    }

    return key;
  }

  async checkApiAccess(
    apiKeyId: number,
    endpoint: string,
    method: string,
  ): Promise<boolean> {
    const access = await this.apiAuthAccessRepository.findOne({
      where: {
        api_key_id: apiKeyId,
        controller_url: endpoint,
        api_method: method,
        status_id: 1,
      },
    });

    return !!access || access?.all_access === 1;
  }

  async logApiRequest(
    apiKeyId: number,
    endpoint: string,
    method: string,
    requestData: any,
    responseData: any,
    statusCode: number,
  ): Promise<void> {
    const log = this.apiLogsRepository.create({
      api_key_id: apiKeyId,
      uri: endpoint,
      method: method.toUpperCase(),
      params: JSON.stringify({
        request: requestData,
        response: responseData,
      }).slice(0, 65535),
      response_code: statusCode,
      time: new Date(),
      authorized: statusCode < 400 ? 1 : 0,
      status_id: 1, // Default active status
    });

    await this.apiLogsRepository.save(log);
  }

  async handleGetRequest(
    endpoint: string,
    queryParams: any,
    apiKeyEntity: any,
  ): Promise<any> {
    const hasAccess = await this.checkApiAccess(
      apiKeyEntity.id,
      endpoint,
      "GET",
    );

    if (!hasAccess) {
      await this.logApiRequest(
        apiKeyEntity.id,
        endpoint,
        "GET",
        queryParams,
        null,
        403,
      );
      throw new HttpException(
        "Access denied for this endpoint",
        HttpStatus.FORBIDDEN,
      );
    }

    let responseData: any;
    let statusCode = 200;

    try {
      responseData = await this.getDataByEndpoint(endpoint, queryParams);
    } catch (error) {
      const err = error as any;
      statusCode = err.status || 500;
      responseData = { error: err.message };
      // Truncate params for store-crew-assignments, stores, suppliers, store-rentals-attachment
      let logResponse = responseData;
      if (
        (endpoint === "store-crew-assignments" ||
          endpoint === "stores" ||
          endpoint === "suppliers" ||
          endpoint === "store-rentals-attachment") &&
        Array.isArray(responseData)
      ) {
        logResponse = { count: responseData.length };
      }
      await this.logApiRequest(
        apiKeyEntity.id,
        endpoint,
        "GET",
        queryParams,
        logResponse,
        statusCode,
      );
      throw error;
    }

    // Truncate params for store-crew-assignments
    let logResponse = responseData;
    if (
      (endpoint === "store-crew-assignments" ||
        endpoint === "stores" ||
        endpoint === "suppliers") &&
      Array.isArray(responseData)
    ) {
      logResponse = { count: responseData.length };
    }
    await this.logApiRequest(
      apiKeyEntity.id,
      endpoint,
      "GET",
      queryParams,
      logResponse,
      statusCode,
    );
    return responseData;
  }

  async handlePostRequest(
    endpoint: string,
    data: any,
    apiKeyEntity: any,
  ): Promise<any> {
    const hasAccess = await this.checkApiAccess(
      apiKeyEntity.id,
      endpoint,
      "POST",
    );
    if (!hasAccess) {
      await this.logApiRequest(
        apiKeyEntity.id,
        endpoint,
        "POST",
        data,
        null,
        403,
      );
      throw new HttpException(
        "Access denied for this endpoint",
        HttpStatus.FORBIDDEN,
      );
    }

    let responseData: any;
    let statusCode = 201;

    try {
      responseData = await this.createDataByEndpoint(endpoint, data);
    } catch (error) {
      const err = error as any;
      statusCode = err.status || 500;
      responseData = { error: err.message };
      await this.logApiRequest(
        apiKeyEntity.id,
        endpoint,
        "POST",
        data,
        responseData,
        statusCode,
      );
      throw error;
    }

    await this.logApiRequest(
      apiKeyEntity.id,
      endpoint,
      "POST",
      data,
      responseData,
      statusCode,
    );
    return responseData;
  }

  async handlePutRequest(
    endpoint: string,
    id: number,
    data: any,
    apiKeyEntity: any,
  ): Promise<any> {
    const hasAccess = await this.checkApiAccess(
      apiKeyEntity.id,
      endpoint,
      "PUT",
    );
    if (!hasAccess) {
      await this.logApiRequest(
        apiKeyEntity.id,
        endpoint,
        "PUT",
        { id, ...data },
        null,
        403,
      );
      throw new HttpException(
        "Access denied for this endpoint",
        HttpStatus.FORBIDDEN,
      );
    }

    let responseData: any;
    let statusCode = 200;

    try {
      responseData = await this.updateDataByEndpoint(endpoint, id, data);
    } catch (error) {
      const err = error as any;
      statusCode = err.status || 500;
      responseData = { error: err.message };
      await this.logApiRequest(
        apiKeyEntity.id,
        endpoint,
        "PUT",
        { id, ...data },
        responseData,
        statusCode,
      );
      throw error;
    }

    await this.logApiRequest(
      apiKeyEntity.id,
      endpoint,
      "PUT",
      { id, ...data },
      responseData,
      statusCode,
    );
    return responseData;
  }

  async handleDeleteRequest(
    endpoint: string,
    id: number,
    apiKeyEntity: any,
  ): Promise<any> {
    const hasAccess = await this.checkApiAccess(
      apiKeyEntity.id,
      endpoint,
      "DELETE",
    );
    if (!hasAccess) {
      await this.logApiRequest(
        apiKeyEntity.id,
        endpoint,
        "DELETE",
        { id },
        null,
        403,
      );
      throw new HttpException(
        "Access denied for this endpoint",
        HttpStatus.FORBIDDEN,
      );
    }

    let responseData: any;
    let statusCode = 200;

    try {
      responseData = await this.deleteDataByEndpoint(endpoint, id);
    } catch (error) {
      const err = error as any;
      statusCode = err.status || 500;
      responseData = { error: err.message };
      await this.logApiRequest(
        apiKeyEntity.id,
        endpoint,
        "DELETE",
        { id },
        responseData,
        statusCode,
      );
      throw error;
    }

    await this.logApiRequest(
      apiKeyEntity.id,
      endpoint,
      "DELETE",
      { id },
      responseData,
      statusCode,
    );
    return responseData;
  }

  private async getDataByEndpoint(
    endpoint: string,
    queryParams: any,
  ): Promise<any> {
    const sourceConn = await getCtgiSemsConnection();
    const bosSourceConn = await getCtgiBosDwhConnection();

    try {
      switch (endpoint) {
        case "warehouse-hurdles":
          const defaultDate = new Date();
          defaultDate.setDate(1);
          const formattedDate = defaultDate.toISOString().slice(0, 10); // "YYYY-MM-DD"

          const queryBuilder = this.warehouseHurdleRepository
            .createQueryBuilder("warehouse_hurdles")
            .leftJoin(
              "warehouses",
              "warehouses",
              "warehouse_hurdles.warehouse_id = warehouses.id",
            )
            .select([
              "warehouses.warehouse_name as store_name",
              "warehouses.warehouse_ifs as store_ifs",
              "warehouses.warehouse_code as store_code",
              "warehouse_hurdles.ss_hurdle_qty as hurdle_qty",
              "DATE_FORMAT(warehouse_hurdles.hurdle_date, '%Y-%m-%d') as hurdle_date",
            ]);

          queryBuilder.where(
            "warehouse_hurdles.status_id = :statusId AND warehouse_hurdles.hurdle_date = :hurdleDate",
            {
              statusId: queryParams.status_id ?? 7,
              hurdleDate: queryParams.hurdle_date ?? formattedDate,
            },
          );

          queryBuilder.orderBy("warehouses.warehouse_ifs", "ASC");

          return await queryBuilder.getRawMany();

        case "warehouse-hurdle-categories":
          return await this.warehouseHurdleCategoryRepository.find({
            where: queryParams.status_id
              ? { status_id: queryParams.status_id }
              : {},
            relations: ["status"],
          });

        case "store-crew-assignments":
          const modified_date = queryParams.modified_date ?? "";

          const whereClauses = [
            "a.asgnStatID = 1",
            "(a.endDate IS NULL or a.endDate > CURDATE())",
          ];

          const sqlParams: any[] = [];
          if (modified_date) {
            whereClauses.push("a.tsModified >= ?");
            sqlParams.push(modified_date);
          }

          const storeCrewAssignmentQuery = `
            SELECT
              b.crewCode as crew_code,
              b.surName AS crew_last_name,
              b.firstName AS crew_first_name,
              b.mi AS crew_middle_initial,
              c.outletIFS AS store_ifs,
              c.outletCode AS store_code,
              c.outletDesc AS store_name,
              DATE_FORMAT(a.effectivityDate, '%Y-%m-%d') AS assignment_effectivity_date,
              DATE_FORMAT(a.endDate, '%Y-%m-%d') AS assignment_end_date,
              DATE_FORMAT(a.tsCreated, '%Y-%m-%d %H:%i:%s') AS ts_created,
              DATE_FORMAT(a.tsModified, '%Y-%m-%d %H:%i:%s') AS ts_modified
            FROM
              crew_outlet a
              INNER JOIN crew b ON a.crewID = b.crewID
              INNER JOIN outlets c ON a.outletID = c.outletID 
            WHERE
              ${whereClauses.join(" AND ")}
              ORDER BY a.tsCreated
          `;

          const [rows] = await sourceConn.execute(
            storeCrewAssignmentQuery,
            sqlParams,
          );
          return rows;

        case "stores":
          const store_modified_date = queryParams.modified_date ?? "";

          const whereClauses2 = ["a.status = 1"];

          const sqlParams2: any[] = [];
          if (store_modified_date) {
            whereClauses2.push("a.tsModified >= ?");
            sqlParams2.push(store_modified_date);
          }

          const storeQuery = `
            SELECT
              a.outletIFS AS store_ifs,
              a.outletCode AS store_code,
              a.outletDesc AS store_name,
              b.branchCode as branch_code,
              b.branch AS branch_name,
              a.address,
              c.townGroup as town_group,
              DATE_FORMAT(a.tsModified, '%Y-%m-%d %H:%i:%s') AS ts_modified
            FROM
              outlets a
              INNER JOIN branches b ON a.brnID = b.brnID
              INNER JOIN town_groups c ON a.tgID = c.tgID
            WHERE
              ${whereClauses2.join(" AND ")}
            ORDER BY a.outletIFS
          `;

          const [store_rows] = await sourceConn.execute(storeQuery, sqlParams2);
          return store_rows;

        case "store-rentals-attachment":
          // Get parameters
          const warehouse_ifs = queryParams.wh_bos_code;
          const start_date = queryParams.start_date;
          const grouped =
            queryParams.grouped === "true" || queryParams.grouped === true; // Default: false (Option B)

          if (!warehouse_ifs || !start_date) {
            throw new HttpException(
              "Missing required parameters: warehouse_ifs, start_date",
              HttpStatus.BAD_REQUEST,
            );
          }

          // Step 1: Find warehouse by warehouse_ifs
          const warehouse = await this.warehousesRepository.findOne({
            where: { warehouse_ifs },
          });

          if (!warehouse) {
            return ["no warehouse"]; // No warehouse found
          }

          // Step 2: Find warehouse requirement with requirement_id = 6
          const warehouseRequirement =
            await this.warehouseRequirementsRepository.findOne({
              where: {
                warehouse_id: warehouse.id,
                requirement_id: 6,
                status_id: 1,
              },
            });

          if (!warehouseRequirement) {
            return ["no rental requirement"]; // No rental requirement for this warehouse
          }

          // Step 3: Find warehouse requirement dues with exact start_date match
          const warehouseRequirementDue =
            await this.warehouseRequirementDuesRepository.findOne({
              where: {
                warehouse_requirement_id: warehouseRequirement.id,
                warehouse_requirement_due_start: start_date,
                status_id: 2,
              },
            });

          if (!warehouseRequirementDue) {
            return ["no due found"]; // No due found for this start_date
          }

          // Step 4: Build optimized QueryBuilder to fetch all transaction data
          const rentalQuery = this.reqTransactionHeaderRepository
            .createQueryBuilder("rth")
            .innerJoin(
              "rth.reqTransactionDues",
              "rtd",
              "rtd.warehouse_requirement_due_id = :dueid",
              { dueid: warehouseRequirementDue.id },
            )
            .leftJoinAndSelect("rth.reqTransactionDetails", "rtd_details")
            .where("rth.status_id = :header_status", { header_status: 1 })
            .andWhere("rtd_details.status_id = :detail_status", {
              detail_status: 1,
            });

          const [sql, params] = rentalQuery.getQueryAndParameters();
          console.log("SQL:", sql);
          console.log("Parameters:", params);

          const transactionHeaders = await rentalQuery.getMany();

          if (transactionHeaders.length === 0) {
            return []; // No transactions found
          }

          // Step 5: Transform response based on grouped flag
          if (grouped) {
            // Option A: Grouped by header (multiple files per header)
            return transactionHeaders.map((header) => ({
              trans_number: header.trans_number,
              header_id: header.id,
              due_id: warehouseRequirementDue.id,
              detail_ids: (header.reqTransactionDetails || []).map((d) => d.id),
              file_urls: (header.reqTransactionDetails || [])
                .filter((d) => d.requirement_file_path)
                .map(
                  (d) =>
                    `${process.env.APP_URL || `http://localhost:3000`}/${d.requirement_file_path}`,
                ),
            }));
          } else {
            // Option B: One entry per detail (one detail = one file)
            const results: any[] = [];
            transactionHeaders.forEach((header) => {
              (header.reqTransactionDetails || []).forEach((detail) => {
                if (detail.requirement_file_path) {
                  results.push({
                    trans_number: header.trans_number,
                    header_id: header.id,
                    detail_id: detail.id,
                    due_id: warehouseRequirementDue.id,
                    file_url: `${process.env.APP_URL || `http://localhost:3000`}/${detail.requirement_file_path}`,
                  });
                }
              });
            });
            return results;
          }

        case "suppliers":
          const supplier_modified_date = queryParams.modified_date ?? "";

          const whereClauses3 = ["x.ACTIVE = 1"];

          const sqlParams3: any[] = [];
          if (supplier_modified_date) {
            // whereClauses3.push("x.LASTUPDATED >= ?");
            whereClauses3.push("x.ts_modified >= ?");
            sqlParams3.push(supplier_modified_date);
          }

          const suppQuery = `
            SELECT
              * 
            FROM
              (
              SELECT
                a.SUPPNO AS supp_no,
                a.SUPPNAME AS supp_name,
                a.EMAIL AS email,
                CONCAT(
                  CONCAT_WS(
                    ' ',
                    NULLIF( b.STREET, '' ),
                    NULLIF( b.BARANGAY, '' ),
                  NULLIF( b.CITY, '' )),
                IF
                  (
                    c.PROVINCENAME IS NULL 
                    OR c.PROVINCENAME = '',
                    '',
                  CONCAT( ', ', c.PROVINCENAME )) 
                ) AS supp_address,
                DATE_FORMAT( a.LASTUPDATED, '%Y-%m-%d %H:%i:%s' ) AS ts_modified,
                a.ACTIVE
              FROM
                suppliers a
                INNER JOIN addresses b ON a.SUPPNO = b.REFID 
                AND b.COMPANY = 'CTGI' 
                AND b.BRANCH = 'HO'
                AND b.REFTYPE = 'SUPPLIER'
                LEFT JOIN provinces c ON b.PROVINCE = c.PROVINCE UNION
              SELECT
                a.SUPPNO AS supp_no,
                a.SUPPNAME AS supp_name,
                a.EMAIL AS email,
                "" AS supp_address,
                DATE_FORMAT( a.LASTUPDATED, '%Y-%m-%d %H:%i:%s' ) AS ts_modified,
                a.ACTIVE
              FROM
                suppliers a 
              WHERE
              a.SUPPNO NOT IN ( SELECT b.REFID FROM addresses b WHERE b.REFTYPE = "SUPPLIER" AND b.COMPANY = 'CTGI' AND b.BRANCH = 'HO' ) 
              ) x
            WHERE
              ${whereClauses3.join(" AND ")}
          `;

          const [supp_rows] = await bosSourceConn.execute(
            suppQuery,
            sqlParams3,
          );
          return supp_rows;

        default:
          throw new HttpException(
            `Endpoint '${endpoint}' not supported`,
            HttpStatus.NOT_FOUND,
          );
      }
    } finally {
      // Explicitly release connections back to the pool to prevent resource leaks
      try {
        await sourceConn.release();
      } catch (err) {
        console.error("Error releasing sourceConn:", err);
      }
      try {
        await bosSourceConn.release();
      } catch (err) {
        console.error("Error releasing bosSourceConn:", err);
      }
    }
  }

  private async createDataByEndpoint(
    endpoint: string,
    data: any,
  ): Promise<any> {
    switch (endpoint) {
      case "warehouse-hurdles":
        const newHurdle = this.warehouseHurdleRepository.create(data);
        return await this.warehouseHurdleRepository.save(newHurdle);

      case "warehouse-hurdle-categories":
        const newCategory = this.warehouseHurdleCategoryRepository.create(data);
        return await this.warehouseHurdleCategoryRepository.save(newCategory);

      default:
        throw new HttpException(
          `Endpoint '${endpoint}' not supported for creation`,
          HttpStatus.NOT_FOUND,
        );
    }
  }

  private async updateDataByEndpoint(
    endpoint: string,
    id: number,
    data: any,
  ): Promise<any> {
    switch (endpoint) {
      case "warehouse-hurdles":
        await this.warehouseHurdleRepository.update(id, data);
        return await this.warehouseHurdleRepository.findOne({ where: { id } });

      case "warehouse-hurdle-categories":
        await this.warehouseHurdleCategoryRepository.update(id, data);
        return await this.warehouseHurdleCategoryRepository.findOne({
          where: { id },
        });

      default:
        throw new HttpException(
          `Endpoint '${endpoint}' not supported for updates`,
          HttpStatus.NOT_FOUND,
        );
    }
  }

  private async deleteDataByEndpoint(
    endpoint: string,
    id: number,
  ): Promise<any> {
    switch (endpoint) {
      case "warehouse-hurdles":
        const hurdle = await this.warehouseHurdleRepository.findOne({
          where: { id },
        });
        if (!hurdle) {
          throw new HttpException(
            "Warehouse hurdle not found",
            HttpStatus.NOT_FOUND,
          );
        }
        await this.warehouseHurdleRepository.remove(hurdle);
        return { message: "Warehouse hurdle deleted successfully" };

      case "warehouse-hurdle-categories":
        const category = await this.warehouseHurdleCategoryRepository.findOne({
          where: { id },
        });
        if (!category) {
          throw new HttpException(
            "Warehouse hurdle category not found",
            HttpStatus.NOT_FOUND,
          );
        }
        await this.warehouseHurdleCategoryRepository.remove(category);
        return { message: "Warehouse hurdle category deleted successfully" };

      default:
        throw new HttpException(
          `Endpoint '${endpoint}' not supported for deletion`,
          HttpStatus.NOT_FOUND,
        );
    }
  }
}
