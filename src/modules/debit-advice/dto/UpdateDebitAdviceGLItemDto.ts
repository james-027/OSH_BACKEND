import { IsString, IsNotEmpty, IsNumber, IsOptional, IsDateString } from 'class-validator';

export class UpdateDebitAdvice_GL_ItemDto {
    @IsNumber()
    id: number; // include id for update to identify which line item to update

    @IsNumber()
    isdeleted: number; // flag to indicate if the item is marked for deletion

    @IsString()
    @IsNotEmpty()
    Remarks!: string;

    @IsString()
    @IsNotEmpty()
    gl_code!: string;

    @IsString()
    @IsNotEmpty()
    profitcenter_code!: string;

    @IsNumber()
    @IsNotEmpty()
    amount!: number;

    @IsDateString()
    updated_at: string;


}