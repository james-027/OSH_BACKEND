import { PartialType } from "@nestjs/mapped-types";
import CreateSegmentDto from "./CreateSegmentDto";

export class UpdateSegmentDto extends PartialType(CreateSegmentDto) {}
