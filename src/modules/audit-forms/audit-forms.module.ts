import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditFormsController } from "./controllers/audit-forms.controller";
import { AuditFormService } from "./services/audit-forms.service";
import { AuditForm } from "../../entities/AuditForm";
import { UsersModule } from "../users/users.module";
import { UserPermissions } from "src/entities/UserPermissions";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "src/entities/Action";
import { Location } from "src/entities/Location";
import { SSEModule } from "../sse/sse.module";
import { ResponseMapperService } from "../../services/response-mapper.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditForm,
      UserPermissions,
      AppModule,
      Action,
      Location,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [AuditFormsController],
  providers: [AuditFormService,
        ResponseMapperService,
  ],
  exports: [AuditFormService],
})
export class AuditFormsModule {}
