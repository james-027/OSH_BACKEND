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
import { UserWarehousesService } from "../services/user-warehouses.service";
import { CreateUserWarehousesDto } from "../dto/CreateUserWarehousesDto";
import { UpdateUserWarehousesDto } from "../dto/UpdateUserWarehousesDto";

@Controller("user-warehouses")
@UseGuards(JwtAuthGuard)
export class UserWarehousesController {
  constructor(
    private readonly userWarehousesService: UserWarehousesService,
  ) {}

  @Get()
  async findAll(@Request() req) {
    const accessKeyId = req.query?.access_key_id
      ? parseInt(req.query.access_key_id, 10)
      : req.user?.current_access_key;
    return this.userWarehousesService.findAll(accessKeyId);
  }

  @Get("user/:userId/role/:roleId")
  async findByUserAndRole(
    @Param("userId", ParseIntPipe) userId: number,
    @Param("roleId", ParseIntPipe) roleId: number,
    @Request() req,
  ) {
    const accessKeyId = req.query?.access_key_id
      ? parseInt(req.query.access_key_id, 10)
      : req.user?.current_access_key;
    return this.userWarehousesService.findByUserAndRole(
      userId,
      roleId,
      accessKeyId,
    );
  }

  @Get(":id")
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.userWarehousesService.findOne(id);
  }

  @Post()
  async create(
    @Body() dto: CreateUserWarehousesDto,
    @Request() req,
  ) {
    const authUserId = req.user.id;
    return this.userWarehousesService.create(dto, authUserId);
  }

  @Patch(":id")
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateUserWarehousesDto,
    @Request() req,
  ) {
    const authUserId = req.user.id;
    return this.userWarehousesService.update(id, dto, authUserId);
  }

  @Patch(":id/deactivate")
  async deactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const authUserId = req.user.id;
    return this.userWarehousesService.deactivate(id, authUserId);
  }

  @Patch(":id/toggle-status")
  async toggleStatus(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const authUserId = req.user.id;
    return this.userWarehousesService.toggleStatus(id, authUserId);
  }

  /**
   * Delete route calls soft deactivation (status_id = 2) - NO HARD DELETE
   */
  @Delete(":id")
  async remove(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const authUserId = req.user.id;
    return this.userWarehousesService.deactivate(id, authUserId);
  }
}
