import { IsString, IsOptional } from "class-validator";
export class UpdateProfitcenterDto {
@IsOptional()
@IsString()
profitcenter_code?: string;
@IsOptional()
@IsString()
profitcenter_name?: string;
@IsOptional()
@IsString()
old_code?: string;
}