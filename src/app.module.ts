import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard } from "@nestjs/throttler";

// Configuration
import configuration from "./config/configuration";
import { DatabaseModule } from "./database/database.module";
import { initializeRedisClient } from "./config/cache.config";

// Entities
import { User } from "./entities/User";
import { Module as ModuleEntity } from "./entities/Module";
import { Action } from "./entities/Action";
import { Location } from "./entities/Location";
import { UserPermissions } from "./entities/UserPermissions";
import { UserLoginSession } from "./entities/UserLoginSession";

// Services
import { EmailService } from "./services/email.service";
import { ResponseMapperService } from "./services/response-mapper.service";
import { CommonUtilitiesService } from "./services/common-utilities.service";
import { FrontendUrlUtil } from "./utils/frontend-url.util";

// Modules
import { UsersModule } from "./modules/users/users.module";
import { EmployeesModule } from "./modules/employees/employees.module";
import { RolesModule } from "./modules/roles/roles.module";
import { StatusModule } from "./modules/status/status.module";
import { ThemesModule } from "./modules/themes/themes.module";
import { LocationsModule } from "./modules/locations/locations.module";
import { CompaniesModule } from "./modules/companies/companies.module";
import { WarehousesModule } from "./modules/warehouses/warehouses.module";
import { ItemsModule } from "./modules/items/items.module";
import { ActionsModule } from "./modules/actions/actions.module";
import { AccessKeysModule } from "./modules/access-keys/access-keys.module";
import { RegionsModule } from "./modules/regions/regions.module";
import { AuditFormsModule } from "./modules/audit-forms/audit-forms.module";
import { AuditFormDetailsModule } from "./modules/audit-form-details/audit-form-details.module";
import { SegmentsModule } from "./modules/segments/segments.module";
import { PositionsModule } from "./modules/positions/positions.module";
import { TransactionsModule } from "./modules/transactions/transactions.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { JwtStrategy } from "./guards/jwt.strategy";
import { PermissionsGuard } from "./guards/permissions.guard";
import { DynamicPermissionsGuard } from "./guards/dynamic-permissions.guard";
import { PayloadSizeGuard } from "./guards/payload-size.guard";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { UserAuditTrailModule } from "./modules/users/user-audit-trail.module";
import { SchedulersModule } from "./modules/schedulers/schedulers.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ModulesModule } from "./modules/modules/modules.module";
import { ApiModule } from "./modules/api/api.module";
import { ReminderTypesModule } from "./modules/reminder-types/reminder-types.module";
import { RequirementTypesModule } from "./modules/requirement-types/requirement-types.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { CategoryTypesModule } from "./modules/category-types/category-types.module";
import { AuditCategoryTypesModule } from "./modules/audit-category-types/audit-category-types.module";
import { VendorsModule } from "./modules/vendors/vendors.module";
import { StaffsModule } from "./modules/staffs/staffs.module";
import { RenewalTypesModule } from "./modules/renewal-types/renewal-types.module";
import { SystemsModule } from "./modules/systems/systems.module";
import { SystemDocumentationsModule } from "./modules/system-documentations/system-documentations.module";
import { RequirementsModule } from "./modules/requirements/requirements.module";
import { WarehouseRequirementsModule } from "./modules/warehouse-requirements/warehouse-requirements.module";
import { ReqTransactionHeadersModule } from "./modules/req-transaction-headers/req-transaction-headers.module";
import { ReqTransactionDetailsModule } from "./modules/req-transaction-details/req-transaction-details.module";
import { ReqTransactionDuesModule } from "./modules/req-transaction-dues/req-transaction-dues.module";
import { SSEModule } from "./modules/sse/sse.module";
import { StaffVendorSalariesModule } from "./modules/staff-vendor-salaries/staff-vendor-salaries.module";
import { StaffBrandsModule } from "./modules/staff-brands/staff-brands.module";
import { StaffCategoryTypesModule } from "./modules/staff-category-types/staff-category-types.module";
import { StaffWarehousesModule } from "./modules/staff-warehouses/staff-warehouses.module";
import cookieParser from "cookie-parser";
import { SSEJwtMiddleware } from "./middleware/sse-jwt.middleware";
import { ThrottleTrackingMiddleware } from "./middleware/throttle-tracking.middleware";
import { ThrottleTrackerService } from "./services/throttle-tracker.service";
import { ThrottleTrackingService } from "./guards/throttle-tracking.guard";
import { TransactionSequence } from "./entities/TransactionSequence";
import { CacheInvalidationModule } from "./modules/cache/cache.module";
import { ProfitcenterModule } from "./modules/profitcenters/profitcenter.module";
import { Profitcenter } from "./entities/Profitcenter";
import { SupplierModule } from "./modules/suppliers/supplier.module";
import { Supplier} from "./entities/Supplier";
import { DebitAdviceCategory } from "./entities/DebitAdviceCategory";
import logger from "./config/logger";
import { DebitAdviceCategoryModule } from "./modules/debit-advice-category/debit-advice-category.module";
@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Database
    DatabaseModule,
    TypeOrmModule.forFeature([
      User,
      UserLoginSession,
      UserPermissions,
      ModuleEntity,
      Action,
      Location,
      TransactionSequence,
      Profitcenter,
      Supplier,
      DebitAdviceCategory
    ]),
    // Authentication
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET || "secret-key",
        signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || "10m" },
      }),
    }),
    ScheduleModule.forRoot(),
    UsersModule,
    EmployeesModule,
    RolesModule,
    StatusModule,
    ThemesModule,
    LocationsModule,
    AuditCategoryTypesModule,
    CompaniesModule,
    WarehousesModule,
    ItemsModule,
    ActionsModule,
    AccessKeysModule,
    RegionsModule,
    AuditFormsModule,
    AuditFormDetailsModule,
    SegmentsModule,
    PositionsModule,
    TransactionsModule,
    NotificationsModule,
    ReportsModule,
    DashboardModule,
    UserAuditTrailModule,
    SchedulersModule,
    AuthModule,
    ModulesModule,
    ApiModule,
    ReminderTypesModule,
    RequirementTypesModule,
    CategoriesModule,
    CategoryTypesModule,
    VendorsModule,
    StaffsModule,
    RenewalTypesModule,
    SystemsModule,
    SystemDocumentationsModule,
    RequirementsModule,
    WarehouseRequirementsModule,
    ReqTransactionHeadersModule,
    ReqTransactionDetailsModule,
    ReqTransactionDuesModule,
    SSEModule,
    StaffVendorSalariesModule,
    StaffBrandsModule,
    StaffCategoryTypesModule,
    StaffWarehousesModule,
    CacheInvalidationModule,
    ProfitcenterModule,
    SupplierModule,
    DebitAdviceCategoryModule,
    
  ],
  providers: [
    EmailService,
    JwtStrategy,
    PermissionsGuard,
    DynamicPermissionsGuard,
    ResponseMapperService,
    CommonUtilitiesService,
    FrontendUrlUtil,
    ThrottleTrackerService,
    ThrottleTrackingService,
    // Exception filters - AllExceptionsFilter handles all exceptions including 429s
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass:
        process.env.SKIP_THROTTLING === "true"
          ? class {
              canActivate() {
                return true;
              }
            }
          : ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PayloadSizeGuard,
    },
  ],
})
export class AppModule implements NestModule, OnModuleInit {
  async onModuleInit() {
    // Initialize Redis client for caching (can be disabled with USE_REDIS=false)
    const useRedis = process.env.USE_REDIS !== "false"; // Default: enabled
    if (useRedis) {
      await initializeRedisClient();
    } else {
      logger.warn("⚠️  Redis is disabled. Caching will not be available.");
    }
  }

  configure(consumer: MiddlewareConsumer) {
    // Track throttle attempts globally (run on all routes first)
    consumer.apply(ThrottleTrackingMiddleware).forRoutes("*");

    // Parse cookies first (before SSE middleware)
    consumer.apply(cookieParser).forRoutes("*");

    // Apply SSE JWT middleware to extract token from cookies or query params
    consumer
      .apply(SSEJwtMiddleware)
      .forRoutes({ path: "sse/*", method: RequestMethod.GET });
  }
}
