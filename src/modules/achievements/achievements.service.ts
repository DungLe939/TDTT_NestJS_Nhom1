import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { db } from '../../providers/firebase.provider';
import {
    Achievement,
    ActivityEvent,
    ProgressTracker,
    Reward
} from './interfaces/achievement.interface';
import { ProgressTrackerService } from './progress-tracker.service';

/**
 * Blog & feature 1, 2, 3, 4 will communicate to Achievement system through handleActivityEvent method
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
    async handleActivityEvent(event: ActivityEvent): Promise<void> {
        this.logger.log(`Received event ${event.type} for user ${event.userId}`);

        const activeAchievements = await this.getActiveAchievements();

        for (const achievement of activeAchievements) {
            if (this.doesEventMatchCondition(event, achievement)) {
                await this.incrementProgress(event.userId, achievement);
            }
        }
    }

    private doesEventMatchCondition(event: ActivityEvent, achievement: Achievement): boolean {
        const condition = achievement.condition;
        if (event.type !== condition.eventType) return false;
        if (condition.filters?.cuisineType && event.payload.cuisineType !== condition.filters.cuisineType) return false;
        if (condition.filters?.withinDays) {
            const limitDate = new Date(Date.now() - condition.filters.withinDays * 24 * 60 * 60 * 1000);
            const occurredAtDate = event.occurredAt instanceof Date ? event.occurredAt : new Date(event.occurredAt);
            if (occurredAtDate < limitDate) return false;
        }
        if (condition.filters?.tag && !event.payload.tags?.includes(condition.filters.tag)) return false;
        return true;
    }

    private async incrementProgress(userId: string, achievement: Achievement): Promise<void> {
        this.logger.log(`Incrementing progress for user ${userId} and achievement ${achievement.name}`);

        const requiredCount = achievement.condition.requiredCount;
        let tracker = await this.progressTrackerService.getTracker(userId, achievement.id!);

        if (!tracker) {
            tracker = await this.progressTrackerService.createTracker(userId, achievement.id!, requiredCount);
        }

        if (tracker.isCompleted) {
            return;
        }

        const newCount = tracker.currentCount + 1;
        const updatedTracker = await this.progressTrackerService.updateProgress(tracker.id!, newCount, requiredCount);

        if (updatedTracker.isCompleted) {
            await this.issueReward(userId, achievement.id!, achievement.rewardId);
        }
    }

    private async issueReward(userId: string, achievementId: string, rewardId: string): Promise<void> {
        this.logger.log(`Issuing reward ${rewardId} to user ${userId} for achievement ${achievementId}`);
        
        // Fetch reward definition
        let expiresAt: Date | undefined;
        const rewardDoc = await db.collection('rewards').doc(rewardId).get();
        if (rewardDoc.exists) {
            const rewardData = rewardDoc.data();
            if (rewardData?.expiresAt) {
                // Determine expiry if applicable
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

        const docRef = await db.collection('user_rewards').add(userReward);
        await this.notifyUser(userId, achievementId, docRef.id);
    }

    private async notifyUser(userId: string, achievementId: string, userRewardId: string): Promise<void> {
        this.logger.log(`Notify user ${userId}: completed achievement ${achievementId}, rewarded ${userRewardId}`);
        // Integrate with a shared notification system here in the future
    }

    private async getActiveAchievements(): Promise<Achievement[]> {
        const snapshot = await db.collection('achievements')
            .where('isActive', '==', true)
            .get();
        if (snapshot.empty) return [];
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Achievement[];
    }

    // =========================================================================
    // API Endpoint Methods
    // =========================================================================

    async getAchievementsForUser(userId: string): Promise<any[]> {
        const snapshot = await db.collection('achievements').get();
        if (snapshot.empty) return [];
        
        const achievements: Achievement[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Achievement[];
        const results: any[] = [];

        for (const ach of achievements) {
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
            results.push({ ...ach, progress: tracker });
        }
        return results;
    }

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

    async getUserRewards(userId: string): Promise<any[]> {
        const snapshot = await db.collection('user_rewards').where('userId', '==', userId).get();
        if (snapshot.empty) return [];

        const userRewards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        const resolvedRewards: any[] = [];
        
        for (const ur of userRewards) {
            const rewardDoc = await db.collection('rewards').doc(ur.rewardId).get();
            const reward = rewardDoc.exists ? { id: rewardDoc.id, ...rewardDoc.data() } : null;
            resolvedRewards.push({ ...ur, reward });
        }
        
        return resolvedRewards;
    }

    async redeemVoucher(userId: string, userRewardId: string): Promise<{ success: boolean; discountPercent?: number; message: string }> {
        const docRef = db.collection('user_rewards').doc(userRewardId);
        const doc = await docRef.get();

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

    async createAchievement(dto: any): Promise<Achievement> {
        const achievement = { ...dto, isActive: true };
        const docRef = await db.collection('achievements').add(achievement);
        return { id: docRef.id, ...achievement } as Achievement;
    }

    async createReward(dto: any): Promise<Reward> {
        const reward = { ...dto };
        const docRef = await db.collection('rewards').add(reward);
        return { id: docRef.id, ...reward } as Reward;
    }
}
