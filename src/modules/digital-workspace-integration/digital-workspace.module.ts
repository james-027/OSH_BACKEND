import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { TypeOrmModule } from "@nestjs/typeorm";

import { DigitalWorkspaceController } from './controllers/digital-workspace.controller';
import { DigitalWorkspaceService } from './services/digital-workspace.service';
import { Staff } from "src/entities/Staff";
import { LogsType } from "src/entities/LogsType";


@Module({
  imports: [
    HttpModule,

    TypeOrmModule.forFeature([
      Staff,
      LogsType,
    ]),
  ],
  controllers: [
    DigitalWorkspaceController,
  ],
  providers: [
    DigitalWorkspaceService,
  ],
  exports: [
    DigitalWorkspaceService,
  ],
})
export class DigitalWorkspaceModule {}