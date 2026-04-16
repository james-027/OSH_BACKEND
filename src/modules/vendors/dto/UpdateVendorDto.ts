import { PartialType } from "@nestjs/mapped-types";
import { CreateVendorDto } from "./CreateVendorDto";

export class UpdateVendorDto extends PartialType(CreateVendorDto) {}
