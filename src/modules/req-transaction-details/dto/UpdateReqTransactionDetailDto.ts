import { PartialType } from "@nestjs/mapped-types";
import { CreateReqTransactionDetailDto } from "./CreateReqTransactionDetailDto";

export class UpdateReqTransactionDetailDto extends PartialType(
  CreateReqTransactionDetailDto,
) {}
