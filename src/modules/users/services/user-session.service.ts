import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserLoginSession } from "../../../entities/UserLoginSession";
import { User } from "../../../entities/User";
import { CreateSessionDto } from "../../auth/dto/CreateSessionDto";
import logger from "../../../config/logger";

@Injectable()
export class UserSessionService {
  constructor(
    @InjectRepository(UserLoginSession)
    private sessionRepository: Repository<UserLoginSession>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async createSession(
    userId: number,
    createSessionDto: CreateSessionDto,
  ): Promise<UserLoginSession> {
    try {
      // Validate user exists
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found.`);
      }

      const session = this.sessionRepository.create({
        user_id: userId,
        device_info: createSessionDto.device_info || null,
        ip_address: createSessionDto.ip_address || null,
        user_agent: createSessionDto.user_agent || null,
        last_login: new Date(),
        is_active: true,
        is_logout: false,
      });

      const savedSession = await this.sessionRepository.save(session);
      logger.info(
        `Session created successfully for user ID: ${userId}, session ID: ${savedSession.id}`,
      );

      return savedSession;
    } catch (error) {
      logger.error(`Error creating session for user ID ${userId}:`, error);
      throw error;
    }
  }

  async updateSessionRefreshToken(
    sessionId: number,
    refreshToken: string,
    expiresAt: Date,
  ): Promise<void> {
    try {
      await this.sessionRepository.update(
        { id: sessionId },
        {
          refresh_token: refreshToken,
          refresh_token_expires_at: expiresAt,
        },
      );

      logger.info(`Refresh token updated for session ID: ${sessionId}`);
    } catch (error) {
      logger.error(
        `Error updating refresh token for session ID ${sessionId}:`,
        error,
      );
      throw error;
    }
  }

  async findSessionByRefreshToken(
    refreshToken: string,
  ): Promise<UserLoginSession | null> {
    try {
      const session = await this.sessionRepository.findOne({
        where: {
          refresh_token: refreshToken,
          is_active: true,
        },
        relations: ["user"],
      });

      return session;
    } catch (error) {
      logger.error("Error finding session by refresh token:", error);
      throw error;
    }
  }

  async findActiveSessionsByUserId(
    userId: number,
  ): Promise<UserLoginSession[]> {
    try {
      const sessions = await this.sessionRepository.find({
        where: {
          user_id: userId,
          is_active: true,
          is_logout: false,
        },
        order: { last_login: "DESC" },
      });

      return sessions;
    } catch (error) {
      logger.error(
        `Error finding active sessions for user ID ${userId}:`,
        error,
      );
      throw error;
    }
  }

  async logoutSession(sessionId: number): Promise<void> {
    try {
      await this.sessionRepository.update(
        { id: sessionId },
        {
          is_logout: true,
          last_logout: new Date(),
          refresh_token: null,
          refresh_token_expires_at: null,
        },
      );

      logger.info(`Session ${sessionId} logged out successfully`);
    } catch (error) {
      logger.error(`Error logging out session ${sessionId}:`, error);
      throw error;
    }
  }

  async logoutAllUserSessions(userId: number): Promise<void> {
    try {
      await this.sessionRepository.update(
        { user_id: userId, is_active: true },
        {
          is_logout: true,
          last_logout: new Date(),
          refresh_token: null,
          refresh_token_expires_at: null,
        },
      );

      logger.info(`All sessions logged out for user ID: ${userId}`);
    } catch (error) {
      logger.error(
        `Error logging out all sessions for user ID ${userId}:`,
        error,
      );
      throw error;
    }
  }

  async invalidateExpiredTokens(): Promise<void> {
    try {
      const now = new Date();
      const result = await this.sessionRepository.update(
        {
          refresh_token_expires_at: { $lt: now } as any,
          is_active: true,
        },
        {
          refresh_token: null,
          refresh_token_expires_at: null,
          is_logout: true,
        },
      );

      logger.info(`Invalidated ${result.affected || 0} expired refresh tokens`);
    } catch (error) {
      logger.error("Error invalidating expired tokens:", error);
      throw error;
    }
  }

  async deactivateSession(sessionId: number): Promise<void> {
    try {
      await this.sessionRepository.update(
        { id: sessionId },
        {
          is_active: false,
          is_logout: true,
          last_logout: new Date(),
          refresh_token: null,
          refresh_token_expires_at: null,
        },
      );

      logger.info(`Session ${sessionId} deactivated successfully`);
    } catch (error) {
      logger.error(`Error deactivating session ${sessionId}:`, error);
      throw error;
    }
  }

  async getSessionById(sessionId: number): Promise<UserLoginSession | null> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId },
        relations: ["user"],
      });

      return session;
    } catch (error) {
      logger.error(`Error finding session by ID ${sessionId}:`, error);
      throw error;
    }
  }

  async updateLastActivity(sessionId: number): Promise<void> {
    try {
      await this.sessionRepository.update(
        { id: sessionId },
        {
          modified_at: new Date(),
        },
      );
    } catch (error) {
      logger.error(
        `Error updating last activity for session ${sessionId}:`,
        error,
      );
      // Don't throw error here as this is not critical
    }
  }
}
