import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Use when redeeming a reward, user only
 */

export class RedeemRewardDto {
    @IsNotEmpty()
    @IsString()
    userId: string;

    @IsNotEmpty()
    @IsString()
    userRewardId: string;
}