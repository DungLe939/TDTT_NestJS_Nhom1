import { IsOptional, IsString, IsArray } from 'class-validator';

export class FilterPostDto {
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];

    @IsOptional()
    @IsString()
    restaurantId?: string;

    @IsOptional()
    @IsString()
    authorId?: string;
}
