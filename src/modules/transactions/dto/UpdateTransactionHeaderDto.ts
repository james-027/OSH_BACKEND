import { PartialType } from "@nestjs/mapped-types";
import { CreateTransactionHeaderDto } from "./CreateTransactionHeaderDto";

export class UpdateTransactionHeaderDto extends PartialType(
  CreateTransactionHeaderDto,
) {}
