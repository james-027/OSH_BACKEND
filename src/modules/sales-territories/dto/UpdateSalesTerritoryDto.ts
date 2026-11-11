import { PartialType } from "@nestjs/mapped-types";
import { CreateSalesTerritoryDto } from "./CreateSalesTerritoryDto";

export class UpdateSalesTerritoryDto extends PartialType(
  CreateSalesTerritoryDto,
) {}

export default UpdateSalesTerritoryDto;
