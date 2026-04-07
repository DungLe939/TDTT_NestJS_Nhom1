import { Injectable } from '@nestjs/common';
import { db } from '../../providers/firebase.provider';
import { fetchNearbyRestaurants } from './utils/fetch-locationiq';
import { fakeRemainingData } from './utils/fake-data';
import axios from 'axios';
import { ClusteringHelper } from './algorithms/k-means';
import { ScoringHelper } from './utils/scoring';
import { RawFilterHelper } from './utils/raw-filter';

@Injectable()
export class SchedulerService {
    constructor(
        private readonly rawFilterHelper: RawFilterHelper,
        private readonly clusteringHelper: ClusteringHelper,
        private readonly scoringHelper: ScoringHelper
    ) { }

    // Hàm lấy tọa độ từ Keyword 
    private async getCoordsFromKeyword(keyword: string) {
        try {
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

    async processSearchLocation(keyword: string, guestId: string) {
        // lấy tọa độ từ keyword
        const coords = await this.getCoordsFromKeyword(keyword);
        if (!coords) return null;

        const { lat, lng } = coords;

        // Xóa dữ liệu cũ của guest này trong Firestore
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

    async createTravelPlan(body: any, guest_id: string) {
        const { budget, currentLocation, preferences, travelDays } = body;

        // Phân bổ ngân sách theo từng buổi
        const dailyBudget = budget / travelDays;
        const mealBudgetConfig = {
            breakfast: dailyBudget * 0.2, // 20% cho bữa sáng
            lunch: dailyBudget * 0.3,   // 30% cho bữa trưa
            dinner: dailyBudget * 0.5    // 50% cho bữa tối
        };

        // Xác định maxPriceRange (Range 2 hoặc 3 dựa trên ngân sách bữa tối)
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

        // Chấm điểm và lên kế hoạch cuối cùng (Scoring)
        const finalPlanRaw = await this.scoringHelper.generateFinalPlan(orderedPlan, mealBudgetConfig, preferences);

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

                        // Thông tin gốc từ RestaurantDto (Dữ liệu cố định)
                        id: originalData.id,
                        name: originalData.name,
                        address: originalData.address || "Địa chỉ đang cập nhật",
                        location: originalData.location,
                        priceRange: originalData.priceRange,
                        rating: originalData.rating || 4.0,
                        openingHours: originalData.openingHours,
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
            plan: detailedPlan,
        };
    }

    async getShortestPath(userLat: number, userLng: number, destLat: number, destLng: number) {
        try {
            // OSRM API: lng,lat;lng,lat
            const url = `http://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${destLng},${destLat}?overview=full&geometries=geojson`;
            const response = await axios.get(url);

            if (response.data && response.data.routes && response.data.routes.length > 0) {
                const route = response.data.routes[0];
                return {
                    distance: route.distance, // mét
                    duration: route.duration, // giây
                    geometry: route.geometry, // GeoJSON LineString
                };
            }
            return null;
        } catch (error) {
            console.error("Lỗi OSRM Routing:", error);
            return null;
        }
    }
}