import { Controller, Get, Post, Body, Param, UsePipes, ValidationPipe, UseGuards } from '@nestjs/common';
import { AchievementService } from './achievements.service';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { CreateRewardDto } from './dto/create-reward.dto';
import { RedeemRewardDto } from './dto/redeem-reward.dto';
import { LogActivityDto } from './dto/log-activity.dto';

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
     * GET /users/:userId/stats
     * Trả về thông tin tổng quát của người dùng (xp, level, badges, ...).
     */
    @Get('users/:userId/stats')
    async getUserStats(@Param('userId') userId: string) {
        return this.achievementsService.getUserStats(userId);
    }

    /**
     * GET /rewards
     * Trả về tất cả các phần thưởng hiện có trong database.
     */
    @Get('rewards')
    async getAllRewards() {
        return this.achievementsService.getAllRewards();
    }

    /**
     * POST /rewards/redeem
     * Đánh dấu voucher là đã sử dụng. Thất bại nếu đã sử dụng hoặc hết hạn.
     *
     * @param userId       - người dùng đang redeem voucher
     * @param userRewardId - ID của UserReward record (không phải ID của Reward)
     * @returns            - discountPercent để người dùng áp dụng
     */
    @Post('rewards/redeem')
    @UsePipes(new ValidationPipe({ transform: true }))
    async redeemVoucher(@Body() dto: RedeemRewardDto) {
        return this.achievementsService.redeemVoucher(dto.userId, dto.userRewardId);
    }

    /**
     * POST /achievements/activity
     * Endpoint công khai cho các feature không có backend NestJS riêng
     * (ví dụ: FoodScan dùng FastAPI ngoài) để ghi nhận sự kiện thành tích.
     *
     * Ví dụ: Frontend gọi sau khi scan món ăn thành công:
     *   POST /achievements/activity { userId, type: 'FOOD_SCANNED', occurredAt }
     */
    @Post('achievements/activity')
    @UsePipes(new ValidationPipe({ transform: true }))
    async logActivity(@Body() dto: LogActivityDto) {
        await this.achievementsService.handleActivityEvent({
            userId: dto.userId,
            type: dto.type,
            occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
            payload: dto.payload as any,
        });
        return { success: true };
    }

    /**
     * POST /achievements
     * Định nghĩa một achievment mới. Chỉ dành cho admin.
     */
    @Post('achievements')
    @UsePipes(new ValidationPipe({ transform: true }))
    async createAchievement(@Body() dto: CreateAchievementDto) {
        return this.achievementsService.createAchievement(dto);
    }

    /**
     * POST /rewards
     * Định nghĩa một reward mới. Chỉ dành cho admin.
     */
    @Post('rewards')
    @UsePipes(new ValidationPipe({ transform: true }))
    async createReward(@Body() dto: CreateRewardDto) {
        return this.achievementsService.createReward(dto);
    }
}

