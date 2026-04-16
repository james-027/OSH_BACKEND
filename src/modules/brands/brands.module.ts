import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Brand } from "src/entities/Brand";
import { BrandsService } from "./services/brands.service";
import { BrandsController } from "src/modules/brands/controllers/brands.controller";
import { UsersService } from "src/modules/users/services/users.service";
import { User } from "src/entities/User";
import { Status } from "src/entities/Status";
import { Role } from "src/entities/Role";
import { Theme } from "src/entities/Theme";
import { UserPermissions } from "src/entities/UserPermissions";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Brand,
      User,
      Status,
      Role,
      Theme,
      UserPermissions,
    ]),
  ],
  providers: [BrandsService, UsersService],
  controllers: [BrandsController],
  exports: [BrandsService],
})
export class BrandsModule {}
