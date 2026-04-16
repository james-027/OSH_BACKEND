import { PartialType } from "@nestjs/mapped-types";
import { CreateLocationDto } from "./CreateLocationDto";

export class UpdateLocationDto extends PartialType(CreateLocationDto) {}
