import { PartialType } from "@nestjs/mapped-types";
import { CreateTransactionDetailDto } from "./CreateTransactionDetailDto";

export class UpdateTransactionDetailDto extends PartialType(
  CreateTransactionDetailDto,
) {}
