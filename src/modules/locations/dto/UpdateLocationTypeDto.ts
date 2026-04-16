import { PartialType } from "@nestjs/mapped-types";
import { CreateLocationTypeDto } from "./CreateLocationTypeDto";

export class UpdateLocationTypeDto extends PartialType(CreateLocationTypeDto) {}
