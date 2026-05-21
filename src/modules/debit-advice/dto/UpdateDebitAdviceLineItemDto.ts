import { IsString, IsNotEmpty, IsNumber, IsOptional, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ValidateNested, IsArray, ArrayMinSize } from 'class-validator';
import { UpdateDebitAdvice_GL_ItemDto } from './UpdateDebitAdviceGLItemDto';
export class UpdateDebitAdviceLineItemDto {
    @IsNumber()
    id: number; // include id for update to identify which line item to update

    @IsNumber()
    isdeleted: number; // flag to indicate if the item is marked for deletion

    @IsString()
    @IsNotEmpty()
    category!: string;

    @IsString()
    @IsNotEmpty()
    vendor_code!: string;

    @IsString()
    @IsNotEmpty()
    vendor_name!: string;

    @IsNumber()
    @IsNotEmpty()
    amount!: number;

    @IsOptional()
    @IsString()
    particulars?: string;

    @IsDateString()
    updated_at: string;

    @IsArray()
    @ArrayMinSize(1)
    @Type(() => UpdateDebitAdvice_GL_ItemDto)
    @ValidateNested({ each: true })
    glItems!: UpdateDebitAdvice_GL_ItemDto[];


}