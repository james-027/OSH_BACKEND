import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ApiKey } from "../entities/ApiKey";
import { ApiAuthAccess } from "../entities/ApiAuthAccess";
import { ApiLogs } from "../entities/ApiLogs";
import { WarehouseHurdle } from "../entities/WarehouseHurdle";
import { WarehouseHurdleCategory } from "../entities/WarehouseHurdleCategory";
import * as mysql from "mysql2/promise";

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
    private warehouseHurdleCategoryRepository: Repository<WarehouseHurdleCategory>
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
    method: string
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
    statusCode: number
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
    apiKeyEntity: any
  ): Promise<any> {
    const hasAccess = await this.checkApiAccess(
      apiKeyEntity.id,
      endpoint,
      "GET"
    );

    if (!hasAccess) {
      await this.logApiRequest(
        apiKeyEntity.id,
        endpoint,
        "GET",
        queryParams,
        null,
        403
      );
      throw new HttpException(
        "Access denied for this endpoint",
        HttpStatus.FORBIDDEN
      );
    }

    let responseData: any;
    let statusCode = 200;

    try {
      responseData = await this.getDataByEndpoint(endpoint, queryParams);
    } catch (error) {
      statusCode = error.status || 500;
      responseData = { error: error.message };
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
        statusCode
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
      statusCode
    );
    return responseData;
  }

  async handlePostRequest(
    endpoint: string,
    data: any,
    apiKeyEntity: any
  ): Promise<any> {
    const hasAccess = await this.checkApiAccess(
      apiKeyEntity.id,
      endpoint,
      "POST"
    );
    if (!hasAccess) {
      await this.logApiRequest(
        apiKeyEntity.id,
        endpoint,
        "POST",
        data,
        null,
        403
      );
      throw new HttpException(
        "Access denied for this endpoint",
        HttpStatus.FORBIDDEN
      );
    }

    let responseData: any;
    let statusCode = 201;

    try {
      responseData = await this.createDataByEndpoint(endpoint, data);
    } catch (error) {
      statusCode = error.status || 500;
      responseData = { error: error.message };
      await this.logApiRequest(
        apiKeyEntity.id,
        endpoint,
        "POST",
        data,
        responseData,
        statusCode
      );
      throw error;
    }

    await this.logApiRequest(
      apiKeyEntity.id,
      endpoint,
      "POST",
      data,
      responseData,
      statusCode
    );
    return responseData;
  }

  async handlePutRequest(
    endpoint: string,
    id: number,
    data: any,
    apiKeyEntity: any
  ): Promise<any> {
    const hasAccess = await this.checkApiAccess(
      apiKeyEntity.id,
      endpoint,
      "PUT"
    );
    if (!hasAccess) {
      await this.logApiRequest(
        apiKeyEntity.id,
        endpoint,
        "PUT",
        { id, ...data },
        null,
        403
      );
      throw new HttpException(
        "Access denied for this endpoint",
        HttpStatus.FORBIDDEN
      );
    }

    let responseData: any;
    let statusCode = 200;

    try {
      responseData = await this.updateDataByEndpoint(endpoint, id, data);
    } catch (error) {
      statusCode = error.status || 500;
      responseData = { error: error.message };
      await this.logApiRequest(
        apiKeyEntity.id,
        endpoint,
        "PUT",
        { id, ...data },
        responseData,
        statusCode
      );
      throw error;
    }

    await this.logApiRequest(
      apiKeyEntity.id,
      endpoint,
      "PUT",
      { id, ...data },
      responseData,
      statusCode
    );
    return responseData;
  }

  async handleDeleteRequest(
    endpoint: string,
    id: number,
    apiKeyEntity: any
  ): Promise<any> {
    const hasAccess = await this.checkApiAccess(
      apiKeyEntity.id,
      endpoint,
      "DELETE"
    );
    if (!hasAccess) {
      await this.logApiRequest(
        apiKeyEntity.id,
        endpoint,
        "DELETE",
        { id },
        null,
        403
      );
      throw new HttpException(
        "Access denied for this endpoint",
        HttpStatus.FORBIDDEN
      );
    }

    let responseData: any;
    let statusCode = 200;

    try {
      responseData = await this.deleteDataByEndpoint(endpoint, id);
    } catch (error) {
      statusCode = error.status || 500;
      responseData = { error: error.message };
      await this.logApiRequest(
        apiKeyEntity.id,
        endpoint,
        "DELETE",
        { id },
        responseData,
        statusCode
      );
      throw error;
    }

    await this.logApiRequest(
      apiKeyEntity.id,
      endpoint,
      "DELETE",
      { id },
      responseData,
      statusCode
    );
    return responseData;
  }

  private async getDataByEndpoint(
    endpoint: string,
    queryParams: any
  ): Promise<any> {
    const sourceConn = await mysql.createConnection({
      host: "192.168.74.121",
      user: "ctgi_cms_rem_usr",
      password: "B@v1CM$r3m0t3Localdba@C3sS",
      database: "ctgi_sems",
    });

    const ebtSourceConn = await mysql.createConnection({
      host: "192.168.74.214",
      user: "dba_remote",
      password: "Wdwaxwdadz#07",
      database: "ctgi",
    });

    const bosSourceConn = await mysql.createConnection({
      host: "10.2.4.122",
      user: "sperks_prod",
      password: "D*F3sgF2",
      // user: "akatok",
      // password: "nF+G5-M%",
      database: "ctgi",
    });

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
            "warehouse_hurdles.warehouse_id = warehouses.id"
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
          }
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

        const query = `
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

        const [rows] = await sourceConn.execute(query, sqlParams);
        return rows;

      case "stores":
        const store_modified_date = queryParams.modified_date ?? "";

        const whereClauses2 = ["a.status = 1"];

        const sqlParams2: any[] = [];
        if (store_modified_date) {
          whereClauses2.push("a.tsModified >= ?");
          sqlParams2.push(store_modified_date);
        }

        const query2 = `
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

        const [store_rows] = await sourceConn.execute(query2, sqlParams2);
        return store_rows;

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

        const [supp_rows] = await bosSourceConn.execute(suppQuery, sqlParams3);
        return supp_rows;

      default:
        throw new HttpException(
          `Endpoint '${endpoint}' not supported`,
          HttpStatus.NOT_FOUND
        );
    }
  }

  private async createDataByEndpoint(
    endpoint: string,
    data: any
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
          HttpStatus.NOT_FOUND
        );
    }
  }

  private async updateDataByEndpoint(
    endpoint: string,
    id: number,
    data: any
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
          HttpStatus.NOT_FOUND
        );
    }
  }

  private async deleteDataByEndpoint(
    endpoint: string,
    id: number
  ): Promise<any> {
    switch (endpoint) {
      case "warehouse-hurdles":
        const hurdle = await this.warehouseHurdleRepository.findOne({
          where: { id },
        });
        if (!hurdle) {
          throw new HttpException(
            "Warehouse hurdle not found",
            HttpStatus.NOT_FOUND
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
            HttpStatus.NOT_FOUND
          );
        }
        await this.warehouseHurdleCategoryRepository.remove(category);
        return { message: "Warehouse hurdle category deleted successfully" };

      default:
        throw new HttpException(
          `Endpoint '${endpoint}' not supported for deletion`,
          HttpStatus.NOT_FOUND
        );
    }
  }
}
