import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CrewHubSystem } from "src/entities/CrewHubSystem";
import { LearningMaterial } from "src/entities/LearningMaterial";
import { LearningMaterialType } from "src/entities/LearningMaterialType";
import { CrewHubController } from "./controllers/crew-hub.controller";
import { CrewHubService } from "./services/crew-hub.service";
import { CacheInvalidationModule } from "../cache/cache.module";
import { SSEModule } from "../sse/sse.module";
import { UserAuditTrailModule } from "../users/user-audit-trail.module";
import { UserPermissions } from "src/entities/UserPermissions";
import { Module as ModuleEntity } from "../../entities/Module";
import { Action } from "src/entities/Action";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CrewHubSystem,
      LearningMaterial,
      LearningMaterialType,
      UserPermissions,
      ModuleEntity,
      Action,
    ]),
    CacheInvalidationModule,
    SSEModule,
    UserAuditTrailModule,
  ],
  controllers: [CrewHubController],
  providers: [CrewHubService],
  exports: [CrewHubService],
})
export class CrewHubModule {}
