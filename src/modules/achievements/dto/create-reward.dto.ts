import { IsString, IsNotEmpty, IsNumber, IsOptional, IsDate, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import type { RewardType } from '../interfaces/achievement.interface';

/**
 * Use when creating a new reward, admin only
 */

export class CreateRewardDto {
    @IsNotEmpty()
    @IsString()
    type: RewardType;

    @IsNotEmpty()
    @IsNumber()
    value: number;

    @IsNotEmpty()
    @IsString()
    description: string;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    expiresAt?: Date;
}
