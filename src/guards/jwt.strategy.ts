import { ExtractJwt, Strategy } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../entities/User";
import { UserLoginSession } from "../entities/UserLoginSession";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserLoginSession)
    private sessionRepository: Repository<UserLoginSession>,
    private configService: ConfigService,
  ) {
    super({
      // jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme("Bearer_c+gi"),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_SECRET") || "secret-key",
    });
  }
  async validate(payload: any) {
    const user = await this.userRepository.findOne({
      where: { id: payload.id },
      relations: ["role", "status"],
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    if (user.status_id !== 1) {
      throw new UnauthorizedException("User account is inactive");
    }

    // Check session if session_id is provided in payload
    if (payload.session_id) {
      const session = await this.sessionRepository.findOne({
        where: { id: payload.session_id },
      });

      if (!session) {
        throw new UnauthorizedException("Session not found");
      }

      if (!session.is_active || session.is_logout) {
        throw new UnauthorizedException("Session has expired or is inactive");
      }

      // Update last activity for session
      await this.sessionRepository.update(session.id, {
        modified_at: new Date(),
      });
      return {
        id: user.id,
        user_name: user.user_name,
        role_id: user.role_id,
        status_id: user.status_id,
        role: user.role,
        session_id: session.id,
        current_access_key: payload.current_access_key,
      };
    }
    return {
      id: user.id,
      user_name: user.user_name,
      role_id: user.role_id,
      status_id: user.status_id,
      role: user.role,
      current_access_key: payload.current_access_key,
    };
  }
}
