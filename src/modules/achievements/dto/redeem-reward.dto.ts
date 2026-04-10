import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Dùng khi đổi một reward, chỉ dành cho user
 */

export class RedeemRewardDto {
    @IsNotEmpty()
    @IsString()
    userId: string;

    @IsNotEmpty()
    @IsString()
    userRewardId: string;
}