import { PartialType } from "@nestjs/mapped-types";
import { CreateCrewHubSystemDto } from "./create-crew-hub-system.dto";

export class UpdateCrewHubSystemDto extends PartialType(CreateCrewHubSystemDto) {}

