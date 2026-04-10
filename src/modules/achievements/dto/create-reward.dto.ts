import { IsString, IsNotEmpty, IsNumber, IsOptional, IsDate, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import type { RewardType } from '../interfaces/achievement.interface';

/**
 * Dùng khi tạo một reward mới, chỉ dành cho admin
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

