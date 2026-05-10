import { IsString, IsNotEmpty, IsObject, ValidateNested, IsBoolean, IsArray, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import type { ActivityEventType, CuisineType } from '../interfaces/achievement.interface';

/**
 * Dùng khi tạo một achievement mới, chỉ dành cho admin
 */

class AchievementConditionFiltersDto {
    @IsOptional()
    @IsString()
    cuisineType?: CuisineType;

    @IsOptional()
    @IsNumber()
    withinDays?: number;

    @IsOptional()
    @IsString()
    tag?: string;
}

class AchievementConditionDto {
    @IsNotEmpty()
    @IsString()
    eventType: ActivityEventType;

    @IsNotEmpty()
    @IsNumber()
    requiredCount: number;

    @IsOptional()
    @ValidateNested()
    @Type(() => AchievementConditionFiltersDto)
    filters?: AchievementConditionFiltersDto;
}

export class CreateAchievementDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsNotEmpty()
    @IsString()
    description: string;

    @IsNotEmpty()
    @ValidateNested()
    @Type(() => AchievementConditionDto)
    condition: AchievementConditionDto;

    @IsNotEmpty()
    @IsString()
    rewardId: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsString() 
    @IsOptional() 
    icon?: string
}
