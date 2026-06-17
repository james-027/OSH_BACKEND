import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Request,
  ParseIntPipe,
  UseGuards,
} from "@nestjs/common";

import { GlAccountsService } from "../services/gl-accounts.service";
import { CreateGlAccountDto } from "../dto/CreateGlAccountDto";
import { UpdateGlAccountDto } from "../dto/UpdateGlAccountsDto";

import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "../../../decorators/permissions.decorator";

@Controller("gl-accounts")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GlAccountsController {
  constructor(private readonly GlAccountsService: GlAccountsService) { }

  @Get()
  @RequirePermissions({
    module: [
      "GL ACCOUNTS MASTERDATA",
      "DEBIT ADVICE MASTERDATA",
      "DEBIT ADVICE",
      "FINANCE CONFIRMATION",
    ],
    action: "VIEW",
  })
  async findAll(@Request() req) {
    return this.GlAccountsService.findAll();
  }

  @Get(":id")
  @RequirePermissions({
    module: [
      "GL ACCOUNTS MASTERDATA",
      "DEBIT ADVICE MASTERDATA",
      "DEBIT ADVICE",
      "FINANCE CONFIRMATION",
    ],
    action: "VIEW",
  })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.GlAccountsService.findOne(id);
  }

  @Post()
  @RequirePermissions({
    module: [
      "GL ACCOUNTS MASTERDATA",
      "DEBIT ADVICE MASTERDATA",
      "DEBIT ADVICE",
      "FINANCE CONFIRMATION",
    ],
    action: "ADD",
  })
  async create(@Body() createGlAccountDto: CreateGlAccountDto, @Request() req) {
    const userId = req.user.id;

    return this.GlAccountsService.create(createGlAccountDto, userId);
  }

  @Put(":id")
  @RequirePermissions({
    module: [
      "GL ACCOUNTS MASTERDATA",
      "DEBIT ADVICE MASTERDATA",
      "DEBIT ADVICE",
      "FINANCE CONFIRMATION",
    ],
    action: "EDIT",
  })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateGlAccountDto: UpdateGlAccountDto,
    @Request() req,
  ) {
    const userId = req.user.id;

    return this.GlAccountsService.update(id, updateGlAccountDto, userId);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({
    module: [
      "GL ACCOUNTS MASTERDATA",
      "DEBIT ADVICE MASTERDATA",
      "DEBIT ADVICE",
      "FINANCE CONFIRMATION",
    ],
    action: "ACTIVATE",
  })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;

    return this.GlAccountsService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({
    module: [
      "GL ACCOUNTS MASTERDATA",
      "DEBIT ADVICE MASTERDATA",
      "DEBIT ADVICE",
      "FINANCE CONFIRMATION",
    ],
    action: "DEACTIVATE",
  })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;

    return this.GlAccountsService.toggleStatus(id, userId);
  }
}
