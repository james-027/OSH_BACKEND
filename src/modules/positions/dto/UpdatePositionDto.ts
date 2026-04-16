import { PartialType } from "@nestjs/mapped-types";
import CreatePositionDto from "./CreatePositionDto";

export class UpdatePositionDto extends PartialType(CreatePositionDto) {}
