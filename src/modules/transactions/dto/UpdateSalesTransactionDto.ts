import { PartialType } from "@nestjs/mapped-types";
import { CreateSalesTransactionDto } from "./CreateSalesTransactionDto";

export class UpdateSalesTransactionDto extends PartialType(
  CreateSalesTransactionDto,
) {}
