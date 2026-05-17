import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../providers/firebase.provider';
import { ProgressTracker } from './interfaces/achievement.interface';

@Injectable()
export class ProgressTrackerService {
    private readonly logger = new Logger(ProgressTrackerService.name);
    private readonly collectionName = 'progress_trackers';

    /**
     * Lấy tiến độ của user đối với một achievement nào đó.
     * Dùng deterministic doc ID thay vì query để tránh vấn đề race condition.
     */
    async getTracker(userId: string, achievementId: string): Promise<ProgressTracker | null> {
        const docId = `${userId}_${achievementId}`;
        const doc = await db.collection(this.collectionName).doc(docId).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() } as ProgressTracker;
    }

    /**
     * Tạo tiến độ của user đối với một achievement nào đó.
     * Dùng set() với merge:false — idempotent: nếu doc đã tồn tại (race condition) thì
     * lần thứ hai sẽ không ghi đè, Firestore sẽ trả về lỗi mà ta bỏ qua (catch).
     */
    async createTracker(userId: string, achievementId: string, requiredCount: number): Promise<ProgressTracker> {
        const docId = `${userId}_${achievementId}`;
        const tracker: ProgressTracker = {
            userId,
            achievementId,
            currentCount: 0,
            requiredCount,
            progressPercent: 0,
            isCompleted: false,
        };

        const docRef = db.collection(this.collectionName).doc(docId);
        await docRef.set(tracker).catch(() => {
            this.logger.warn(`Tracker ${docId} already exists (concurrent write), skipping create.`);
        });

        return { ...tracker, id: docId };
    }

    /**
     * Cập nhật tiến độ của user đối với một achievement nào đó.
     * trackerId giờ là deterministic key `${userId}_${achievementId}`.
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

        const existingDoc = await db.collection(this.collectionName).doc(trackerId).get();
        const existingData = existingDoc.data() || {};

        return {
            ...existingData,
            ...updateData,
            id: trackerId,
        } as ProgressTracker;
    }
}
