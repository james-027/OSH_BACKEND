import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Patch,
  Request,
} from "@nestjs/common";
import { ReqTransactionDuesService } from "../services/req-transaction-dues.service";
import { CreateReqTransactionDueDto } from "../dto/CreateReqTransactionDueDto";
import { UpdateReqTransactionDueDto } from "../dto/UpdateReqTransactionDueDto";

@Controller("req-transaction-dues")
export class ReqTransactionDuesController {
  constructor(
    private readonly reqTransactionDuesService: ReqTransactionDuesService,
  ) {}

  @Get()
  async findAll() {
    return await this.reqTransactionDuesService.findAll();
  }

  @Get(":id")
  async findOne(@Param("id") id: number) {
    return await this.reqTransactionDuesService.findOne(id);
  }

  @Post()
  async create(@Body() createDto: CreateReqTransactionDueDto, @Request() req) {
    const userId = req.user?.id || 1;
    return await this.reqTransactionDuesService.create(createDto, userId);
  }

  @Put(":id")
  async update(
    @Param("id") id: number,
    @Body() updateDto: UpdateReqTransactionDueDto,
    @Request() req,
  ) {
    const userId = req.user?.id || 1;
    return await this.reqTransactionDuesService.update(id, updateDto, userId);
  }

  @Patch(":id/toggle-status")
  async toggleStatus(@Param("id") id: number, @Request() req) {
    const userId = req.user?.id || 1;
    return await this.reqTransactionDuesService.toggleStatus(id, userId);
  }
}
