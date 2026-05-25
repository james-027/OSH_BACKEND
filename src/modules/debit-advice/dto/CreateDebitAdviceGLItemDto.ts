import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class DebitAdvice_GL_ItemDto {
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

}