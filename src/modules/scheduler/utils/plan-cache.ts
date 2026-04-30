import { Injectable } from '@nestjs/common';

/**
 * PlanCacheHelper: Bộ nhớ đệm lưu dữ liệu lịch trình trong RAM của server.
 *
 * - Lưu trực tiếp vào Map trong RAM → cực nhanh, không cần kết nối ngoài.
 * - TTL: 20 phút (tự xóa sau khi quá hạn).
 * - Phù hợp cho demo và development: mỗi lần restart server cache sẽ reset,
 *   nhưng trong một phiên thì hoạt động hoàn hảo.
 *
 * Nếu cần persistence sau này, có thể dùng Redis hoặc bật lại Data Connect.
 */

export interface CachedPlanData {
    rawRestaurants: any[];       // Danh sách quán đã lọc sơ bộ
    orderedPlan: any[];          // Kết quả phân cụm (đã được sắp xếp theo ngày)
    mealBudgetConfig: any;       // Cấu hình ngân sách từng bữa
    preferences: any;            // Sở thích người dùng
    usedCategories: string[];    // Các loại món đã chọn (tránh trùng lặp giữa các ngày)
    dayScores: Record<number, any[]>; // Lưu trữ quán đã chấm điểm theo ngày
    updatedAt: number;           // Timestamp (ms) để tính TTL
}

@Injectable()
export class PlanCacheHelper {
    private readonly TTL = 20 * 60 * 1000; // 20 phút tính bằng ms

    // Map lưu cache trong RAM: guestId → CachedPlanData
    private readonly memCache = new Map<string, CachedPlanData>();

    /**
     * Kiểm tra và xóa cache đã hết hạn
     */
    private isExpired(entry: CachedPlanData): boolean {
        return Date.now() - entry.updatedAt > this.TTL;
    }

    /**
     * set: Lưu dữ liệu chuẩn bị vào in-memory cache.
     * Được gọi sau bước preparePlan (rawFilter + clustering).
     */
    async set(guestId: string, data: Omit<CachedPlanData, 'updatedAt' | 'dayScores'>) {
        try {
            this.memCache.set(guestId, {
                ...data,
                dayScores: {},
                updatedAt: Date.now(),
            });
        } catch (error) {

        }
    }

    /**
     * get: Lấy dữ liệu từ in-memory cache.
     * Trả về null nếu không tìm thấy hoặc đã hết hạn TTL.
     */
    async get(guestId: string): Promise<CachedPlanData | null> {
        try {
            const entry = this.memCache.get(guestId);
            if (!entry) {

                return null;
            }

            if (this.isExpired(entry)) {

                this.memCache.delete(guestId);
                return null;
            }

            return entry;
        } catch (error) {

            return null;
        }
    }

    /**
     * saveDayScores: Lưu kết quả quán đã chấm điểm AI cho một ngày cụ thể.
     * Dùng cho tính năng "Đổi món" — tránh gọi lại AI Gemini.
     */
    async saveDayScores(guestId: string, dayIndex: number, scoredRestaurants: any[]) {
        try {
            const entry = this.memCache.get(guestId);
            if (entry) {
                entry.dayScores[dayIndex] = scoredRestaurants;
                entry.updatedAt = Date.now();
            } else {

            }
        } catch (error) {

        }
    }

    /**
     * getDayScores: Lấy danh sách quán đã chấm điểm của một ngày từ cache.
     * Dùng cho endpoint swapOptions.
     */
    async getDayScores(guestId: string, dayIndex: number): Promise<any[] | null> {
        try {
            const entry = this.memCache.get(guestId);
            if (!entry || this.isExpired(entry)) {

                return null;
            }
            const result = entry.dayScores?.[dayIndex] ?? null;
            return result;
        } catch (error) {

            return null;
        }
    }

    /**
     * updateUsedCategories: Cập nhật danh sách loại món đã ăn.
     * Giúp AI không chọn trùng category giữa các ngày.
     */
    async updateUsedCategories(guestId: string, categories: string[]) {
        try {
            const entry = this.memCache.get(guestId);
            if (entry) {
                entry.usedCategories = categories;
                entry.updatedAt = Date.now();
            }
        } catch (error) {

        }
    }

    /**
     * cleanup: Dọn dẹp tất cả các cache đã hết hạn.
     * Có thể gọi định kỳ nếu cần giải phóng RAM.
     */
    async cleanup() {
        let cleaned = 0;
        this.memCache.forEach((entry, guestId) => {
            if (this.isExpired(entry)) {
                this.memCache.delete(guestId);
                cleaned++;
            }
        });
        if (cleaned > 0) {
            // Cleanup finished
        }
    }
}
