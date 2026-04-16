import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Put,
} from "@nestjs/common";
import { AccessKeysService } from "../services/access-keys.service";
import { UpdateAccessKeyDto } from "../dto/UpdateAccessKeyDto";
import { CreateAccessKeyDto } from "../dto/CreateAccessKeyDto";
import { JwtAuthGuard } from "@guards/jwt-auth.guard";
import { PermissionsGuard } from "@guards/permissions.guard";
import { RequirePermissions } from "@decorators/permissions.decorator";

@Controller("access-keys")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AccessKeysController {
  constructor(private readonly accessKeysService: AccessKeysService) {}

  @Get()
  @RequirePermissions({ module: "ACCESS KEYS", action: "DATA ACCESS" })
  async findAll() {
    return this.accessKeysService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "ACCESS KEYS", action: "VIEW" })
  async findOne(@Param("id") id: string) {
    return this.accessKeysService.findOne(+id);
  }

  @Post()
  @RequirePermissions({ module: "ACCESS KEYS", action: "ADD" })
  async create(
    @Body() createAccessKeyDto: CreateAccessKeyDto,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    return this.accessKeysService.create(createAccessKeyDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "ACCESS KEYS", action: "EDIT" })
  async update(
    @Param("id") id: string,
    @Body() updateAccessKeyDto: UpdateAccessKeyDto,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    return this.accessKeysService.update(+id, updateAccessKeyDto, userId);
  }

  @Delete(":id")
  @RequirePermissions({ module: "ACCESS KEYS", action: "DELETE" })
  async remove(@Param("id") id: string) {
    return this.accessKeysService.remove(+id);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "ACCESS KEYS", action: "ACTIVATE" })
  async toggleStatusActivate(@Param("id") id: string, @Request() req: any) {
    const userId = req.user.id;
    return this.accessKeysService.toggleStatus(+id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "ACCESS KEYS", action: "DEACTIVATE" })
  async toggleStatusDeactivate(@Param("id") id: string, @Request() req: any) {
    const userId = req.user.id;
    return this.accessKeysService.toggleStatus(+id, userId);
  }
}
