import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailCreateService } from "../../services/user-audit-trail-create.service";
import { UserAuditTrail } from "../../entities/UserAuditTrail";
import { UserPermissions } from "../../entities/UserPermissions";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "../../entities/Action";
import { Location } from "../../entities/Location";
import { CategoryType } from "../../entities/CategoryType";
import { CategoryTypesController } from "../../controllers/category-types.controller";
import { CategoryTypesService } from "../../services/category-types.service";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { SSEModule } from "../sse/sse.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CategoryType,
      UserAuditTrail,
      UserPermissions,
      AppModule,
      Action,
      Location,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [CategoryTypesController],
  providers: [
    CategoryTypesService,
    UserAuditTrailCreateService,
    ResponseMapperService,
  ],
  exports: [CategoryTypesService],
})
export class CategoryTypesModule {}
