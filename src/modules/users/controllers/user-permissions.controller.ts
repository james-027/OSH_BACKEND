import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { UserPermissionsService } from "../services/user-permissions.service";

@Controller("user-permissions")
@UseGuards(JwtAuthGuard)
export class UserPermissionsController {
  constructor(
    private readonly userPermissionsService: UserPermissionsService,
  ) {}

  @Get()
  async findAll() {
    return this.userPermissionsService.findAll();
  }

  @Get(":id")
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.userPermissionsService.findOne(id);
  }

  @Post()
  async create(@Body() createUserPermissionsDto: any, @Request() req) {
    const userId = req.user.id;
    return this.userPermissionsService.create(createUserPermissionsDto, userId);
  }

  @Patch(":id")
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateUserPermissionsDto: any,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.userPermissionsService.update(
      id,
      updateUserPermissionsDto,
      userId,
    );
  }

  @Delete(":id")
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.userPermissionsService.remove(id);
  }

  @Patch(":id/toggle-status")
  async toggleStatus(@Param("id", ParseIntPipe) id: number, @Request() req) {
    const userId = req.user.id;
    return this.userPermissionsService.toggleStatus(id, userId);
  }
}
