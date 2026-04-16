import { PartialType } from "@nestjs/mapped-types";
import { CreateWarehouseDto } from "./CreateWarehouseDto";

export class UpdateWarehouseDto extends PartialType(CreateWarehouseDto) {}
