import { PartialType } from "@nestjs/mapped-types";
import { CreateSalesBudgetTransactionDto } from "./CreateSalesBudgetTransactionDto";

export class UpdateSalesBudgetTransactionDto extends PartialType(
  CreateSalesBudgetTransactionDto,
) {}
