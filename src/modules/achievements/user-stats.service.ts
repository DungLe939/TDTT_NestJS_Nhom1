import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../providers/firebase.provider';
import { UserStats, UserBadge } from './interfaces/achievement.interface';

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
            return {
                userId,
                xp: 0,
                level: 1,
                badges: [],
            };
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
            badges: [],
        };
        const docRef = await db.collection(this.collectionName).add(userStats);
        return { ...userStats, userId: docRef.id, };
    }

    /**
     * Cập nhật thông tin liên quan đến thành tích của user
     */
    async updateUserStats(userId: string, xp?: number, level?: number, badges?: UserBadge[]): Promise<UserStats> {
        let docRef = db.collection(this.collectionName).doc(userId);
        if (!docRef.exists) {
            docRef = await this.createUserStats(userId);
        }

        const updateData: Partial<UserStats> = {};

        if (xp !== undefined) updateData.xp = xp;
        if (level !== undefined) updateData.level = level;
        if (badges !== undefined) updateData.badges = badges;

        if (Object.keys(updateData).length > 0) {
            await docRef.update(updateData);
        }

        const doc = await docRef.get();
        return { userId, ...doc.data() } as UserStats;
    }
}
