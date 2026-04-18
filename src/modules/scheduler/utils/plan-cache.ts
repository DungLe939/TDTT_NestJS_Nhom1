import { Injectable } from '@nestjs/common';
import { db } from '../../../providers/firebase.provider';

/**
 * PlanCacheHelper: Bộ nhớ đệm (Cache) bền vững lưu tại Firestore.
 * Giúp duy trì dữ liệu lịch trình ngay cả khi restart server và hỗ trợ đa người dùng.
 */
interface CachedPlanData {
    rawRestaurants: any[];       // Danh sách quán đã lọc sơ bộ
    orderedPlan: any[];          // Kết quả phân cụm (đã được sắp xếp theo ngày)
    mealBudgetConfig: any;       // Cấu hình ngân sách từng bữa
    preferences: any;            // Sở thích người dùng
    usedCategories: string[];    // Các loại món đã chọn (tránh trùng lặp giữa các ngày)
    dayScores: Record<number, any[]>; // Lưu trữ quán đã chấm điểm theo ngày: dayIndex -> scoredRestaurants
    createdAt: number;
}

@Injectable()
export class PlanCacheHelper {
    private readonly collectionName = 'plan_caches';
    private readonly TTL = 20 * 60 * 1000; // 20 phút

    // Lưu trữ dữ liệu chuẩn bị vào Cache (Firestore)
    async set(guestId: string, data: Omit<CachedPlanData, 'createdAt' | 'dayScores'>) {
        try {
            const cacheData: CachedPlanData = {
                ...data,
                dayScores: {},
                createdAt: Date.now()
            };
            await db.collection(this.collectionName).doc(guestId).set(cacheData);
        } catch (error) {
            console.error('[PlanCache] Lỗi ghi dữ liệu lên Firestore:', error.message);
        }
    }

    // Lấy dữ liệu từ Cache (Firestore)
    async get(guestId: string): Promise<CachedPlanData | null> {
        try {
            const doc = await db.collection(this.collectionName).doc(guestId).get();
            if (!doc.exists) return null;

            const entry = doc.data() as CachedPlanData;

            // Kiểm tra xem dữ liệu còn sống (TTL) không
            if (Date.now() - entry.createdAt > this.TTL) {
                await db.collection(this.collectionName).doc(guestId).delete();
                return null;
            }
            return entry;
        } catch (error) {
            console.error('[PlanCache] Lỗi đọc dữ liệu từ Firestore:', error.message);
            return null;
        }
    }

    // Lưu kết quả quán đã chấm điểm AI cho một ngày cụ thể
    async saveDayScores(guestId: string, dayIndex: number, scoredRestaurants: any[]) {
        try {
            const docRef = db.collection(this.collectionName).doc(guestId);
            const doc = await docRef.get();
            if (doc.exists) {
                const entry = doc.data() as CachedPlanData;
                entry.dayScores[dayIndex] = scoredRestaurants;
                await docRef.update({ dayScores: entry.dayScores });
            }
        } catch (error) {
            console.error('[PlanCache] Lỗi cập nhật DayScores lên Firestore:', error.message);
        }
    }

    // Lấy danh sách quán đã chấm điểm của một ngày từ Cache
    async getDayScores(guestId: string, dayIndex: number): Promise<any[] | null> {
        try {
            const doc = await db.collection(this.collectionName).doc(guestId).get();
            if (doc.exists) {
                const entry = doc.data() as CachedPlanData;
                if (entry.dayScores && entry.dayScores[dayIndex]) {
                    return entry.dayScores[dayIndex];
                }
            }
            return null;
        } catch (error) {
            console.error('[PlanCache] Lỗi lấy DayScores từ Firestore:', error.message);
            return null;
        }
    }

    // Cập nhật danh sách món ăn đã dùng để ngày tiếp theo không bị trùng
    async updateUsedCategories(guestId: string, categories: string[]) {
        try {
            await db.collection(this.collectionName).doc(guestId).update({
                usedCategories: categories
            });
        } catch (error) {
            console.error('[PlanCache] Lỗi cập nhật UsedCategories lên Firestore:', error.message);
        }
    }

    // Dọn dẹp các cache đã quá hạn (Thực thi khi có yêu cầu mới hoặc định kỳ)
    // Lưu ý: Trong bản lite này, chúng ta chủ yếu dọn dẹp trong hàm get()
    async cleanup() {
        // Có thể mở rộng thêm logic dọn dẹp hàng loạt tại đây nếu cần
    }
}
