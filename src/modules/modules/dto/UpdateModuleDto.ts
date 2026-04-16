import { CreateModuleDto } from "./CreateModuleDto";
import { PartialType } from "@nestjs/mapped-types";

export class UpdateModuleDto extends PartialType(CreateModuleDto) {}
