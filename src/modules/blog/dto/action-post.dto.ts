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
