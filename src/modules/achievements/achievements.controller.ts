import { Controller, Get, Post, Body, Param, UsePipes, ValidationPipe } from '@nestjs/common';
import { AchievementService } from './achievements.service';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { CreateRewardDto } from './dto/create-reward.dto';
import { RedeemRewardDto } from './dto/redeem-reward.dto';

@Controller()
export class AchievementsController {
    constructor(private readonly achievementsService: AchievementService) {}

    @Get('achievements/user/:userId')
    async getAchievementsForUser(@Param('userId') userId: string) {
        return this.achievementsService.getAchievementsForUser(userId);
    }

    @Get('achievements/:achievementId/user/:userId')
    async getAchievementDetails(
        @Param('achievementId') achievementId: string,
        @Param('userId') userId: string
    ) {
        return this.achievementsService.getAchievementDetails(achievementId, userId);
    }

    @Get('rewards/user/:userId')
    async getUserRewards(@Param('userId') userId: string) {
        return this.achievementsService.getUserRewards(userId);
    }

    @Post('rewards/redeem')
    @UsePipes(new ValidationPipe({ transform: true }))
    async redeemVoucher(@Body() dto: RedeemRewardDto) {
        return this.achievementsService.redeemVoucher(dto.userId, dto.userRewardId);
    }

    @Post('achievements')
    @UsePipes(new ValidationPipe({ transform: true }))
    async createAchievement(@Body() dto: CreateAchievementDto) {
        return this.achievementsService.createAchievement(dto);
    }

    @Post('rewards')
    @UsePipes(new ValidationPipe({ transform: true }))
    async createReward(@Body() dto: CreateRewardDto) {
        return this.achievementsService.createReward(dto);
    }
}
