import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SignatoryDetailService } from "./services/signatory-details.service";
import { SignatoryDetailController } from "src/modules/signatory-details/controllers/signatory-details.controller";
import { UsersService } from "src/modules/users/services/users.service";
import { User } from "src/entities/User";
import { Status } from "src/entities/Status";
import { Role } from "src/entities/Role";
import { Theme } from "src/entities/Theme";
import { UserPermissions } from "src/entities/UserPermissions";
import { SSEModule } from "../sse/sse.module";
import { UsersModule } from "../users/users.module";
import { Module as AppModule } from "src/entities/Module";
import { Action } from "src/entities/Action";
import { UserAuditTrailCreateService } from "../users/services/user-audit-trail-create.service";
import { UserAuditTrail } from "../../entities/UserAuditTrail";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { SignatoryHeader } from "src/entities/SignatoryHeader";
import { SignatoryType } from "src/entities/SignatoryTypes";
import { Position } from "src/entities/Position";
import { SignatoryDetail } from "src/entities/SignatoryDetails";



@Module({
  imports: [
    TypeOrmModule.forFeature([
      SignatoryHeader,
      SignatoryType,
      Position,
      SignatoryDetail,
      User,
      Status,
      Role,
      Theme,
      UserPermissions,
      AppModule,
      Action,
      UserAuditTrail,
    ]),
    UsersModule,
    SSEModule,
  ],
  providers: [
    SignatoryDetailService,
    UserAuditTrailCreateService,
    ResponseMapperService,
  ],
  controllers: [SignatoryDetailController],
  exports: [SignatoryDetailService],
})
export class SignatoryDetailModule {}
