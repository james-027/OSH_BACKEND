import { PartialType } from "@nestjs/mapped-types";
import { CreateReqTransactionDueDto } from "./CreateReqTransactionDueDto";

export class UpdateReqTransactionDueDto extends PartialType(
  CreateReqTransactionDueDto
) {}
