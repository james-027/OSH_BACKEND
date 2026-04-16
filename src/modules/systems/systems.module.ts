import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "../users/users.module";
import { SSEModule } from "../sse/sse.module";
import { UserAuditTrailCreateService } from "../users/services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { System } from "../../entities/System";
import { SystemAccessKey } from "../../entities/SystemAccessKey";
import { AccessKey } from "../../entities/AccessKey";
import { Status } from "../../entities/Status";
import { User } from "../../entities/User";
import { UserAuditTrail } from "../../entities/UserAuditTrail";
import { UserPermissions } from "../../entities/UserPermissions";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "../../entities/Action";
import { SystemsController } from "./controllers/systems.controller";
import { SystemsService } from "./services/systems.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      System,
      SystemAccessKey,
      AccessKey,
      Status,
      User,
      UserAuditTrail,
      UserPermissions,
      AppModule,
      Action,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [SystemsController],
  providers: [
    SystemsService,
    UserAuditTrailCreateService,
    ResponseMapperService,
  ],
  exports: [SystemsService],
})
export class SystemsModule {}
