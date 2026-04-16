import { CreateCompanyDto } from "./CreateCompanyDto";
import { PartialType } from "@nestjs/mapped-types";

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {}
