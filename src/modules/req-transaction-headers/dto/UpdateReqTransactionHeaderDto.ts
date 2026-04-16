import { PartialType } from "@nestjs/mapped-types";
import { CreateReqTransactionHeaderDto } from "./CreateReqTransactionHeaderDto";

export class UpdateReqTransactionHeaderDto extends PartialType(
  CreateReqTransactionHeaderDto,
) {}
