import { IsString, IsNotEmpty, IsNumber, IsOptional, IsDateString } from 'class-validator';

export class UpdateWeighInLineItemDto {
    @IsOptional()
    @IsNumber()
    id?: number; // Include id to identify existing line items for update

    @IsOptional()
    @IsNumber()
    isdeleted?: number; // 1 = mark for deletion

    @IsString()
    @IsNotEmpty()
    po_number!: string;

    @IsNumber()
    @IsNotEmpty()
    weight!: number;

    @IsString()
    @IsNotEmpty()
    unit!: string;

    @IsNumber()
    @IsNotEmpty()
    heads!: number;

    @IsOptional()
    @IsDateString()
    weigh_timestamp?: string;

    @IsOptional()
    @IsDateString()
    updated_at?: string;
}