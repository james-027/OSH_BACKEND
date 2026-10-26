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

import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "../../../decorators/permissions.decorator";

import { CustomerService } from "../services/customer.service";

import { CreateCustomerDto } from "../dto/CreateCustomerDto";
import { UpdateCustomerDto } from "../dto/UpdateCustomerDto";

@Controller("customers")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @RequirePermissions({
    module: ["CUSTOMERS", "DEBIT ADVICE", "FINANCE CONFIRMATION"],
    action: "DATA ACCESS",
  })
  async findAll(@Request() req) {
    return this.customerService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "CUSTOMERS", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.customerService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "CUSTOMERS", action: "ADD" })
  async create(@Body() createCustomerDto: CreateCustomerDto, @Request() req) {
    const userId = req.user.id;

    return this.customerService.create(createCustomerDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "CUSTOMERS", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateCustomerDto: UpdateCustomerDto,
    @Request() req,
  ) {
    const userId = req.user.id;

    return this.customerService.update(id, updateCustomerDto, userId);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({
    module: "CUSTOMERS",
    action: "ACTIVATE",
  })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;

    return this.customerService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({
    module: "CUSTOMERS",
    action: "DEACTIVATE",
  })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;

    return this.customerService.toggleStatus(id, userId);
  }
}