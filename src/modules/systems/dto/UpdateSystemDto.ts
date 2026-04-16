import { CreateSystemDto } from "./CreateSystemDto";
import { PartialType } from "@nestjs/mapped-types";

export class UpdateSystemDto extends PartialType(CreateSystemDto) {}
