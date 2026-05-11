import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
} from "@nestjs/common";

import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";

import { ProfitcenterService } from "../services/profitcenter.service";

import { CreateProfitcenterDto } from "../dto/CreateProfitcenterDto";
import { UpdateProfitcenterDto } from "../dto/UpdateProfitcenterDto";

@Controller("profitcenters")
// @UseGuards(JwtAuthGuard)
export class ProfitcenterController {
  constructor(
    private readonly profitcenterService: ProfitcenterService,
  ) {}

  @Get()
  async findAll(@Request() req) {
    return this.profitcenterService.findAll();
  }

  @Get(":id")
  async findOne(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.profitcenterService.findOne(id);
  }

  @Post()
  async create(
    @Body() createProfitcenterDto: CreateProfitcenterDto,
    @Request() req,
  ) {
    const userId = 3;

    return this.profitcenterService.create(
      createProfitcenterDto,
      userId,
    );
  }

  @Put(":id")
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateProfitcenterDto: UpdateProfitcenterDto,
    @Request() req,
  ) {
    const userId = 3;

    return this.profitcenterService.update(
      id,
      updateProfitcenterDto,
      userId,
    );
  }

  @Delete(":id")
  async delete(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = 3;

    return this.profitcenterService.delete(id, userId);
  }
}