import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Param,
  ParseIntPipe,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "../services/auth.service";
import { LoginUserDto } from "src/modules/auth/dto/LoginUserDto";
import { RefreshTokenDto } from "src/modules/auth/dto/RefreshTokenDto";
import { CreateSessionDto } from "src/modules/auth/dto/CreateSessionDto";
import { JwtAuthGuard } from "src/guards/jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post("login")
  async login(@Body() loginDto: LoginUserDto, @Request() req) {
    // Extract session info from request
    const sessionInfo: CreateSessionDto = {
      ip_address: req.ip || req.connection?.remoteAddress,
      user_agent: req.headers?.["user-agent"] || "Unknown",
      device_info: req.headers?.["user-agent"] || "Unknown", // You can enhance this to parse device info
    };

    return this.authService.login(loginDto, sessionInfo);
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  async logout(@Request() req) {
    // Use session_id from JWT payload if available, otherwise logout all sessions
    if (req.user.session_id) {
      return this.authService.logout(req.user.session_id);
    } else {
      return this.authService.logoutAllSessions(req.user.id);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout-all")
  async logoutAllSessions(@Request() req) {
    return this.authService.logoutAllSessions(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout-session/:sessionId")
  async logoutSpecificSession(
    @Param("sessionId", ParseIntPipe) sessionId: number,
    @Request() req,
  ) {
    // Additional security: verify the session belongs to the authenticated user
    const sessions = await this.authService.getUserActiveSessions(req.user.id);
    const sessionExists = sessions.some((session) => session.id === sessionId);

    if (!sessionExists) {
      throw new Error("Session not found or does not belong to user");
    }

    return this.authService.logout(sessionId);
  }

  @Throttle({ default: { limit: 2000, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post("refresh-token")
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }
  @UseGuards(JwtAuthGuard)
  @Get("sessions")
  async getActiveSessions(@Request() req) {
    return this.authService.getUserActiveSessions(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("profile")
  getProfile(@Request() req) {
    return req.user;
  }
}
