import { Injectable } from '@nestjs/common';

/**
 * PlanCacheHelper: Bộ nhớ đệm lưu dữ liệu lịch trình trong RAM của server.
 *
 * === PHIÊN BẢN MỚI: IN-MEMORY CACHE ===
 * - Không còn phụ thuộc vào Firebase Data Connect Emulator (port 9399).
 * - Lưu trực tiếp vào Map trong RAM → cực nhanh, không cần kết nối ngoài.
 * - TTL: 20 phút (tự xóa sau khi quá hạn).
 * - Phù hợp cho demo và development: mỗi lần restart server cache sẽ reset,
 *   nhưng trong một phiên thì hoạt động hoàn hảo.
 *
 * Nếu cần persistence sau này, có thể dùng Redis hoặc bật lại Data Connect.
 */

interface CachedPlanData {
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
            console.log(`[PlanCache] ✅ Đã lưu cache cho guest: ${guestId} (${data.rawRestaurants?.length || 0} quán, ${data.orderedPlan?.length || 0} ngày)`);
        } catch (error) {
            console.error('[PlanCache] Lỗi lưu cache:', error.message || error);
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
                console.warn(`[PlanCache] ⚠️ Không tìm thấy cache cho guest: ${guestId}`);
                return null;
            }

            if (this.isExpired(entry)) {
                console.warn(`[PlanCache] ⏰ Cache đã hết hạn cho guest: ${guestId}, xóa và trả về null`);
                this.memCache.delete(guestId);
                return null;
            }

            return entry;
        } catch (error) {
            console.error('[PlanCache] Lỗi đọc cache:', error.message || error);
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
                entry.updatedAt = Date.now(); // Làm mới TTL khi có hoạt động
                console.log(`[PlanCache] ✅ Đã lưu dayScores ngày ${dayIndex} cho guest: ${guestId} (${scoredRestaurants.length} quán)`);
            } else {
                console.warn(`[PlanCache] ⚠️ saveDayScores: Không tìm thấy cache cho guest: ${guestId}`);
            }
        } catch (error) {
            console.error('[PlanCache] Lỗi cập nhật DayScores:', error.message || error);
        }
    }

    /**
     * getDayScores: Lấy danh sách quán đã chấm điểm của một ngày từ cache.
     * Dùng cho endpoint swapOptions.
     */
    async getDayScores(guestId: string, dayIndex: number): Promise<any[] | null> {
        try {
            const entry = this.memCache.get(guestId);
            if (!entry || this.isExpired(entry)) return null;

            return entry.dayScores?.[dayIndex] ?? null;
        } catch (error) {
            console.error('[PlanCache] Lỗi lấy DayScores:', error.message || error);
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
            console.error('[PlanCache] Lỗi cập nhật UsedCategories:', error.message || error);
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
            console.log(`[PlanCache] 🧹 Đã dọn ${cleaned} cache hết hạn. Còn ${this.memCache.size} active.`);
        }
    }
}
