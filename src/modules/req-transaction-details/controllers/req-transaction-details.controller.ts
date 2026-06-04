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
import { ReqTransactionDetailsService } from "../services/req-transaction-details.service";
import { CreateReqTransactionDetailDto } from "../dto/CreateReqTransactionDetailDto";
import { UpdateReqTransactionDetailDto } from "../dto/UpdateReqTransactionDetailDto";
import { UploadMultipleDetailsDto } from "../dto/UploadMultipleDetailsDto";

@Controller("req-transaction-details")
export class ReqTransactionDetailsController {
  constructor(
    private readonly reqTransactionDetailsService: ReqTransactionDetailsService,
  ) {}

  @Get()
  async findAll() {
    return await this.reqTransactionDetailsService.findAll();
  }

  @Get(":id")
  async findOne(@Param("id") id: number) {
    return await this.reqTransactionDetailsService.findOne(id);
  }

  @Post()
  async create(
    @Body() createDto: CreateReqTransactionDetailDto,
    @Request() req,
  ) {
    const userId = req.user?.id || 1;
    return await this.reqTransactionDetailsService.create(createDto, userId);
  }

  @Put(":id")
  async update(
    @Param("id") id: number,
    @Body() updateDto: UpdateReqTransactionDetailDto,
    @Request() req,
  ) {
    const userId = req.user?.id || 1;
    return await this.reqTransactionDetailsService.update(
      id,
      updateDto,
      userId,
    );
  }

  @Patch(":id/toggle-status")
  async toggleStatus(@Param("id") id: number, @Request() req) {
    const userId = req.user?.id || 1;
    return await this.reqTransactionDetailsService.toggleStatus(id, userId);
  }

  @Post("upload-multiple")
  async uploadMultipleFiles(
    @Body() uploadDto: UploadMultipleDetailsDto,
    @Request() req,
  ) {
    const userId = req.user?.id || 1;
    console.log("Received upload-multiple request with data:", uploadDto);
    return await this.reqTransactionDetailsService.uploadMultipleFiles(
      uploadDto.req_transaction_header_id,
      uploadDto.files,
      userId,
      uploadDto.warehouse_requirement_due_start || undefined,
      uploadDto.warehouse_requirement_due_end || undefined,
    );
  }
}
