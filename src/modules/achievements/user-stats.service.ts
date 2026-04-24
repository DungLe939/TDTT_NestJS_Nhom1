import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../providers/firebase.provider';
import { UserStats, UserBadge, LEVELS } from './interfaces/achievement.interface';

@Injectable()
export class UserStatsService {
    private readonly logger = new Logger(UserStatsService.name);
    private readonly collectionName = 'user_stats';

    /**
     * Lấy thông tin liên quan đến thành tích của user
     */
    async getUserStats(userId: string): Promise<UserStats> {
        const doc = await db.collection(this.collectionName).doc(userId).get();
        if (!doc.exists) {
            const userStat = await this.createUserStats(userId);
            return userStat;
        }
        return { userId, ...doc.data() } as UserStats;
    }

    /**
     * Tạo thông tin liên quan đến thành tích của user
     */
    async createUserStats(userId: string): Promise<UserStats> {
        const userStats: UserStats = {
            userId,
            xp: 0,
            level: 1,
            levelTitle: LEVELS[0].title,
            xpToNextLevel: LEVELS[0].maxXp,
            progressPercent: 0,
        };
        await db.collection(this.collectionName).doc(userId).set(userStats);
        return userStats;
    }

    /**
     * Cập nhật thông tin liên quan đến thành tích của user
     */
    async updateUserStats(userId: string, { xp }: { xp?: number }): Promise<UserStats> {
        const docRef = db.collection(this.collectionName).doc(userId);
        const snap = await docRef.get();
        if (!snap.exists) {
            await this.createUserStats(userId);
        }
        const updateData: Partial<UserStats> = {};

        const currentData = snap.data() ?? { xp: 0, level: 1, badges: [] };
        if (xp !== undefined) {
            const totalXp = currentData.xp + xp;
            updateData.xp = totalXp;
            const newLevel = [...LEVELS].reverse().find(l => totalXp >= l.minXp) ?? LEVELS[0];
            updateData.level = newLevel.level;
            updateData.xpToNextLevel = newLevel.maxXp - totalXp;
            updateData.progressPercent = ((totalXp - newLevel.minXp) / (newLevel.maxXp - newLevel.minXp)) * 100;
            updateData.levelTitle = newLevel.title;
        }

        if (Object.keys(updateData).length > 0) {
            await docRef.update(updateData);
        }

        const doc = await docRef.get();
        return { userId, ...doc.data() } as UserStats;
    }
}
