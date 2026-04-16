import { PartialType } from "@nestjs/mapped-types";
import { CreateStaffDto } from "./CreateStaffDto";

export class UpdateStaffDto extends PartialType(CreateStaffDto) {}
