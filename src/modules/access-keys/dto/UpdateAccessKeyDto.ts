import { PartialType } from "@nestjs/mapped-types";
import { CreateAccessKeyDto } from "./CreateAccessKeyDto";

export class UpdateAccessKeyDto extends PartialType(CreateAccessKeyDto) {}
