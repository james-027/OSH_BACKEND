import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CompaniesController } from "./controllers/companies.controller";
import { CompaniesService } from "./services/companies.service";
import { Company } from "../../entities/Company";
import { UserAuditTrailCreateService } from "src/modules/users/services/user-audit-trail-create.service";
import { User } from "src/entities/User";
import { Status } from "src/entities/Status";
import { UserPermissions } from "src/entities/UserPermissions";
import { Module as AppModule } from "src/entities/Module";
import { Action } from "src/entities/Action";
import { UserAuditTrail } from "src/entities/UserAuditTrail";
import { UsersModule } from "../users/users.module";
import { SSEModule } from "../sse/sse.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      User,
      Status,
      UserPermissions,
      AppModule,
      Action,
      UserAuditTrail,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService, UserAuditTrailCreateService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
