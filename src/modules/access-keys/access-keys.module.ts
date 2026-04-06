import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccessKeysController } from "../../controllers/access-keys.controller";
import { AccessKeysService } from "../../services/access-keys.service";
import { AccessKey } from "../../entities/AccessKey";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailCreateService } from "src/services/user-audit-trail-create.service";
import { UserAuditTrail } from "src/entities/UserAuditTrail";
import { UserPermissions } from "src/entities/UserPermissions";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "src/entities/Action";
import { SSEModule } from "../sse/sse.module";
import { CacheInvalidationModule } from "../cache/cache.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccessKey,
      UserAuditTrail,
      UserPermissions,
      AppModule,
      Action,
    ]),
    UsersModule,
    SSEModule,
    CacheInvalidationModule,
  ],
  controllers: [AccessKeysController],
  providers: [AccessKeysService, UserAuditTrailCreateService],
  exports: [AccessKeysService],
})
export class AccessKeysModule {}
