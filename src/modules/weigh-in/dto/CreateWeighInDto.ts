import { Type } from 'class-transformer';
import {
    ValidateNested,
    IsArray,
    ArrayMinSize,
    IsNumber,
    IsString,
    IsDateString,
    IsNotEmpty,
    IsOptional,
} from 'class-validator';
import { WeighInLineItemDto } from './CreateWeighInLineItemDto';

export class CreateWeighInDto {
    @IsOptional()
    @IsNumber()
    id?: number;

    @IsOptional()
    @IsString()
    control_no?: string;

    @IsString()
    @IsNotEmpty()
    po_number: string;

    @IsOptional()
    @IsDateString()
    transaction_date?: string;

    @IsOptional()
    @IsString()
    session_status?: 'ACTIVE' | 'COMPLETED';

    @IsOptional()
    @IsString()
    grower?: string;

    @IsOptional()
    @IsString()
    farm_location?: string;

    @IsOptional()
    @IsString()
    sold_to?: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsString()
    @IsNotEmpty()
    buyer_rep: string;

    @IsOptional()
    @IsString()
    buyer_signature?: string;

    @IsString()
    @IsNotEmpty()
    driver_license: string;

    @IsOptional()
    @IsString()
    driver_license_image?: string;

    @IsString()
    @IsNotEmpty()
    truck_plate: string;

    @IsOptional()
    @IsString()
    target_heads?: string;

    // --- SIGN-OFF FIELDS ---
    @IsOptional()
    @IsString()
    checked_by?: string;

    @IsOptional()
    @IsString()
    checked_signature?: string;

    @IsOptional()
    @IsString()
    attested_by?: string;

    @IsOptional()
    @IsString()
    attested_signature?: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => WeighInLineItemDto)
    line!: WeighInLineItemDto[];

    @IsOptional()
    @IsNumber()
    access_key_id?: number;

    @IsOptional()
    @IsNumber()
    status_id?: number;

    @IsOptional()
    @IsString()
    tally_sheet_pdf?: string;
    
}