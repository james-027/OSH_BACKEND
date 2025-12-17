import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ModulesController } from "../../controllers/modules.controller";
import { ModulesService } from "../../services/modules.service";
import { Module as ModuleEntity } from "../../entities/Module";
import { User } from "src/entities/User";
import { Status } from "src/entities/Status";
import { UsersModule } from "../users/users.module";
import { UserPermissions } from "src/entities/UserPermissions";
import { Action } from "src/entities/Action";
import { SSEModule } from "../sse/sse.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ModuleEntity,
      User,
      Status,
      UserPermissions,
      Action,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [ModulesController],
  providers: [ModulesService],
  exports: [ModulesService],
})
export class ModulesModule {}
