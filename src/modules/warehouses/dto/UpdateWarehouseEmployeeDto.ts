import { PartialType } from "@nestjs/mapped-types";
// import { IsOptional, IsInt } from "class-validator";
import { CreateWarehouseEmployeeDto } from "./CreateWarehouseEmployeeDto";

export class UpdateWarehouseEmployeeDto extends PartialType(
  CreateWarehouseEmployeeDto,
) {}
