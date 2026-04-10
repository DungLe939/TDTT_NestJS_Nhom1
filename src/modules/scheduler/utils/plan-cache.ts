import { Injectable } from '@nestjs/common';

/**
 * PlanCacheHelper: Bộ nhớ đệm (Cache) trên RAM Server.
 * Dùng để lưu trữ tạm thời kết quả phân cụm quán ăn (Clustering) 
 * giữa bước preparePlan và bước generateDayPlan. 
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
    private cache = new Map<string, CachedPlanData>();
    private readonly TTL = 20 * 60 * 1000; // 20 phút (Đủ để người dùng khám phá lịch trình)

    // Lưu trữ dữ liệu chuẩn bị vào Cache
    set(guestId: string, data: Omit<CachedPlanData, 'createdAt' | 'dayScores'>) {
        this.cache.set(guestId, {
            ...data,
            dayScores: {},
            createdAt: Date.now()
        });
        this.cleanup();
    }

    // Lấy dữ liệu từ Cache
    get(guestId: string): CachedPlanData | null {
        const entry = this.cache.get(guestId);
        if (!entry) return null;

        // Kiểm tra xem dữ liệu còn sống (TTL) không
        if (Date.now() - entry.createdAt > this.TTL) {
            this.cache.delete(guestId);
            return null;
        }
        return entry;
    }

    // Lưu kết quả quán đã chấm điểm AI cho một ngày cụ thể
    saveDayScores(guestId: string, dayIndex: number, scoredRestaurants: any[]) {
        const entry = this.cache.get(guestId);
        if (entry) {
            entry.dayScores[dayIndex] = scoredRestaurants;
        }
    }

    // Lấy danh sách quán đã chấm điểm của một ngày từ Cache
    getDayScores(guestId: string, dayIndex: number): any[] | null {
        const entry = this.cache.get(guestId);
        if (entry && entry.dayScores[dayIndex]) {
            return entry.dayScores[dayIndex];
        }
        return null;
    }

    // Cập nhật danh sách món ăn đã dùng để ngày tiếp theo không bị trùng
    updateUsedCategories(guestId: string, categories: string[]) {
        const entry = this.cache.get(guestId);
        if (entry) {
            entry.usedCategories = categories;
        }
    }

    // Dọn dẹp các cache đã quá hạn
    private cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.createdAt > this.TTL) {
                this.cache.delete(key);
            }
        }
    }
}
