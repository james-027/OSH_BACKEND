import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthController } from "./controllers/auth.controller";
import { AuthService } from "./services/auth.service";
import { User } from "../../entities/User";
import { Role } from "../../entities/Role";
import { UserLoginSession } from "../../entities/UserLoginSession";
import { UsersModule } from "../users/users.module";
import { JwtService } from "@nestjs/jwt";
import { EmailService } from "../../services/email.service";
import { FrontendUrlUtil } from "../../utils/frontend-url.util";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, UserLoginSession]),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtService, EmailService, FrontendUrlUtil],
  exports: [AuthService],
})
export class AuthModule {}
