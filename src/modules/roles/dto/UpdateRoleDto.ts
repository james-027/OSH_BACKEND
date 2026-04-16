import { CreateRoleDto } from "./CreateRoleDto";
import { PartialType } from "@nestjs/mapped-types";

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}
