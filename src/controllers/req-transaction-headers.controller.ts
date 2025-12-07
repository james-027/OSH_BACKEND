import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Patch,
  UseGuards,
  Request,
  ParseIntPipe,
} from "@nestjs/common";
import { ReqTransactionHeadersService } from "../services/req-transaction-headers.service";
import { CreateReqTransactionHeaderDto } from "../dto/CreateReqTransactionHeaderDto";
import { UpdateReqTransactionHeaderDto } from "../dto/UpdateReqTransactionHeaderDto";
import { CreateReqTransactionWithDetailsDto } from "../dto/CreateReqTransactionWithDetailsDto";
import { JwtAuthGuard } from "src/guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";

@Controller("req-transaction-headers")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReqTransactionHeadersController {
  constructor(
    private readonly reqTransactionHeadersService: ReqTransactionHeadersService
  ) {}

  @Get()
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "VIEW" })
  async findAll() {
    return await this.reqTransactionHeadersService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "VIEW" })
  async findOne(@Param("id") id: number) {
    return await this.reqTransactionHeadersService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "ADD" })
  async create(
    @Body() createDto: CreateReqTransactionHeaderDto,
    @Request() req
  ) {
    const userId = req.user?.id || 1;
    return await this.reqTransactionHeadersService.create(createDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "EDIT" })
  async update(
    @Param("id") id: number,
    @Body() updateDto: UpdateReqTransactionHeaderDto,
    @Request() req
  ) {
    const userId = req.user?.id || 1;
    return await this.reqTransactionHeadersService.update(
      id,
      updateDto,
      userId
    );
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.reqTransactionHeadersService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.reqTransactionHeadersService.toggleStatus(id, userId);
  }

  @Post("batch-create")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "ADD" })
  async createWithDetails(
    @Body() createDto: CreateReqTransactionWithDetailsDto,
    @Request() req
  ) {
    const userId = req.user?.id || 1;
    const accessKeyId = req.user.current_access_key;
    return await this.reqTransactionHeadersService.createWithDetails(
      createDto,
      userId,
      accessKeyId
    );
  }
}
