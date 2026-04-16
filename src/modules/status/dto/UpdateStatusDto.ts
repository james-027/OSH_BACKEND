import { PartialType } from "@nestjs/mapped-types";
import { CreateStatusDto } from "./CreateStatusDto";

export class UpdateStatusDto extends PartialType(CreateStatusDto) {}
