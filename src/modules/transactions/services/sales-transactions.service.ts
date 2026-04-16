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
import { access } from "fs";

@Injectable()
export class SalesTransactionsService {
  constructor(
    @InjectRepository(SalesTransaction)
    private salesTransactionsRepository: Repository<SalesTransaction>,
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
}
