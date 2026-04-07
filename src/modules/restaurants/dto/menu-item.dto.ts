import { IsString, IsNumber, IsOptional } from 'class-validator';

export class MenuItemDto {
    @IsString()
    name: string;

    @IsNumber()
    price: number;

    @IsOptional()
    @IsString()
    description?: string;
}