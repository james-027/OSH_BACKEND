import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ValidateNested, IsArray, ArrayMinSize } from 'class-validator';
import { DebitAdvice_GL_ItemDto } from './CreateDebitAdviceGLItemDto';
export class DebitAdviceLineItemDto {
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

    @IsArray()
    @ArrayMinSize(1)
    @Type(() => DebitAdvice_GL_ItemDto)
    @ValidateNested({ each: true })
    glItems!: DebitAdvice_GL_ItemDto[];
    id?: number;
}