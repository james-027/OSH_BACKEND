import { PartialType } from "@nestjs/mapped-types";
import { CreateBrandGroupDto } from "./CreateBrandGroupDto";

export class UpdateBrandGroupDto extends PartialType(CreateBrandGroupDto) {}
