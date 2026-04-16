import { CreateEmployeeDto } from "./CreateEmployeeDto";
import { PartialType } from "@nestjs/mapped-types";

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {}
