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

import { DebitAdviceGlAccountService } from "../services/debit-advice-glaccount.service";
import { CreateDebitAdviceGlAccountDto } from "../dto/CreateDebitAdviceGlDto";
import { UpdateDebitAdviceGlAccountDto } from "../dto/UpdateDebitAdviceGlDto";

import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "../../../decorators/permissions.decorator";

@Controller("debit-advice-gl-account")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DebitAdviceGlAccountController {
  constructor(
    private readonly debitAdviceGlAccountService: DebitAdviceGlAccountService,
  ) {}

  @Get()
  @RequirePermissions({ module: "DEBIT ADVICE MASTERDATA", action: "VIEW" })
  async findAll(@Request() req) {
    return this.debitAdviceGlAccountService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "DEBIT ADVICE MASTERDATA", action: "VIEW" })
  async findOne(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.debitAdviceGlAccountService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "DEBIT ADVICE MASTERDATA", action: "ADD" })
  async create(
    @Body() createDebitAdviceGlAccountDto: CreateDebitAdviceGlAccountDto,
    @Request() req,
  ) {
    const userId = req.user.id;

    return this.debitAdviceGlAccountService.create(
      createDebitAdviceGlAccountDto,
      userId,
    );
  }

  @Put(":id")
  @RequirePermissions({ module: "DEBIT ADVICE MASTERDATA", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDebitAdviceGlAccountDto: UpdateDebitAdviceGlAccountDto,
    @Request() req,
  ) {
    const userId = req.user.id;

    return this.debitAdviceGlAccountService.update(
      id,
      updateDebitAdviceGlAccountDto,
      userId,
    );
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({
    module: "DEBIT ADVICE MASTERDATA",
    action: "ACTIVATE",
  })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;

    return this.debitAdviceGlAccountService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({
    module: "DEBIT ADVICE MASTERDATA",
    action: "DEACTIVATE",
  })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;

    return this.debitAdviceGlAccountService.toggleStatus(id, userId);
  }
}