import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { DataSourceOptions } from "typeorm";
import { User } from "../entities/User";
import { Role } from "../entities/Role";
import { Status } from "../entities/Status";
import { Theme } from "../entities/Theme";
import { Module } from "../entities/Module";
import { Action } from "../entities/Action";
import { AccessKey } from "../entities/AccessKey";
import { Location } from "../entities/Location";
import { LocationType } from "../entities/LocationType";
import { Company } from "../entities/Company";
import { RoleActionPreset } from "../entities/RoleActionPreset";
import { RoleLocationPreset } from "../entities/RoleLocationPreset";
import { UserPermissions } from "../entities/UserPermissions";
import { UserLocations } from "../entities/UserLocations";
import { UserLoginSession } from "../entities/UserLoginSession";
import { Region } from "../entities/Region";
import { Brand } from "../entities/Brand";
import { BrandGroup } from "../entities/BrandGroup";
import { WarehouseType } from "../entities/WarehouseType";
import { Warehouse } from "../entities/Warehouse";
import { WarehouseDwhLog } from "../entities/WarehouseDwhLog";
import { Segment } from "../entities/Segment";
import { Position } from "../entities/Position";
import { Employee } from "../entities/Employee";
import { WarehouseHurdle } from "../entities/WarehouseHurdle";
import { WarehouseHurdleCategory } from "../entities/WarehouseHurdleCategory";
import { WarehouseEmployee } from "../entities/WarehouseEmployee";
import { UserAuditTrail } from "../entities/UserAuditTrail";
import { ItemCategory } from "../entities/ItemCategory";
import { Item } from "../entities/Item";
import { DwhLog } from "../entities/dwhLog";
import { WarehouseRate } from "../entities/WarehouseRate";
import { SalesTransaction } from "../entities/SalesTransaction";
import { SalesBudgetTransaction } from "../entities/SalesBudgetTransaction";
import { TransactionHeader } from "../entities/TransactionHeader";
import { TransactionDetail } from "../entities/TransactionDetail";
import { EmployeeLocation } from "../entities/EmployeeLocation";
import { ActionLog } from "../entities/ActionLog";
import { Notification } from "../entities/Notification";
import { ApiKey } from "../entities/ApiKey";
import { ApiAuthAccess } from "../entities/ApiAuthAccess";
import { ApiLogs } from "../entities/ApiLogs";
import { ReminderType } from "../entities/ReminderType";
import { RequirementType } from "../entities/RequirementType";
import { Category } from "../entities/Category";
import { CategoryType } from "../entities/CategoryType";
import { Vendor } from "../entities/Vendor";
import { Staff } from "../entities/Staff";
import { RenewalType } from "../entities/RenewalType";
import { Requirement } from "../entities/Requirement";
import { RequirementReminder } from "../entities/RequirementReminder";
import { WarehouseRequirement } from "../entities/WarehouseRequirement";
import { WarehouseRequirementDue } from "../entities/WarehouseRequirementDue";
import { WarehouseRequirementStart } from "../entities/WarehouseRequirementStart";
import { SyncLog } from "../entities/syncLog";
import { ReqTransactionHeader } from "../entities/ReqTransactionHeader";
import { ReqTransactionDetail } from "../entities/ReqTransactionDetail";
import { ReqTransactionDue } from "../entities/ReqTransactionDue";
import { System } from "../entities/System";
import { SystemAccessKey } from "../entities/SystemAccessKey";
import { TransactionSequence } from "../entities/TransactionSequence";
import { LocationHurdleCategory } from "../entities/LocationHurdleCategory";
import { LocationHurdle } from "../entities/LocationHurdle";
import { SystemDocumentation } from "../entities/SystemDocumentation";
import { StaffVendorSalary } from "../entities/StaffVendorSalary";
import { StaffBrand } from "../entities/StaffBrand";
import { StaffCategoryType } from "../entities/StaffCategoryType";
import { StaffWarehouse } from "../entities/StaffWarehouse";

// All entities in one place for easy maintenance
export const entities = [
  User,
  Role,
  Status,
  Theme,
  Module,
  Action,
  AccessKey,
  Location,
  LocationType,
  Company,
  RoleActionPreset,
  RoleLocationPreset,
  UserPermissions,
  UserLocations,
  UserLoginSession,
  Region,
  Brand,
  BrandGroup,
  WarehouseType,
  Warehouse,
  WarehouseDwhLog,
  Segment,
  Position,
  Employee,
  WarehouseHurdle,
  WarehouseHurdleCategory,
  WarehouseEmployee,
  UserAuditTrail,
  ItemCategory,
  Item,
  DwhLog,
  WarehouseRate,
  SalesTransaction,
  SalesBudgetTransaction,
  TransactionHeader,
  TransactionDetail,
  EmployeeLocation,
  ActionLog,
  Notification,
  ApiKey,
  ApiAuthAccess,
  ApiLogs,
  ReminderType,
  RequirementType,
  Category,
  CategoryType,
  Vendor,
  Staff,
  RenewalType,
  Requirement,
  RequirementReminder,
  WarehouseRequirement,
  WarehouseRequirementDue,
  WarehouseRequirementStart,
  SyncLog,
  ReqTransactionHeader,
  ReqTransactionDetail,
  ReqTransactionDue,
  System,
  SystemAccessKey,
  TransactionSequence,
  LocationHurdle,
  LocationHurdleCategory,
  SystemDocumentation,
  StaffVendorSalary,
  StaffBrand,
  StaffCategoryType,
  StaffWarehouse,
];

// Base configuration shared between NestJS and TypeORM CLI
export const baseConfig = {
  type: "mysql" as const,
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  username: process.env.DB_USERNAME || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_DATABASE || "xxx",
  // logging: process.env.NODE_ENV === "development",
  logging: false, // Disable SQL query logging
  entities,
};

// Configuration for NestJS TypeOrmModule
export const databaseConfig: TypeOrmModuleOptions = {
  ...baseConfig,
  synchronize: false, // Keep false to preserve existing data
  autoLoadEntities: false, // We explicitly define entities
  migrations: ["dist/migrations/**/*.js"], // Compiled JS files for runtime
  migrationsTableName: "migrations",
  migrationsRun: false, // Don't auto-run migrations on app start
};

// Configuration for TypeORM CLI (migrations)
export const migrationConfig: DataSourceOptions = {
  ...baseConfig,
  synchronize: false, // Always false for migrations
  migrations: ["src/migrations/**/*.ts"], // Source TS files for CLI
  migrationsTableName: "migrations",
};
