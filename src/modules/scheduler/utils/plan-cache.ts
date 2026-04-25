import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as http from 'http';
import { getDataConnect } from 'firebase-admin/data-connect';
import { 
    upsertPlanCache, 
    getPlanCache, 
    deletePlanCache, 
    updateDayScores, 
    updateUsedCategories,
    connectorConfig
} from '@dataconnect/admin-generated';

/**
 * PlanCacheHelper: Bộ nhớ đệm (Cache) bền vững lưu tại PostgreSQL (Data Connect).
 * Giúp duy trì dữ liệu lịch trình ngay cả khi restart server và hỗ trợ đa người dùng.
 */
interface CachedPlanData {
    rawRestaurants: any[];       // Danh sách quán đã lọc sơ bộ
    orderedPlan: any[];          // Kết quả phân cụm (đã được sắp xếp theo ngày)
    mealBudgetConfig: any;       // Cấu hình ngân sách từng bữa
    preferences: any;            // Sở thích người dùng
    usedCategories: string[];    // Các loại món đã chọn (tránh trùng lặp giữa các ngày)
    dayScores: Record<number, any[]>; // Lưu trữ quán đã chấm điểm theo ngày: dayIndex -> scoredRestaurants
    updatedAt: string;           // ISO Timestamp từ Data Connect
}

@Injectable()
export class PlanCacheHelper {
    private readonly TTL = 20 * 60 * 1000; // 20 phút
    private readonly isLocal = process.env.NODE_ENV !== 'production';
    private dcUrl = 'http://127.0.0.1:9399/v1/projects/smart-tourism-abf26/locations/asia-southeast1/services/smart-tourism-abf26-service/connectors/example';
    private agent = new http.Agent({ keepAlive: false });

    /**
     * Helper gọi Emulator trực tiếp qua HTTP REST để né lỗi Auth Credentials của Admin SDK
     */
    private async executeEmulator(operationType: 'query' | 'mutation', operationName: string, variables: any) {
        const url = `${this.dcUrl}:execute${operationType === 'mutation' ? 'Mutation' : 'Query'}`;
        const res = await axios.post(url, { operationName, variables }, { httpAgent: this.agent });
        if (res.data.errors && res.data.errors.length > 0) {
            throw new Error(JSON.stringify(res.data.errors));
        }
        return res.data;
    }

    // Lưu trữ dữ liệu chuẩn bị vào Cache (Data Connect)
    async set(guestId: string, data: Omit<CachedPlanData, 'updatedAt' | 'dayScores'>) {
        try {
            const payload = {
                guestId,
                rawRestaurants: data.rawRestaurants,
                orderedPlan: data.orderedPlan,
                mealBudgetConfig: data.mealBudgetConfig,
                preferences: data.preferences,
                usedCategories: data.usedCategories,
                dayScores: {}
            };

            if (this.isLocal) {
                await this.executeEmulator('mutation', 'UpsertPlanCache', payload);
            } else {
                const dc = getDataConnect(connectorConfig);
                await upsertPlanCache(dc, payload);
            }
        } catch (error) {
            console.error('[PlanCache] Lỗi ghi dữ liệu lên Data Connect:', error.message || error);
        }
    }

    // Lấy dữ liệu từ Cache (Data Connect)
    async get(guestId: string): Promise<CachedPlanData | null> {
        try {
            let entry: any = null;
            if (this.isLocal) {
                const res = await this.executeEmulator('query', 'GetPlanCache', { guestId });
                entry = res.data?.planCache;
            } else {
                const dc = getDataConnect(connectorConfig);
                const res = await getPlanCache(dc, { guestId });
                entry = res.data?.planCache;
            }
            
            if (!entry) return null;

            // Kiểm tra xem dữ liệu còn sống (TTL) không
            const updatedAt = new Date(entry.updatedAt).getTime();
            if (Date.now() - updatedAt > this.TTL) {
                if (this.isLocal) {
                    await this.executeEmulator('mutation', 'DeletePlanCache', { guestId });
                } else {
                    const dc = getDataConnect(connectorConfig);
                    await deletePlanCache(dc, { guestId });
                }
                return null;
            }

            return entry as unknown as CachedPlanData;
        } catch (error) {
            console.error('[PlanCache] Lỗi đọc dữ liệu từ Data Connect:', error.message || error);
            return null;
        }
    }

    // Lưu kết quả quán đã chấm điểm AI cho một ngày cụ thể
    async saveDayScores(guestId: string, dayIndex: number, scoredRestaurants: any[]) {
        try {
            let entry: any = null;
            if (this.isLocal) {
                const res = await this.executeEmulator('query', 'GetPlanCache', { guestId });
                entry = res.data?.planCache;
            } else {
                const dc = getDataConnect(connectorConfig);
                const res = await getPlanCache(dc, { guestId });
                entry = res.data?.planCache;
            }
            
            if (entry) {
                const dayScores = (entry.dayScores as Record<number, any[]>) || {};
                dayScores[dayIndex] = scoredRestaurants;
                
                if (this.isLocal) {
                    await this.executeEmulator('mutation', 'UpdateDayScores', { guestId, dayScores });
                } else {
                    const dc = getDataConnect(connectorConfig);
                    await updateDayScores(dc, { guestId, dayScores });
                }
            }
        } catch (error) {
            console.error('[PlanCache] Lỗi cập nhật DayScores lên Data Connect:', error.message || error);
        }
    }

    // Lấy danh sách quán đã chấm điểm của một ngày từ Cache
    async getDayScores(guestId: string, dayIndex: number): Promise<any[] | null> {
        try {
            let entry: any = null;
            if (this.isLocal) {
                const res = await this.executeEmulator('query', 'GetPlanCache', { guestId });
                entry = res.data?.planCache;
            } else {
                const dc = getDataConnect(connectorConfig);
                const res = await getPlanCache(dc, { guestId });
                entry = res.data?.planCache;
            }
            
            if (entry && entry.dayScores) {
                const dayScores = entry.dayScores as Record<number, any[]>;
                if (dayScores[dayIndex]) {
                    return dayScores[dayIndex];
                }
            }
            return null;
        } catch (error) {
            console.error('[PlanCache] Lỗi lấy DayScores từ Data Connect:', error.message || error);
            return null;
        }
    }

    // Cập nhật danh sách món ăn đã dùng để ngày tiếp theo không bị trùng
    async updateUsedCategories(guestId: string, categories: string[]) {
        try {
            if (this.isLocal) {
                await this.executeEmulator('mutation', 'UpdateUsedCategories', { guestId, usedCategories: categories });
            } else {
                const dc = getDataConnect(connectorConfig);
                await updateUsedCategories(dc, { guestId, usedCategories: categories });
            }
        } catch (error) {
            console.error('[PlanCache] Lỗi cập nhật UsedCategories lên Data Connect:', error.message || error);
        }
    }

    // Dọn dẹp các cache đã quá hạn
    async cleanup() {
        // Logic dọn dẹp hàng loạt có thể thực hiện bằng SQL trực tiếp nếu cần
    }
}
