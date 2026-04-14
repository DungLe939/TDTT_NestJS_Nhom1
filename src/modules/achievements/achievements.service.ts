import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { db } from '../../providers/firebase.provider';
import {
    Achievement,
    ActivityEvent,
    Reward,
    AchievementCondition,
    RewardType
} from './interfaces/achievement.interface';
import { ProgressTrackerService } from './progress-tracker.service';

/**
 * Blog & feature 1, 2, 3, 4 sẽ giao tiếp với Achievement system qua handleActivityEvent method
 */
@Injectable()
export class AchievementService {
    private readonly logger = new Logger(AchievementService.name);

    constructor(
        private readonly progressTrackerService: ProgressTrackerService
    ) { }

    // =========================================================================
    // External System Event Handling
    // =========================================================================

    /**
    * Được gọi bởi Blog và feature 1, 2, 3, 4 khi người dùng thực hiện các hành động sau:
    *   - Blog system (POST_CREATED, RESTAURANT_VISITED, POST_LIKED)
    *   - Feature 1  (SCHEDULE_COMPLETED)
    *   - Feature 2  (FOOD_SCANNED)
    *   - Feature 3  (MENU_TRANSLATED)
    *   - Feature 4  (GROUP_TASTE_USED)
    *
    * Triggers nội bộ: getActiveAchievements -> doesEventMatchCondition -> incrementProgress -> issueReward -> notifyUser.
    *
    * Ví dụ: call khi user thực hiện food scan (Feature 2):
    *   achievementService.handleActivityEvent({
    *     userId: 'user_abc',
    *     type: 'FOOD_SCANNED',
    *     occurredAt: new Date(),
    *     payload: { scannedFoodId: 'food_xyz', cuisineType: 'japanese' }
    *   });
    */
    async handleActivityEvent(event: ActivityEvent): Promise<void> {
        // ghi su kien vao log
        this.logger.log(`Received event ${event.type} for user ${event.userId}`);

        // lay cac mission dang dien ra
        const activeAchievements = await this.getActiveAchievements();

        // kiem tra xem su kien co trigger mot active mission nao khong
        for (const achievement of activeAchievements) {
            if (this.doesEventMatchCondition(event, achievement)) {
                await this.incrementProgress(event.userId, achievement);
            }
        }
    }

    /** 
     * Lấy các mission đang diễn ra từ database
     * */
    private async getActiveAchievements(): Promise<Achievement[]> {
        const snapshot = await db.collection('achievements')
            .where('isActive', '==', true)
            .get();
        if (snapshot.empty) return [];
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Achievement[];
    }

    /**
     * Kiểm tra xem sự kiện có trigger một active mission nào không
     */
    private doesEventMatchCondition(event: ActivityEvent, achievement: Achievement): boolean {
        const condition = achievement.condition;

        // kiểm tra xem event type có match không
        if (event.type !== condition.eventType) return false;

        // kiểm tra xem các điều kiện khác có match không
        if (condition.filters?.cuisineType && event.payload.cuisineType !== condition.filters.cuisineType) return false;
        if (condition.filters?.withinDays) {
            const limitDate = new Date(Date.now() - condition.filters.withinDays * 24 * 60 * 60 * 1000);
            const occurredAtDate = event.occurredAt instanceof Date ? event.occurredAt : new Date(event.occurredAt);
            if (occurredAtDate < limitDate) return false;
        }
        if (condition.filters?.tag && !event.payload.tags?.includes(condition.filters.tag)) return false;

        return true;
    }

    // For time-windowed achievements, recalculate from the activity log
    private async recountFromLog(userId: string, condition: AchievementCondition): Promise<number> {
        let query = db.collection('activity_logs')
            .where('userId', '==', userId)
            .where('type', '==', condition.eventType);

        if (condition.filters?.withinDays) {
            const since = new Date(Date.now() - condition.filters.withinDays * 86400000);
            query = query.where('occurredAt', '>=', since);
        }
        if (condition.filters?.cuisineType) {
            query = query.where('payload.cuisineType', '==', condition.filters.cuisineType);
        }
        const snap = await query.get();
        return snap.size;
    }

    /**
     * Update ProgressTracker records trong Firebase.
     */
    private async incrementProgress(userId: string, achievement: Achievement): Promise<void> {
        this.logger.log(`Incrementing progress for user ${userId} and achievement ${achievement.name}`);

        // lấy required count cho một achievement
        const requiredCount = achievement.condition.requiredCount;

        // lấy tracker của user đối với achievement này. nếu không có tracker, tạo mới
        let tracker = await this.progressTrackerService.getTracker(userId, achievement.id!);
        if (!tracker) {
            tracker = await this.progressTrackerService.createTracker(userId, achievement.id!, requiredCount);
        }

        // nếu mission đã hoàn thành trước đó, return
        if (tracker.isCompleted) {
            return;
        }

        // nếu là time-windowed event, xem lại từ log. Ngược lại, +1.
        const newCount = achievement.condition.filters?.withinDays
            ? await this.recountFromLog(userId, achievement.condition)
            : tracker.currentCount + 1;

        // update progress
        const updatedTracker = await this.progressTrackerService.updateProgress(tracker.id!, newCount, requiredCount);

        // nếu mission hoàn thành lần đầu tiên, cấp reward
        if (updatedTracker.isCompleted) {
            await this.issueReward(userId, achievement.id!, achievement.rewardId);
        }
    }

    /**
     * Tạo một UserReward record khi một achievement hoàn thành.
     * Idempotent — sẽ không cấp một phần thưởng trùng lặp cho cùng một cặp (userId, achievementId).
     */
    private async issueReward(userId: string, achievementId: string, rewardId: string): Promise<void> {
        // kiểm tra xem user đã nhận reward này chưa
        const existing = await db.collection('user_rewards')
            .where('userId', '==', userId)
            .where('achievementId', '==', achievementId)
            .get();
        if (!existing.empty) return;

        this.logger.log(`Issuing reward ${rewardId} to user ${userId} for achievement ${achievementId}`);

        // lấy thông tin reward
        let expiresAt: Date | undefined;
        const rewardDoc = await db.collection('rewards').doc(rewardId).get();
        if (rewardDoc.exists) {
            const rewardData = rewardDoc.data();
            if (rewardData?.expiresAt) {
                expiresAt = rewardData.expiresAt.toDate ? rewardData.expiresAt.toDate() : new Date(rewardData.expiresAt);
            }
        }

        const userReward = {
            userId,
            rewardId,
            achievementId,
            issuedAt: new Date(),
            expiresAt,
            isUsed: false,
        };

        // ghi reward vào database cho user
        const docRef = await db.collection('user_rewards').add(userReward);

        // thông báo cho user
        await this.notifyUser(userId, achievementId, docRef.id);
    }

    /**
     * TODO: Tích hợp với hệ thống thông báo chung ở đây trong tương lai
     */
    private async notifyUser(userId: string, achievementId: string, userRewardId: string): Promise<void> {
        this.logger.log(`Notify user ${userId}: completed achievement ${achievementId}, rewarded ${userRewardId}`);

        // TODO: thông báo đã nhận reward cho user
    }



    // =========================================================================
    // API Endpoint Methods
    // =========================================================================

    /**
     * Trả về tất cả các achievement cùng với tiến độ hiện tại của người dùng.
     * Dùng cho Mission Screen.
     */
    async getAchievementsForUser(userId: string): Promise<any[]> {
        const snapshot = await db.collection('achievements').get();
        if (snapshot.empty) return [];

        const achievements: Achievement[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Achievement[];

        const trackers = await Promise.all(
            achievements.map(ach => this.progressTrackerService.getTracker(userId, ach.id!))
        );

        return achievements.map((ach, i) => ({
            ...ach,
            progress: trackers[i] ?? {
                userId,
                achievementId: ach.id!,
                currentCount: 0,
                requiredCount: ach.condition.requiredCount,
                progressPercent: 0,
                isCompleted: false,
            },
        }));
    }

    /**
     * Trả về một achievement với tiến độ của người dùng.
     */
    async getAchievementDetails(achievementId: string, userId: string): Promise<any> {
        const doc = await db.collection('achievements').doc(achievementId).get();
        if (!doc.exists) {
            throw new NotFoundException(`Achievement ${achievementId} not found`);
        }

        const ach = { id: doc.id, ...doc.data() } as Achievement;
        let tracker = await this.progressTrackerService.getTracker(userId, ach.id!);
        if (!tracker) {
            tracker = {
                userId,
                achievementId: ach.id!,
                currentCount: 0,
                requiredCount: ach.condition.requiredCount,
                progressPercent: 0,
                isCompleted: false
            };
        }
        return { ...ach, progress: tracker };
    }

    /**
     * Trả về tất cả phần thưởng đã nhận bởi user với đầy đủ chi tiết reward.
     */
    async getUserRewards(userId: string): Promise<Reward[]> {
        const snapshot = await db.collection('user_rewards').where('userId', '==', userId).get();
        if (snapshot.empty) return [];

        const userRewards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

        const rewardDocs = await Promise.all(
            userRewards.map(ur => db.collection('rewards').doc(ur.rewardId).get())
        );

        return userRewards.map((ur, i) => ({
            ...ur,
            reward: rewardDocs[i].exists ? { id: rewardDocs[i].id, ...rewardDocs[i].data() } : null,
        }));
    }

    /**
     * Đánh dấu voucher là đã sử dụng. Thất bại nếu đã sử dụng hoặc hết hạn.
     *
     * @param userId       - người dùng đang redeem voucher
     * @param userRewardId - ID của UserReward record (không phải ID của Reward)
     * @returns            - discountPercent để người dùng áp dụng
     */
    async redeemVoucher(userId: string, userRewardId: string): Promise<{ success: boolean; discountPercent?: number; message: string }> {
        // lấy từ database những reward mà user đã sở hữu
        const docRef = db.collection('user_rewards').doc(userRewardId);
        const doc = await docRef.get();

        // kiểm tra điều kiện áp dụng voucher
        if (!doc.exists) {
            throw new NotFoundException('Reward not found');
        }
        const data = doc.data();
        if (data?.userId !== userId) {
            throw new BadRequestException('Reward not owned by user');
        }
        if (data?.isUsed) {
            throw new BadRequestException('Reward is already used');
        }
        if (data?.expiresAt) {
            const expDate = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
            if (expDate < new Date()) {
                throw new BadRequestException('Reward is expired');
            }
        }

        // Fetch reward logic to get discount
        const rewardDoc = await db.collection('rewards').doc(data!.rewardId).get();
        let discountPercent = undefined;
        if (rewardDoc.exists) {
            const rewardData = rewardDoc.data();
            if (rewardData?.type === 'voucher') {
                discountPercent = rewardData.value;
            }
        }

        await docRef.update({ isUsed: true });

        return {
            success: true,
            discountPercent,
            message: 'Voucher redeemed successfully',
        };
    }

    /**
     * Định nghĩa một achievment mới. Chỉ dành cho admin.
     */
    async createAchievement(dto: {
        name: string;
        description: string;
        condition: AchievementCondition;
        rewardId: string;
    }): Promise<Achievement> {
        const achievement = { ...dto, isActive: true };
        const docRef = await db.collection('achievements').add(achievement);
        return { id: docRef.id, ...achievement } as Achievement;
    }

    /**
     * Định nghĩa một reward mới. Chỉ dành cho admin.
     */
    async createReward(dto: {
        type: RewardType;
        value: number;
        description: string;
        expiresAt?: Date;
    }): Promise<Reward> {
        const reward = { ...dto };
        const docRef = await db.collection('rewards').add(reward);
        return { id: docRef.id, ...reward } as Reward;
    }
}

