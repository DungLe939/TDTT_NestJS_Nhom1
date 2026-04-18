import { Controller, Get, Post, Body, Param, UsePipes, ValidationPipe, UseGuards } from '@nestjs/common';
import { AchievementService } from './achievements.service';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { CreateRewardDto } from './dto/create-reward.dto';
import { RedeemRewardDto } from './dto/redeem-reward.dto';

@Controller()
export class AchievementsController {
    constructor(private readonly achievementsService: AchievementService) { }

    /**
     * GET /achievements/user/:userId
     * Trả về tất cả các achievement cùng với tiến độ hiện tại của người dùng.
     * Dùng cho Mission Screen.
     */
    @Get('achievements/user/:userId')
    async getAchievementsForUser(@Param('userId') userId: string) {
        return this.achievementsService.getAchievementsForUser(userId);
    }

    /**
     * GET /achievements/:achievementId/user/:userId
     * Trả về thông tin chi tiết của 1 achievement cùng với tiến độ hiện tại của người dùng.
     */
    @Get('achievements/:achievementId/user/:userId')
    async getAchievementDetails(
        @Param('achievementId') achievementId: string,
        @Param('userId') userId: string
    ) {
        return this.achievementsService.getAchievementDetails(achievementId, userId);
    }

    /**
     * GET /rewards/user/:userId
     * Trả về tất cả các phần thưởng mà người dùng đã nhận được.
     */
    @Get('rewards/user/:userId')
    async getUserRewards(@Param('userId') userId: string) {
        return this.achievementsService.getUserRewards(userId);
    }

    /**
     * POST /rewards/redeem
     * Đánh dấu voucher là đã sử dụng. Thất bại nếu đã sử dụng hoặc hết hạn.
     *
     * @param userId       - người dùng đang redeem voucher
     * @param userRewardId - ID của UserReward record (không phải ID của Reward)
     * @returns            - discountPercent để người dùng áp dụng
     * 
     * TODO: add guard
     */
    @Post('rewards/redeem')
    @UsePipes(new ValidationPipe({ transform: true }))
    async redeemVoucher(@Body() dto: RedeemRewardDto) {
        return this.achievementsService.redeemVoucher(dto.userId, dto.userRewardId);
    }

    /**
     * POST /achievements
     * Định nghĩa một achievment mới. Chỉ dành cho admin.
     * 
     * TODO: add guard
     */
    @Post('achievements')
    // @UseGuards(FirebaseAuthGuard, AdminGuard)
    @UsePipes(new ValidationPipe({ transform: true }))
    async createAchievement(@Body() dto: CreateAchievementDto) {
        return this.achievementsService.createAchievement(dto);
    }

    /**
     * POST /rewards
     * Định nghĩa một reward mới. Chỉ dành cho admin.
     * 
     * TODO: add guard
     */
    @Post('rewards')
    // @UseGuards(FirebaseAuthGuard, AdminGuard)
    @UsePipes(new ValidationPipe({ transform: true }))
    async createReward(@Body() dto: CreateRewardDto) {
        return this.achievementsService.createReward(dto);
    }

    @Get('rewards')
    async getAllRewards() {
    return this.achievementsService.getAllRewards();
    }
    
    /**
 * TODO: REMOVE before production. Test-only endpoint to simulate activity events.
 */
    @Post('test/activity-event')
    async testHandleEvent(@Body() event: any) {
        await this.achievementsService.handleActivityEvent(event);
        return { received: true };
    }
}

