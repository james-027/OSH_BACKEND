import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ActionsController } from "./controllers/actions.controller";
import { ActionLogsController } from "./controllers/action-logs.controller";
import { ActionsService } from "./services/actions.service";
import { ActionLogsService } from "./services/action-logs.service";
import { Action } from "../../entities/Action";
import { ActionLog } from "../../entities/ActionLog";

@Module({
  imports: [TypeOrmModule.forFeature([Action, ActionLog])],
  controllers: [ActionsController, ActionLogsController],
  providers: [ActionsService, ActionLogsService],
  exports: [ActionsService, ActionLogsService],
})
export class ActionsModule {}
