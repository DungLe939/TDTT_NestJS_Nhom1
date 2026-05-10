import { IsString, IsNotEmpty, IsNumber, IsOptional, IsIn, IsInt, Min } from 'class-validator';
import type { RewardType } from '../interfaces/achievement.interface';

/**
 * Dùng khi tạo một reward mới, chỉ dành cho admin
 */
export class CreateRewardDto {
    @IsNotEmpty()
    @IsIn(['voucher', 'badge', 'points'])
    type: RewardType;

    @IsNotEmpty()
    @IsNumber()
    value: number;

    @IsNotEmpty()
    @IsString()
    description: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    validForDays?: number;

    @IsOptional()
    @IsString()
    icon?: string;
}
