import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class LikePostDto {
    @IsString()
    @IsNotEmpty()
    userId: string;
}

export class AddCommentDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsString()
    @IsNotEmpty()
    content: string;

    @IsOptional()
    @IsString({ each: true })
    photoUrls?: string[];

    @IsOptional()
    @IsString()
    parentId?: string;
}

export class LikeCommentDto {
    @IsString()
    @IsNotEmpty()
    userId: string;
}

export class VisitRestaurantDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsString()
    @IsNotEmpty()
    restaurantId: string;

    @IsOptional()
    @IsString()
    cuisineType?: string;
}
