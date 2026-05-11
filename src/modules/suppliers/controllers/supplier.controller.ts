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

import { SupplierService } from "../services/supplier.service";

import { CreateSupplierDto } from "../dto/CreateSupplierDto";
import { UpdateSupplierDto } from "../dto/UpdateSupplierDto";

@Controller("suppliers")
// @UseGuards(JwtAuthGuard)
export class SupplierController {
  constructor(
    private readonly supplierService: SupplierService,
  ) {}

  @Get()
  async findAll(@Request() req) {
    return this.supplierService.findAll();
  }

  @Get(":id")
  async findOne(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.supplierService.findOne(id);
  }

  @Post()
  async create(
    @Body() createSupplierDto: CreateSupplierDto,
    @Request() req,
  ) {
    const userId = 3;

    return this.supplierService.create(
      createSupplierDto,
      userId,
    );
  }

  @Put(":id")
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateSupplierDto: UpdateSupplierDto,
    @Request() req,
  ) {
    const userId = 3;

    return this.supplierService.update(
      id,
      updateSupplierDto,
      userId,
    );
  }

  @Delete(":id")
  async delete(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = 3;

    return this.supplierService.delete(id, userId);
  }
}