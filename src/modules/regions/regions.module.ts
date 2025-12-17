import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RegionsController } from "../../controllers/regions.controller";
import { RegionsService } from "../../services/regions.service";
import { Region } from "../../entities/Region";
import { UsersModule } from "../users/users.module";
import { UserPermissions } from "src/entities/UserPermissions";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "src/entities/Action";
import { Location } from "src/entities/Location";
import { SSEModule } from "../sse/sse.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Region,
      UserPermissions,
      AppModule,
      Action,
      Location,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [RegionsController],
  providers: [RegionsService],
  exports: [RegionsService],
})
export class RegionsModule {}
