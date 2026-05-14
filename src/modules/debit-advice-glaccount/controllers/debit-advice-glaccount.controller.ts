import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
  ParseIntPipe,
  UseGuards
} from "@nestjs/common";

import { DebitAdviceGlAccountService } from "../services/debit-advice-glaccount.service";
import { CreateDebitAdviceGlAccountDto } from "../dto/CreateDebitAdviceGlDto";
import { UpdateDebitAdviceGlAccountDto } from "../dto/UpdateDebitAdviceGlDto";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";

@Controller("debit-advice-gl-account")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DebitAdviceGlAccountController {
  constructor(
    private readonly debitAdviceGlAccountService: DebitAdviceGlAccountService,
  ) { }

  @Get()
  async findAll(@Request() req) {
    return this.debitAdviceGlAccountService.findAll();
  }

  @Get(":id")
  async findOne(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.debitAdviceGlAccountService.findOne(id);
  }

  @Post()
  async create(
    @Body() createDebitAdviceGlAccountDto: CreateDebitAdviceGlAccountDto,
    @Request() req,
  ) {
    const userId = 3;

    return this.debitAdviceGlAccountService.create(
      createDebitAdviceGlAccountDto,
      userId,
    );
  }

  @Put(":id")
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDebitAdviceGlAccountDto: UpdateDebitAdviceGlAccountDto,
    @Request() req,
  ) {
    const userId = 3;

    return this.debitAdviceGlAccountService.update(
      id,
      updateDebitAdviceGlAccountDto,
      userId,
    );
  }

  @Delete(":id")
  async delete(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = 3;

    return this.debitAdviceGlAccountService.delete(id, userId);
  }
}