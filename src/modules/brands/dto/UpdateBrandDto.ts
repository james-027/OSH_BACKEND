import { PartialType } from "@nestjs/mapped-types";
import { CreateBrandDto } from "./CreateBrandDto";

export class UpdateBrandDto extends PartialType(CreateBrandDto) {}
