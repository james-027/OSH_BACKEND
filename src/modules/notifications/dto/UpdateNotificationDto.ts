import { PartialType } from "@nestjs/mapped-types";
import { CreateNotificationDto } from "./CreateNotificationDto";

export class UpdateNotificationDto extends PartialType(CreateNotificationDto) {}
