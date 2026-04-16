import { PartialType } from "@nestjs/mapped-types";
import { CreateEmployeeLocationDto } from "./CreateEmployeeLocationDto";

export class UpdateEmployeeLocationDto extends PartialType(
  CreateEmployeeLocationDto,
) {}
