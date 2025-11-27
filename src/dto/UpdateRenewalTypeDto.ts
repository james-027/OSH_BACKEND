import { PartialType } from "@nestjs/mapped-types";
import { CreateRenewalTypeDto } from "./CreateRenewalTypeDto";

export class UpdateRenewalTypeDto extends PartialType(CreateRenewalTypeDto) {}
