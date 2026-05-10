import { IsString, IsArray, IsOptional, IsNotEmpty } from 'class-validator';

export class CreatePostDto {
    @IsString()
    @IsNotEmpty()
    authorId: string;

    @IsString()
    @IsNotEmpty()
    content: string;

    @IsArray()
    @IsString({ each: true })
    tags: string[];

    @IsOptional()
    @IsString()
    restaurantId?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    photoUrls?: string[];
}
