import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StaffCategoryType } from "src/entities/StaffCategoryType";
import { UserAuditTrail } from "src/entities/UserAuditTrail";
import { UserPermissions } from "src/entities/UserPermissions";
import { Module as AppModule } from "src/entities/Module";
import { Action } from "src/entities/Action";
import { StaffCategoryTypesService } from "src/services/staff-category-types.service";
import { StaffCategoryTypesController } from "src/controllers/staff-category-types.controller";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailCreateService } from "../../services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { SSEModule } from "../sse/sse.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StaffCategoryType,
      UserAuditTrail,
      UserPermissions,
      AppModule,
      Action,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [StaffCategoryTypesController],
  providers: [
    StaffCategoryTypesService,
    UserAuditTrailCreateService,
    ResponseMapperService,
  ],
  exports: [StaffCategoryTypesService],
})
export class StaffCategoryTypesModule {}
