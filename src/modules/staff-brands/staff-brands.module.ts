import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StaffBrand } from "src/entities/StaffBrand";
import { UserAuditTrail } from "src/entities/UserAuditTrail";
import { UserPermissions } from "src/entities/UserPermissions";
import { Module as AppModule } from "src/entities/Module";
import { Action } from "src/entities/Action";
import { StaffBrandsService } from "src/modules/staff-brands/services/staff-brands.service";
import { StaffBrandsController } from "src/modules/staff-brands/controllers/staff-brands.controller";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailCreateService } from "../users/services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { SSEModule } from "../sse/sse.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StaffBrand,
      UserAuditTrail,
      UserPermissions,
      AppModule,
      Action,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [StaffBrandsController],
  providers: [
    StaffBrandsService,
    UserAuditTrailCreateService,
    ResponseMapperService,
  ],
  exports: [StaffBrandsService],
})
export class StaffBrandsModule {}
