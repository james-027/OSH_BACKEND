import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateApprovalStagesListDto {
  @IsOptional()
  @IsInt({
    message: "Debit Advice ID must be an integer",
  })
  @Min(1, {
    message:
      "Debit Advice ID must be a positive integer",
  })
  transaction_id?: number;

  @IsOptional()
  @IsString({
    message: "Document number must be a string",
  })
  @MaxLength(100, {
    message:
      "Document number cannot be longer than 100 characters",
  })
  document_number?: string;

  @IsOptional()
  @IsDateString(
    {},
    {
      message:
        "Transaction date must be a valid date",
    },
  )
  transaction_date?: Date;

  @IsOptional()
  @IsInt({
    message: "Series must be an integer",
  })
  @Min(1, {
    message:
      "Series must be a positive integer",
  })
  series?: number;

  @IsOptional()
  @IsInt({
    message:
      "Current approver must be an integer",
  })
  @Min(1, {
    message:
      "Current approver must be a positive integer",
  })
  current_approver?: number;

  @IsOptional()
  @IsInt({
    message:
      "Next approver must be an integer",
  })
  @Min(1, {
    message:
      "Next approver must be a positive integer",
  })
  next_approver?: number;

  @IsOptional()
  @IsDateString(
    {},
    {
      message:
        "Approval date must be a valid date",
    },
  )
  approval_date?: Date;

  @IsOptional()
  @IsString({
    message:
      "Approval remarks must be a string",
  })
  approval_remarks?: string;

  @IsOptional()
  @IsInt({
    message: "Status ID must be an integer",
  })
  @Min(1, {
    message:
      "Status ID must be a positive integer",
  })
  status_id?: number;
}