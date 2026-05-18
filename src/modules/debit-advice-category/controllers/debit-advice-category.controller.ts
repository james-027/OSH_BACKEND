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
  UseGuards,
} from "@nestjs/common";
import { DebitAdviceCategoryService } from "../services/debit-advice-category.service";
import { CreateDebitAdviceCategoryDto } from "../dto/CreateDebitAdviceCatdto";
import { UpdateDebitAdviceCategoryDto } from "../dto/UpdateDebitAdviceCatDto";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";

@Controller("debit-advice-category")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DebitAdviceCategoryController {
  constructor(
    private readonly debitAdviceCategoryService: DebitAdviceCategoryService,
  ) { }

  @Get()
  async findAll(@Request() req) {
    return this.debitAdviceCategoryService.findAll();
  }

  @Get(":id")
  async findOne(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.debitAdviceCategoryService.findOne(id);
  }

  @Post()
  async create(
    @Body() createDebitAdviceCategoryDto: CreateDebitAdviceCategoryDto,
    @Request() req,
  ) {
    const userId = 3;

    return this.debitAdviceCategoryService.create(
      createDebitAdviceCategoryDto,
      userId,
    );
  }

  @Put(":id")
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDebitAdviceCategoryDto: UpdateDebitAdviceCategoryDto,
    @Request() req,
  ) {
    const userId = 3;

    return this.debitAdviceCategoryService.update(
      id,
      updateDebitAdviceCategoryDto,
      userId,
    );
  }

  @Delete(":id")
  async delete(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = 3;

    return this.debitAdviceCategoryService.delete(id, userId);
  }
}