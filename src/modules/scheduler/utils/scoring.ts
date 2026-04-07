import { Injectable } from '@nestjs/common';
import { GeminiScoringHelper } from './gemini-scoring';
import { SortingHelper } from '../algorithms/sorting';
import { FinalPlanDay } from '../dto/final-plan.dto';
import { GeminiGenerateScheduleHelper } from './gemini-generate-schelude';

@Injectable()
export class ScoringHelper {
    constructor(
        private readonly geminiScoring: GeminiScoringHelper,
        private readonly sortingHelper: SortingHelper,
        private readonly geminiGenerateScheduleHelper: GeminiGenerateScheduleHelper
    ) { }

    // async generateFinalPlan(orderedPlan: any[], mealBudgetConfig: any, preferences: any) {
    //     // Thu thập tất cả quán ăn từ các ngày và chấm điểm sơ bộ
    //     let allPotentialRestaurants: any = [];

    //     for (const dayPlan of orderedPlan) {
    //         const scored = await this.geminiScoring.scoreRestaurantsWithAI(
    //             dayPlan.cluster.restaurants,
    //             preferences,
    //             mealBudgetConfig
    //         );
    //         // Gắn thêm tag day để AI biết quán này thuộc khu vực của ngày nào
    //         const tagged = scored.map(res => ({ ...res, areaDay: dayPlan.day }));
    //         allPotentialRestaurants.push(...tagged);
    //     }

    //     // Lấy Top quán có điểm trung bình các buổi cao nhất để giảm nhiễu cho AI
    //     const topRestaurants = allPotentialRestaurants
    //         .sort((a: any, b: any) => {
    //             const avgA = (a.scores.breakfast + a.scores.lunch + a.scores.dinner) / 3;
    //             const avgB = (b.scores.breakfast + b.scores.lunch + b.scores.dinner) / 3;
    //             return avgB - avgA;
    //         })
    //     // .slice(0, orderedPlan.length * 10);

    //     // Gọi Gemini lần 2 để "Lập lịch trình tổng thể"
    //     const finalPlan = await this.geminiGenerateScheduleHelper.finalizeScheduleWithAI(
    //         topRestaurants,
    //         preferences,
    //         mealBudgetConfig,
    //         orderedPlan.length
    //     );

    //     return finalPlan;
    // }

    async generateFinalPlan(orderedPlan: any[], mealBudgetConfig: any, preferences: any) {
        const finalSchedule: any = [];
        const usedCategories = new Set<string>(); // Global track: Toàn hành trình

        for (let i = 0; i < orderedPlan.length; i++) {
            const usedRestaurantsInDay = new Set<string>(); // Local track: Quán ăn trong ngày
            const usedCategoriesInDay = new Set<string>();  // Local track: Loại món trong ngày (Chìa khóa sửa lỗi)

            const dayPlan = orderedPlan[i];

            const scoredRestaurants = await this.geminiScoring.scoreRestaurantsWithAI(
                dayPlan.cluster.restaurants,
                preferences,
                mealBudgetConfig
            );

            const meals = ['breakfast', 'lunch', 'dinner'];
            const dayMealsResult: any = {};

            for (const meal of meals) {
                const targetBudget = mealBudgetConfig[meal];

                // Sắp xếp quán theo điểm của buổi đó
                const sortedRestaurants = [...scoredRestaurants].sort((a, b) =>
                    (b.scores?.[meal] ?? 0) - (a.scores?.[meal] ?? 0)
                );

                let selectedDish: any = null;
                let selectedRestaurant: any = null;

                /**
                 * ĐỊNH NGHĨA CÁC TẦNG ƯU TIÊN (Levels)
                 */
                const strategyLevels = [
                    // Level 1: "Cực phẩm" (Món mới toàn chuyến + Quán mới hôm nay + Giá chênh lệch +-20%)
                    (d: any, res: any) => {
                        const cat = d.category?.toLowerCase().trim();
                        return cat && !usedCategories.has(cat) &&
                            !usedRestaurantsInDay.has(res.id) &&
                            d.price >= targetBudget * 0.8 && d.price <= targetBudget * 1.2;
                    },

                    // Level 2: "Đổi vị" (Món mới toàn chuyến + Giá nới lỏng +-40%)
                    (d: any, res: any) => {
                        const cat = d.category?.toLowerCase().trim();
                        return cat && !usedCategories.has(cat) &&
                            d.price >= targetBudget * 0.6 && d.price <= targetBudget * 1.4;
                    },

                    // Level 3: "Ưu tiên món mới" (Món mới toàn chuyến + Bất kể giá/quán)
                    (d: any, res: any) => {
                        const cat = d.category?.toLowerCase().trim();
                        return cat && !usedCategories.has(cat);
                    },

                    // Level 4: "Vòng lặp an toàn" (Cho phép món ĐÃ ĂN HÔM QUA, nhưng HÔM NAY chưa ăn + Quán mới)
                    (d: any, res: any) => {
                        const cat = d.category?.toLowerCase().trim();
                        return cat && !usedCategoriesInDay.has(cat) &&
                            !usedRestaurantsInDay.has(res.id) &&
                            d.name !== dayMealsResult['breakfast']?.dish &&
                            d.name !== dayMealsResult['lunch']?.dish;
                    },

                    // Level 5: "Cứu vãn" (Chỉ cần không trùng chính xác tên món với bữa liền trước trong ngày)
                    (d: any, res: any) => {
                        return d.name !== dayMealsResult['breakfast']?.dish &&
                            d.name !== dayMealsResult['lunch']?.dish;
                    }
                ];

                // Duyệt qua từng tầng chiến lược
                for (let levelIndex = 0; levelIndex < strategyLevels.length; levelIndex++) {
                    const checkStrategy = strategyLevels[levelIndex];
                    const isFinalLevel = levelIndex === strategyLevels.length - 1;

                    for (const restaurant of sortedRestaurants) {
                        // Bỏ qua quán bị đánh giá âm, TRỪ KHI đang ở Level 5 (phải lấy bằng được món)
                        if (!isFinalLevel && (restaurant.scores?.[meal] ?? -999) < 0) continue;

                        const dish = restaurant.menu?.find((d: any) => checkStrategy(d, restaurant));

                        if (dish) {
                            selectedDish = dish;
                            selectedRestaurant = restaurant;
                            break;
                        }
                    }
                    if (selectedDish) break; // Đã tìm thấy ở level này thì thoát vòng lặp strategy
                }

                // CHIẾN LƯỢC TỐI THƯỢNG: Tránh rỗng dữ liệu bằng mọi giá
                if (!selectedDish && sortedRestaurants.length > 0) {
                    // 1. Lấy tối đa top 20 quán có điểm cao nhất của buổi này
                    const top20Restaurants = sortedRestaurants.slice(0, 20);

                    // 2. Random 1 quán bất kỳ trong Top 20
                    const randomFallbackRestaurant = top20Restaurants[Math.floor(Math.random() * top20Restaurants.length)];

                    if (randomFallbackRestaurant && randomFallbackRestaurant.menu?.length > 0) {
                        // Xác định tên món của bữa liền kề trước đó để tránh trùng lặp
                        let previousDishName = null;
                        if (meal === 'lunch') previousDishName = dayMealsResult['breakfast']?.dish;
                        if (meal === 'dinner') previousDishName = dayMealsResult['lunch']?.dish;

                        // Lọc ra các món KHÔNG trùng với bữa trước
                        let validDishes = randomFallbackRestaurant.menu.filter((d: any) => d.name !== previousDishName);

                        // Nếu lọc xong mà hết món (ví dụ quán chỉ bán 1 món và vừa ăn xong), thì đành lấy lại toàn bộ menu
                        if (validDishes.length === 0) {
                            validDishes = randomFallbackRestaurant.menu;
                        }

                        // 3. Chọn món 
                        validDishes.sort((a: any, b: any) => (b.score || 0) - (a.score || 0));

                        selectedDish = validDishes[0]; // Lấy món cao điểm nhất n)
                        selectedRestaurant = randomFallbackRestaurant;

                        selectedDish.fallbackReason = `Được chọn ngẫu nhiên từ Top 20 quán tốt nhất để đảm bảo lịch trình.`;
                    }
                }

                // Ghi nhận dữ liệu nếu tìm thấy
                if (selectedRestaurant && selectedDish) {
                    usedRestaurantsInDay.add(selectedRestaurant.id);

                    if (selectedDish.category) {
                        const normalizedCat = selectedDish.category.toLowerCase().trim();
                        usedCategories.add(normalizedCat);       // Khóa Global
                        usedCategoriesInDay.add(normalizedCat);  // Khóa Local
                    }

                    dayMealsResult[meal] = {
                        id: selectedRestaurant.id,
                        name: selectedRestaurant.name,
                        dish: selectedDish.name,
                        price: selectedDish.price,
                        category: selectedDish.category,
                        reason: `Được hệ thống chọn dựa trên điểm số (${selectedRestaurant.scores[meal] || 0}đ) và chiến lược đa dạng hóa món ăn.`
                    };
                }
            }

            finalSchedule.push({
                day: i + 1,
                meals: dayMealsResult
            });
        }

        return finalSchedule;
    }
}