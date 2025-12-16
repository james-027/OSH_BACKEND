import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThemesController } from "../../controllers/themes.controller";
import { ThemesService } from "../../services/themes.service";
import { Theme } from "../../entities/Theme";
import { User } from "src/entities/User";
import { Status } from "src/entities/Status";
import { UserPermissions } from "src/entities/UserPermissions";
import { Module as AppModule } from "src/entities/Module";
import { Action } from "src/entities/Action";
import { UserAuditTrail } from "src/entities/UserAuditTrail";
import { UserAuditTrailCreateService } from "src/services/user-audit-trail-create.service";
import { UsersModule } from "../users/users.module";
import { SSEModule } from "../sse/sse.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Theme,
      User,
      Status,
      UserPermissions,
      AppModule,
      Action,
      UserAuditTrail,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [ThemesController],
  providers: [ThemesService, UserAuditTrailCreateService],
  exports: [ThemesService],
})
export class ThemesModule {}
