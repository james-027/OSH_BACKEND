import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailCreateService } from "../../services/user-audit-trail-create.service";
import { UserAuditTrail } from "../../entities/UserAuditTrail";
import { UserPermissions } from "../../entities/UserPermissions";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "../../entities/Action";
// import { Location } from "../../entities/Location";
import { RenewalType } from "../../entities/RenewalType";
import { RenewalTypesController } from "../../controllers/renewal-types.controller";
import { RenewalTypesService } from "../../services/renewal-types.service";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { SSEModule } from "../sse/sse.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RenewalType,
      UserAuditTrail,
      UserPermissions,
      AppModule,
      Action,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [RenewalTypesController],
  providers: [
    RenewalTypesService,
    UserAuditTrailCreateService,
    ResponseMapperService,
  ],
  exports: [RenewalTypesService],
})
export class RenewalTypesModule {}
