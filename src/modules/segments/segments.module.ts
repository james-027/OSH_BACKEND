import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SegmentsController } from "./controllers/segments.controller";
import { SegmentsService } from "./services/segments.service";
import { Segment } from "../../entities/Segment";
import { UsersModule } from "../users/users.module";
import { UserPermissions } from "src/entities/UserPermissions";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "src/entities/Action";
import { Location } from "src/entities/Location";
import { UserAuditTrailCreateService } from "../users/services/user-audit-trail-create.service";
import { UserAuditTrail } from "../../entities/UserAuditTrail";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { SSEModule } from "../sse/sse.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Segment,
      UserPermissions,
      AppModule,
      Action,
      Location,
      UserAuditTrail,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [SegmentsController],
  providers: [
    SegmentsService,
    UserAuditTrailCreateService,
    ResponseMapperService,
  ],
  exports: [SegmentsService],
})
export class SegmentsModule {}
