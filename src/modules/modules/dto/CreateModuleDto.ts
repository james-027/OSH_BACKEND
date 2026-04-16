import {
  IsNotEmpty,
  IsString,
  IsInt,
  Min,
  MaxLength,
  IsOptional,
  Length,
  IsNumber,
} from "class-validator";

export class CreateModuleDto {
  @IsNotEmpty({ message: "Module name is required" })
  @IsString({ message: "Module name must be a string" })
  @MaxLength(255, {
    message: "Module name cannot be longer than 255 characters",
  }) // Example max length
  module_name!: string;

  @IsNotEmpty({ message: "Module alias is required" })
  @IsString({ message: "Module alias must be a string" })
  @MaxLength(255, {
    message: "Module alias cannot be longer than 255 characters",
  })
  module_alias!: string;

  @IsNotEmpty({ message: "Module link is required" })
  @IsString({ message: "Module link must be a string" })
  @MaxLength(255, {
    message: "Module link cannot be longer than 255 characters",
  })
  module_link!: string;

  @IsNotEmpty({ message: "Menu title is required" })
  @IsString({ message: "Menu title must be a string" })
  @MaxLength(255, {
    message: "Menu title cannot be longer than 255 characters",
  })
  menu_title!: string;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  parent_title?: string;

  @IsNotEmpty({ message: "Link name is required" })
  @IsString({ message: "Link name must be a string" })
  @MaxLength(255, { message: "Link name cannot be longer than 255 characters" })
  link_name!: string;

  @IsNotEmpty({ message: "Order level is required" })
  @IsNumber({}, { message: "Order level must be a number" })
  @IsInt({ message: "Order level must be an integer" })
  @Min(1, { message: "Order level must be at least 1" })
  order_level!: number;

  @IsOptional() // status_id has a default in entity, but can be provided
  @IsInt({ message: "Status ID must be an integer" })
  status_id?: number;

  @IsOptional()
  // @IsInt({ message: "Status must be an integer" })
  // @IsString({ message: "Status must be a string" })
  status?: any;
}
