import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class TranslateDto {
    @IsString()
    @IsNotEmpty()
    text: string;

    @IsOptional()
    @IsEnum(['en2vi', 'vi2en'])
    method?: 'en2vi' | 'vi2en';

    @IsOptional()
    @IsString()
    curUserId?: string;
}