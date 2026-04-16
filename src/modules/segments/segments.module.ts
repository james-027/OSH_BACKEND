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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Segment,
      UserPermissions,
      AppModule,
      Action,
      Location,
    ]),
    UsersModule,
  ],
  controllers: [SegmentsController],
  providers: [SegmentsService],
  exports: [SegmentsService],
})
export class SegmentsModule {}
