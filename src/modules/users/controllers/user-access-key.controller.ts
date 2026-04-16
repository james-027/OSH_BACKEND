import {
  Controller,
  Put,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
} from "@nestjs/common";
import { UserAccessKeyService } from "../services/user-access-key.service";
import { ChangeAccessKeyDto } from "../dto/ChangeAccessKeyDto";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UserAccessKeyController {
  constructor(private readonly userAccessKeyService: UserAccessKeyService) {}
  @Put(":user_id/change-access-key")
  async changeAccessKey(
    @Param("user_id", ParseIntPipe) user_id: number,
    @Body() changeAccessKeyDto: ChangeAccessKeyDto,
    @Request() req,
  ) {
    return this.userAccessKeyService.changeAccessKey(
      user_id,
      changeAccessKeyDto,
      req.user.id,
      req.user.session_id, // Pass the current session ID
    );
  }

  @Get(":user_id/current-access-key")
  async getCurrentAccessKey(@Param("user_id", ParseIntPipe) user_id: number) {
    return this.userAccessKeyService.getCurrentAccessKey(user_id);
  }

  @Get(":user_id/available-access-keys")
  async getAvailableAccessKeys(
    @Param("user_id", ParseIntPipe) user_id: number,
  ) {
    return this.userAccessKeyService.getUserAvailableAccessKeys(user_id);
  }
}
