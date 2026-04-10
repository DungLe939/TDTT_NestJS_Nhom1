import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../providers/firebase.provider';
import { ProgressTracker } from './interfaces/achievement.interface';

@Injectable()
export class ProgressTrackerService {
    private readonly logger = new Logger(ProgressTrackerService.name);
    private readonly collectionName = 'progress_trackers';

    /**
     * Lấy tiến độ của user đối với một achievement nào đó
     */
    async getTracker(userId: string, achievementId: string): Promise<ProgressTracker | null> {
        const snapshot = await db.collection(this.collectionName)
            .where('userId', '==', userId)
            .where('achievementId', '==', achievementId)
            .limit(1)
            .get();

        if (snapshot.empty) return null;

        const doc = snapshot.docs[0];
        const data = doc.data();
        return {
            id: doc.id,
            ...data
        } as ProgressTracker;
    }

    /**
     * Tạo tiến độ của user đối với một achievement nào đó
     */
    async createTracker(userId: string, achievementId: string, requiredCount: number): Promise<ProgressTracker> {
        const tracker: ProgressTracker = {
            userId,
            achievementId,
            currentCount: 0,
            requiredCount,
            progressPercent: 0,
            isCompleted: false,
        };

        const docRef = await db.collection(this.collectionName).add(tracker);
        return { ...tracker, id: docRef.id };
    }

    /**
     * Cập nhật tiến độ của user đối với một achievement nào đó
     */
    async updateProgress(trackerId: string, currentCount: number, requiredCount: number): Promise<ProgressTracker> {
        const progressPercent = Math.min(Math.floor((currentCount / requiredCount) * 100), 100);
        const isCompleted = currentCount >= requiredCount;
        const updateData: Partial<ProgressTracker> = {
            currentCount,
            progressPercent,
            isCompleted,
        };

        if (isCompleted) {
            updateData.completedAt = new Date();
        }

        await db.collection(this.collectionName).doc(trackerId).update(updateData);

        const updatedDoc = await db.collection(this.collectionName).doc(trackerId).get();
        return { id: updatedDoc.id, ...updatedDoc.data() } as ProgressTracker;
    }
}

