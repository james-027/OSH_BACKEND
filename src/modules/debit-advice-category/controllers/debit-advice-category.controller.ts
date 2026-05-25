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
import { DebitAdviceCategoryService } from "../services/debit-advice-category.service";
import { CreateDebitAdviceCategoryDto } from "../dto/CreateDebitAdviceCatdto";
import { UpdateDebitAdviceCategoryDto } from "../dto/UpdateDebitAdviceCatDto";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "../../../decorators/permissions.decorator";

@Controller("debit-advice-category")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DebitAdviceCategoryController {
  constructor(
    private readonly debitAdviceCategoryService: DebitAdviceCategoryService,
  ) { }

  @Get()
  @RequirePermissions({ module: ["DEBIT ADVICE MASTERDATA", "DEBIT ADVICE", "FINANCE CONFIRMATION"], action: "VIEW" })
  async findAll(@Request() req) {
    return this.debitAdviceCategoryService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "DEBIT ADVICE MASTERDATA", action: "VIEW" })
  async findOne(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.debitAdviceCategoryService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "DEBIT ADVICE MASTERDATA", action: "ADD" })
  async create(
    @Body() createDebitAdviceCategoryDto: CreateDebitAdviceCategoryDto,
    @Request() req,
  ) {
    const userId = req.user.id;

    return this.debitAdviceCategoryService.create(
      createDebitAdviceCategoryDto,
      userId,
    );
  }

  @Put(":id")
  @RequirePermissions({ module: "DEBIT ADVICE MASTERDATA", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDebitAdviceCategoryDto: UpdateDebitAdviceCategoryDto,
    @Request() req,
  ) {
    const userId = req.user.id;

    return this.debitAdviceCategoryService.update(
      id,
      updateDebitAdviceCategoryDto,
      userId,
    );
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "DEBIT ADVICE MASTERDATA",action: "ACTIVATE",})
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;

    return this.debitAdviceCategoryService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "DEBIT ADVICE MASTERDATA", action: "DEACTIVATE",})
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;

    return this.debitAdviceCategoryService.toggleStatus(id, userId);
  }
}