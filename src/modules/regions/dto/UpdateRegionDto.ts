import { CreateRegionDto } from "./CreateRegionDto";
import { PartialType } from "@nestjs/mapped-types";

export class UpdateRegionDto extends PartialType(CreateRegionDto) {}
