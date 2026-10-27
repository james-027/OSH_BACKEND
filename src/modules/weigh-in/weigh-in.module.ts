import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { WeighIn_header } from "../../entities/WeighInHeader";
import { WeighInLine } from "../../entities/WeighInItems";
import { WeighInController } from "./controllers/weigh-in.controller";
import { WeighInService } from "./services/weigh-in.service";
import { UsersModule } from "../users/users.module";
import { UserPermissions } from "src/entities/UserPermissions";
import { SSEModule } from "../sse/sse.module";
import { Action } from "../../entities/Action";
import { Module as AppModule } from "../../entities/Module";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { CommonUtilitiesService } from "../../services/common-utilities.service";
import { TransactionSequence } from "../../entities/TransactionSequence";
import { ActionLogsService } from "src/modules/actions/services/action-logs.service";
import { ActionLog } from "src/entities/ActionLog";
import { TransactionAttachment } from "src/entities/TransactionAttachment";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WeighIn_header,
      WeighInLine,
      UserPermissions,
      AppModule,
      Action,
      TransactionSequence,
      ActionLog,
      TransactionAttachment,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [WeighInController],
  providers: [
    WeighInService,
    CommonUtilitiesService,
    ResponseMapperService,
    ActionLogsService,
  ],
  exports: [WeighInService],
})
export class WeighInModule {}