import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { User } from "src/entities/User";
import { UserLoginSession } from "src/entities/UserLoginSession";
import { LoginUserDto } from "src/modules/auth/dto/LoginUserDto";
import { RefreshTokenDto } from "src/modules/auth/dto/RefreshTokenDto";
import { SessionTokenResponse } from "src/modules/auth/dto/SessionTokenResponse";
import { CreateSessionDto } from "src/modules/auth/dto/CreateSessionDto";
import { UserSessionService } from "src/modules/users/services/user-session.service";
import { UserAuditTrailCreateService } from "src/modules/users/services/user-audit-trail-create.service";
import logger from "@config/logger";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private userSessionService: UserSessionService,
    private jwtService: JwtService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
  ) {}

  async validateUser(
    user_name: string,
    password: string,
    email: string,
  ): Promise<any> {
    try {
      let user: User | null = null;
      if (email) {
        user = await this.userRepository.findOne({
          where: { email },
          relations: [
            "role",
            "userUpline",
            "status",
            "theme",
            "createdBy",
            "updatedBy",
          ],
        });
      } else if (user_name) {
        user = await this.userRepository.findOne({
          where: { user_name },
          relations: [
            "role",
            "userUpline",
            "status",
            "theme",
            "createdBy",
            "updatedBy",
          ],
        });
      }

      if (!user) {
        logger.warn(`Login attempt with non-existent username: ${user_name}`);
        throw new UnauthorizedException("Invalid credentials");
      }

      if (user.status_id !== 1) {
        logger.warn(`Login attempt by inactive user: ${user_name}`);
        throw new UnauthorizedException("Account is inactive");
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        logger.warn(`Invalid password attempt for user: ${user_name}`);
        throw new UnauthorizedException("Invalid credentials");
      }

      // Remove password from user object
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      logger.error("Error during user validation:", error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Authentication failed");
    }
  }
  async login(
    loginDto: LoginUserDto,
    sessionInfo?: CreateSessionDto,
  ): Promise<SessionTokenResponse> {
    try {
      const user = await this.validateUser(
        loginDto.user_name,
        loginDto.password,
        loginDto.email,
      );

      // Create new session
      const session = await this.userSessionService.createSession(
        user.id,
        sessionInfo || {},
      );
      const payload = {
        id: user.id,
        user_name: user.user_name,
        role_id: user.role_id,
        status_id: user.status_id,
        current_access_key: user.current_access_key,
        session_id: session.id, // Include session ID in JWT payload
      };

      // Generate access token with 10 minute expiry
      const access_token = this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN || "10m",
      });

      // Generate refresh token
      const refresh_token = this.generateRefreshToken();
      const refresh_token_expires_at = new Date();
      refresh_token_expires_at.setDate(refresh_token_expires_at.getDate() + 7); // 7 days

      // Update session with refresh token
      await this.userSessionService.updateSessionRefreshToken(
        session.id,
        refresh_token,
        refresh_token_expires_at,
      );

      logger.info(
        `User ${user.user_name} logged in successfully with session ${session.id}`,
      );

      await this.userAuditTrailCreateService.create(
        {
          service: "AuthService",
          method: "login",
          raw_data: JSON.stringify({
            email: loginDto.email,
            user_name: loginDto.user_name,
          }),
          description: `Login successfully ${loginDto.email} with session ${session.id})`,
          status_id: 1,
        },
        user.id,
      );

      return {
        access_token: access_token,
        refresh_token: refresh_token,
        user: {
          id: user.id,
          user_name: user.user_name,
          first_name: user.first_name,
          last_name: user.last_name,
          role_id: user.role_id,
          role_name: user.role?.role_name || null,
          user_reset: user.user_reset,
        },
        session: {
          id: session.id,
          device_info: session.device_info,
          ip_address: session.ip_address,
          last_login: session.last_login,
        },
      };
    } catch (error) {
      logger.error("Login error:", error);
      throw error;
    }
  }
  async logout(sessionId: number): Promise<{ message: string }> {
    try {
      await this.userSessionService.logoutSession(sessionId);

      logger.info(`Session ${sessionId} logged out successfully`);
      return { message: "Logged out successfully" };
    } catch (error) {
      logger.error("Logout error:", error);
      throw new Error("Failed to logout");
    }
  }

  async logoutAllSessions(userId: number): Promise<{ message: string }> {
    try {
      await this.userSessionService.logoutAllUserSessions(userId);

      logger.info(`All sessions logged out for user ID ${userId}`);
      return { message: "All sessions logged out successfully" };
    } catch (error) {
      logger.error("Logout all sessions error:", error);
      throw new Error("Failed to logout all sessions");
    }
  }
  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<{
    access_token: string;
    refresh_token: string;
    session: {
      id: number;
      last_login: Date | null;
    };
  }> {
    try {
      const { refresh_token } = refreshTokenDto;

      // Find session with this refresh token
      const session =
        await this.userSessionService.findSessionByRefreshToken(refresh_token);

      if (!session) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      // Check if refresh token is expired
      if (
        !session.refresh_token_expires_at ||
        session.refresh_token_expires_at < new Date()
      ) {
        throw new UnauthorizedException("Refresh token expired");
      }

      // Check if user is active
      if (session.user.status_id !== 1) {
        throw new UnauthorizedException("User account is inactive");
      }

      // Check if session is active
      if (!session.is_active || session.is_logout) {
        throw new UnauthorizedException("Session is inactive");
      } // Generate new access token
      const payload = {
        id: session.user.id,
        user_name: session.user.user_name,
        role_id: session.user.role_id,
        status_id: session.user.status_id,
        current_access_key: session.user.current_access_key,
        session_id: session.id,
      };

      const access_token = this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN || "10m",
      });

      // Generate new refresh token
      const new_refresh_token = this.generateRefreshToken();
      const refresh_token_expires_at = new Date();
      refresh_token_expires_at.setDate(refresh_token_expires_at.getDate() + 7); // 7 days

      // Update session with new refresh token
      await this.userSessionService.updateSessionRefreshToken(
        session.id,
        new_refresh_token,
        refresh_token_expires_at,
      );

      logger.info(
        `Refresh token used successfully for user ${session.user.user_name}, session ${session.id}`,
      );

      return {
        access_token: access_token,
        refresh_token: new_refresh_token,
        session: {
          id: session.id,
          last_login: session.last_login,
        },
      };
    } catch (error) {
      logger.error("Refresh token error:", error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Failed to refresh token");
    }
  }
  private generateRefreshToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  async invalidateRefreshToken(sessionId: number): Promise<void> {
    try {
      await this.userSessionService.deactivateSession(sessionId);
      logger.info(`Refresh token invalidated for session ID ${sessionId}`);
    } catch (error) {
      logger.error("Error invalidating refresh token:", error);
      throw new Error("Failed to invalidate refresh token");
    }
  }

  async getUserActiveSessions(userId: number): Promise<UserLoginSession[]> {
    try {
      return await this.userSessionService.findActiveSessionsByUserId(userId);
    } catch (error) {
      logger.error(`Error getting active sessions for user ${userId}:`, error);
      throw new Error("Failed to get active sessions");
    }
  }
}
