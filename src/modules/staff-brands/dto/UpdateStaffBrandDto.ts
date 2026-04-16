import { PartialType } from "@nestjs/mapped-types";
import { CreateStaffBrandDto } from "./CreateStaffBrandDto";

export class UpdateStaffBrandDto extends PartialType(CreateStaffBrandDto) {}
