import { IsString, IsNotEmpty, IsOptional } from "class-validator";
export class CreateProfitcenterDto  {   
@IsString()
@IsNotEmpty()
profitcenter_code?: string;
@IsOptional()
@IsString()
profitcenter_name?: string;
@IsOptional()
@IsString()
old_code?: string;
}