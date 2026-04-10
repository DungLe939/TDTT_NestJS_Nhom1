import { Injectable } from '@nestjs/common';
import { db } from '../../providers/firebase.provider';
import { fetchNearbyRestaurants } from './utils/fetch-locationiq';
import { fakeRemainingData } from './utils/fake-data';
import axios from 'axios';
import { ClusteringHelper } from './algorithms/k-means';
import { ScoringHelper } from './utils/scoring';
import { RawFilterHelper } from './utils/raw-filter';
import { PlanCacheHelper } from './utils/plan-cache';
import { calculateDistance } from './algorithms/haversine';

@Injectable()
export class SchedulerService {
    constructor(
        private readonly rawFilterHelper: RawFilterHelper,
        private readonly clusteringHelper: ClusteringHelper,
        private readonly scoringHelper: ScoringHelper,
        private readonly planCacheHelper: PlanCacheHelper
    ) { }

    // Hàm lấy tọa độ từ Keyword 
    private async getCoordsFromKeyword(keyword: string) {
        try {
            //Gọi api tới openstreetmap
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(keyword)}&format=json&limit=1`;
            const response = await axios.get(url, {
                headers: { 'User-Agent': 'Smart-Tourism-App-HCMUS' } // Nominatim yêu cầu User-Agent
            });

            const data = response.data;
            if (data && data.length > 0) {
                return {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon),
                };
            }
            return null;
        } catch (error) {
            console.error("Lỗi Geocoding:", error);
            return null;
        }
    }

    // Hàm lấy danh sách gợi ý địa điểm (Autocomplete)
    async getLocationSuggestions(keyword: string) {
        try {
            // Gọi api tới openstreetmap với giới hạn 5 kết quả tại VN
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(keyword)}&format=json&limit=5&countrycodes=vn`;
            const response = await axios.get(url, {
                headers: { 'User-Agent': 'Smart-Tourism-App-HCMUS' }
            });

            const data = response.data;
            if (data && data.length > 0) {
                return data.map((item: any) => ({
                    name: item.display_name,
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lon)
                }));
            }
            return [];
        } catch (error) {
            console.error("Lỗi Autocomplete:", error);
            return [];
        }
    }

    //Hàm quét dữ liệu các quán ăn và lưu vào database
    // được gọi từ endpoint: /schedule/searchLocation
    async processSearchLocation(keyword: string, guestId: string) {
        // lấy tọa độ từ keyword
        const coords = await this.getCoordsFromKeyword(keyword);
        if (!coords) return null;

        const { lat, lng } = coords;

        // Xóa dữ liệu cũ của guest này trong Firestore => tránh phình to DB
        const batch = db.batch();
        const oldDocs = await db.collection('restaurants')
            .where('guest_id', '==', guestId)
            .get();

        oldDocs.forEach((doc) => batch.delete(doc.ref));

        // Lấy dữ liệu quán ăn từ locationiq
        const rawData = await fetchNearbyRestaurants(lat, lng);

        // Fake dữ liệu cho đủ Schema
        const fullData = fakeRemainingData(rawData, guestId);

        // Lưu vào Firestore
        fullData.forEach((item) => {
            const docRef = db.collection('restaurants').doc();
            batch.set(docRef, item);
        });

        await batch.commit();

        return {
            data: fullData,
            coords: coords
        };
    }

    //Hàm tạo lịch trình các quán ăn phù hợp
    // Được gọi từ endpoint: /schedule/generatePlan
    async createTravelPlan(body: any, guest_id: string) {
        const {
            budget, //tổng ngân sách
            currentLocation,  // tọa độ địa điểm du lịch 
            preferences,  // sở thích/dị ứng
            travelDays  //số ngày đi du lịch dự kiến
        } = body;

        // Phân bổ ngân sách theo từng buổi
        const dailyBudget = budget / travelDays;
        const mealBudgetConfig = {
            breakfast: dailyBudget * 0.2, // 20% cho bữa sáng
            lunch: dailyBudget * 0.3,   // 30% cho bữa trưa
            dinner: dailyBudget * 0.5    // 50% cho bữa tối
        };

        // Xác định maxPriceRange (dựa trên ngân sách bữa tối vì bữa tối chiếm 50% ngân sách của ngày)
        let globalMaxPriceRange = 2;
        if (mealBudgetConfig.dinner > 200000) globalMaxPriceRange = 3;

        // Lọc thô (Raw Filter)
        const rawRestaurants = await this.rawFilterHelper.rawData(currentLocation, globalMaxPriceRange, guest_id, travelDays);

        if (!rawRestaurants || rawRestaurants.length === 0) {
            return {
                info: { totalBudget: budget, days: travelDays, suggestedMealBudget: mealBudgetConfig },
                count: 0,
                plan: []
            };
        }

        // Chia cụm (Clustering)
        const orderedPlan = this.clusteringHelper.clusteringStep(rawRestaurants, travelDays, currentLocation);

        // Lập lịch trình tổng thể 
        const { plan: finalPlanRaw, snackCandidates } = await this.scoringHelper.generateFinalPlan(orderedPlan, mealBudgetConfig, preferences);

        // Bơm đầy đủ dữ liệu theo RestaurantDto để gửi về Frontend
        const detailedPlan = finalPlanRaw.map(dayPlan => {
            const enrichedMeals = {};
            const sessions = ['breakfast', 'lunch', 'dinner'];

            for (const session of sessions) {
                const aiChoice = dayPlan.meals[session];

                if (!aiChoice) continue; // Chống crash hệ thống nếu ngày hôm đó AI hoặc Thuật toán chưa chọn được món

                // Tìm quán gốc trong danh sách ban đầu dựa trên ID
                const originalData = rawRestaurants.find(r => r.id === aiChoice.id);

                if (originalData) {
                    enrichedMeals[session] = {
                        // Thông tin từ AI (Món ăn cụ thể và lý do)
                        dish: aiChoice.dish,
                        price: aiChoice.price,
                        reason: aiChoice.reason,
                        category: aiChoice.category,
                        time: aiChoice.time,
                        type: 'main', // Mặc định là bữa chính

                        // Thông tin gốc từ RestaurantDto (Dữ liệu cố định)
                        id: originalData.id,
                        name: originalData.name,
                        address: originalData.address || "Địa chỉ đang cập nhật",
                        location: originalData.location,
                        priceRange: originalData.priceRange,
                        rating: originalData.rating || 4.0,
                        openingHours: (originalData.openingHours && typeof originalData.openingHours === 'object')
                            ? `${originalData.openingHours.open}-${originalData.openingHours.close}`
                            : (originalData.openingHours || "07:00-22:00"),
                        menu: originalData.menu,
                        guest_id: originalData.guest_id
                    };
                } else {
                    enrichedMeals[session] = aiChoice;
                }
            }

            return {
                day: dayPlan.day,
                meals: enrichedMeals
            };
        });

        // Kết quả cuối cùng trả về cho Client
        return {
            success: true,
            info: {
                totalBudget: budget,
                days: travelDays,
                suggestedMealBudget: mealBudgetConfig
            },
            count: rawRestaurants.length,
            plan: detailedPlan, //lộ trình
            snackCandidates: snackCandidates  //danh sách các quán ăn có món ăn vặt tiềm năng
        };
    }

    /**
     * preparePlanData: Bước chuẩn bị (Raw Filter + Clustering) trong luồng Streaming.
     * Phương thức này lọc dữ liệu từ Firestore và phân cụm quán ăn, sau đó lưu kết quả
     * vào RAM Cache để các bước generateDayPlan tiếp theo có thể truy xuất ngay lập tức.
     */
    async preparePlanData(body: any, guestId: string) {
        const { budget, currentLocation, preferences, travelDays } = body;
        console.log(`[PreparePlanData] Payload:`, { budget, travelDays, guestId });

        if (!currentLocation || !currentLocation.lat || !currentLocation.lng) {
            throw new Error("Dữ liệu vị trí (currentLocation) không hợp lệ hoặc bị thiếu.");
        }

        // Tính toán cấu hình ngân sách
        const dailyBudget = budget / travelDays;
        const mealBudgetConfig = {
            breakfast: dailyBudget * 0.2,
            lunch: dailyBudget * 0.3,
            dinner: dailyBudget * 0.5
        };

        let globalMaxPriceRange = 2;
        if (mealBudgetConfig.dinner > 200000) globalMaxPriceRange = 3;

        console.log(`[PreparePlanData] Đang gọi RawFilterHelper...`);
        // Lọc thô dữ liệu từ Firestore (Theo ý bạn: Vẫn dùng DB để quét quán ban đầu)
        const rawRestaurants = await this.rawFilterHelper.rawData(currentLocation, globalMaxPriceRange, guestId, travelDays);

        if (!rawRestaurants || rawRestaurants.length === 0) {
            console.log(`[PreparePlanData] Không tìm thấy quán nào.`);
            return { success: false, message: 'Không tìm thấy quán ăn phù hợp tại khu vực này.' };
        }

        console.log(`[PreparePlanData] Tìm thấy ${rawRestaurants.length} quán. Đang phân cụm...`);
        // Thực hiện phân cụm (Clustering) quán ăn theo số ngày đi
        const orderedPlan = this.clusteringHelper.clusteringStep(rawRestaurants, travelDays, currentLocation);

        console.log(`[PreparePlanData] Phân cụm xong. Đang lưu vào RAM Cache...`);
        // LƯU KẾT QUẢ VÀO RAM CAHCE: Để các lượt gọi sau không phải tính lại bước này
        this.planCacheHelper.set(guestId, {
            rawRestaurants,
            orderedPlan,
            mealBudgetConfig,
            preferences,
            usedCategories: []
        });

        console.log(`[PreparePlanData] Hoàn tất.`);
        return {
            success: true,
            totalDays: travelDays,
            info: { totalBudget: budget, suggestedMealBudget: mealBudgetConfig },
            count: rawRestaurants.length
        };
    }

    /**
     * createSingleDayPlan: Tạo lịch trình cho một ngày cụ thể (Dùng cho Streaming).
     * Frontend gọi hàm này lặp lại cho từng ngày (0, 1, 2...) để hiển thị kết quả dần dần.
     */
    async createSingleDayPlan(guestId: string, dayIndex: number) {
        const cache = this.planCacheHelper.get(guestId);
        if (!cache) {
            throw new Error("Lỗi: Phiên chuẩn bị dữ liệu đã hết hạn hoặc không tồn tại. Vui lòng thử lại.");
        }

        const dayPlan = cache.orderedPlan[dayIndex];
        if (!dayPlan) {
            throw new Error(`Lỗi: Không tìm thấy dữ liệu cho ngày thứ ${dayIndex + 1}.`);
        }

        // Gọi logic ScoringHelper kết hợp với AI (Gemini) để chọn quán cho ngày này
        const result = await this.scoringHelper.generateSingleDayPlan(
            dayPlan,
            cache.mealBudgetConfig,
            cache.preferences,
            cache.usedCategories
        );

        // Cập nhật danh sách loại món đã ăn để ngày hôm sau AI không chọn trùng
        this.planCacheHelper.updateUsedCategories(guestId, result.newUsedCategories);

        // LƯU KẾT QUẢ ĐÃ CHẤM ĐIỂM VÀO CACHE: Để phục vụ tính năng "Đổi món" (Swap Meal)
        // Việc này giúp tránh việc phải gọi lại AI Gemini cực kỳ tốn kém và chậm chạp.
        this.planCacheHelper.saveDayScores(guestId, dayIndex, result.scoredRestaurants);

        return {
            day: dayIndex + 1,
            meals: result.dayResult.meals,
            snackCandidates: result.snackCandidates
        };
    }

    //Hàm tạo đường đi ngắn nhất giữa 2 điểm
    // Gọi từ endpoint: /schedule/route
    async getShortestPath(userLat: number, userLng: number, destLat: number, destLng: number) {
        try {
            // OSRM API: lng,lat;lng,lat
            const url = `http://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${destLng},${destLat}?overview=full&geometries=geojson`;
            const response = await axios.get(url);

            if (response.data && response.data.routes && response.data.routes.length > 0) {
                const route = response.data.routes[0];
                return {
                    distance: route.distance,
                    duration: route.duration,
                    geometry: route.geometry,
                };
            }
            return null;
        } catch (error) {
            console.error("OSRM Routing Error:", error);
            return null;
        }
    }

    /**
     * getSwapOptions: Lấy danh sách các món ăn thay thế cho một bữa ăn cụ thể.
     */
    async getSwapOptions(guestId: string, dayIndex: number, mealType: string, userLat?: number, userLng?: number) {
        const cache = this.planCacheHelper.get(guestId);
        if (!cache) return { success: false, message: "Session expired" };

        const scoredRestaurants = this.planCacheHelper.getDayScores(guestId, dayIndex);
        if (!scoredRestaurants) return { success: false, message: "Chưa có dữ liệu chấm điểm cho ngày này. Vui lòng tạo lịch trình trước." };

        const sortedRestaurants = [...scoredRestaurants].sort((a, b) => {
            const scoreA = typeof a.scores?.[mealType] === 'object' ? a.scores[mealType].score : (a.scores?.[mealType] ?? 0);
            const scoreB = typeof b.scores?.[mealType] === 'object' ? b.scores[mealType].score : (b.scores?.[mealType] ?? 0);
            return scoreB - scoreA;
        }).slice(0, 20);

        const refLat = userLat || cache.orderedPlan[dayIndex]?.cluster?.centroid[1];
        const refLng = userLng || cache.orderedPlan[dayIndex]?.cluster?.centroid[0];

        const dishMap = new Map<string, any>();

        sortedRestaurants.forEach(res => {
            const resScore = typeof res.scores?.[mealType] === 'object' ? res.scores[mealType].score : (res.scores?.[mealType] ?? 0);
            const dist = (refLat && refLng)
                ? calculateDistance(refLat, refLng, res.location.coordinates[1], res.location.coordinates[0])
                : 0;

            res.menu?.forEach((item: any) => {
                const existing = dishMap.get(item.name);

                const shouldReplace = !existing ||
                    (resScore > existing.resScore) ||
                    (resScore === existing.resScore && dist < existing.distance);

                if (shouldReplace) {
                    const original = cache.orderedPlan[dayIndex]?.cluster?.restaurants.find(r => r.id === res.id);
                    dishMap.set(item.name, {
                        ...res,
                        address: res.address || original?.address,
                        location: res.location || original?.location,
                        openingHours: res.openingHours || original?.openingHours,
                        dish: item.name,
                        name: res.restaurantName || res.name,
                        price: item.price,
                        resScore: resScore,
                        distance: dist
                    });
                }
            });
        });

        const finalOptions = Array.from(dishMap.values())
            .sort((a, b) => {
                if (b.resScore !== a.resScore) return b.resScore - a.resScore;
                return a.distance - b.distance;
            })
            .slice(0, 30);

        return {
            success: true,
            options: finalOptions
        };
    }
}