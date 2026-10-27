import { IsString, IsNotEmpty, IsNumber, IsOptional, IsDateString } from 'class-validator';

export class WeighInLineItemDto {
    @IsOptional()
    @IsNumber()
    id?: number;

    @IsString()
    @IsNotEmpty()
    po_number: string;

    @IsNumber()
    @IsNotEmpty()
    weight: number;

    @IsString()
    @IsNotEmpty()
    unit: string;

    @IsNumber()
    @IsNotEmpty()
    heads: number;

    @IsOptional()
    @IsDateString()
    weigh_timestamp?: string;
}