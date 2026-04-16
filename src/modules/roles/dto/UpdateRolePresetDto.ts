import { PartialType } from "@nestjs/mapped-types";
import { CreateRolePresetDto } from "./CreateRolePresetDto";

export class UpdateRolePresetDto extends PartialType(CreateRolePresetDto) {}
