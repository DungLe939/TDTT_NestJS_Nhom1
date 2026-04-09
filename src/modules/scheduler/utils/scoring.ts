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

    /**
     * generateFinalPlan: Hàm điều phối chính để tạo lịch trình ăn uống hoàn chỉnh.
     * Kết hợp logic chấm điểm từ Gemini AI và các quy tắc lọc của hệ thống.
     */
    async generateFinalPlan(orderedPlan: any[], mealBudgetConfig: any, preferences: any) {
        const finalSchedule: any = []; // Mảng chứa kết quả lịch trình theo từng ngày
        const snackCandidates: any[] = []; // Danh sách các món ăn vặt tiềm năng (Cafe, trà sữa, ốc...)
        const usedCategories = new Set<string>(); // Lưu các loại món đã ăn (vd: Phở, Cơm) để tránh lặp lại suốt hành trình

        for (let i = 0; i < orderedPlan.length; i++) {
            const usedRestaurantsInDay = new Set<string>(); // Tránh ăn trùng quán trong cùng 1 ngày
            const usedCategoriesInDay = new Set<string>(); // Tránh ăn trùng loại món trong cùng 1 ngày

            // Lấy cụm nhà hàng của ngày hiện tại
            const dayPlan = orderedPlan[i];

            let scoredRestaurants: any[] = [];
            try {
                /**
                 * BƯỚC 1: GỌI AI CHẤM ĐIỂM
                 * Gửi danh sách nhà hàng trong cụm của ngày hôm đó cho Gemini AI.
                 * AI sẽ chấm điểm dựa trên: Sở thích, Dị ứng, Ngân sách và Loại món phù hợp với bữa (Sáng/Trưa/Tối).
                 */
                scoredRestaurants = await this.geminiScoring.scoreRestaurantsWithAI(
                    dayPlan.cluster.restaurants,
                    preferences,
                    mealBudgetConfig
                );
            } catch (e) {
                console.error("Lỗi khi chấm điểm với Gemini:", e);
            }

            // FALLBACK: Nếu AI lỗi hoặc không trả về kết quả, hệ thống tự tạo điểm ngẫu nhiên
            // và nhận diện món ăn vặt cơ bản dựa trên từ khóa để không làm gián đoạn luồng xử lý.
            // tất nhiên bước này không phù hợp với thực tiễn nhưng có thể dùng để demo
            // vì api free bị time limit
            if (!scoredRestaurants || scoredRestaurants.length === 0) {
                scoredRestaurants = dayPlan.cluster.restaurants.map((res: any) => ({
                    id: res.id,
                    restaurantName: res.name,
                    menu: res.menu.map((m: any) => {
                        const nameLower = m.name.toLowerCase();

                        //kiểm tra xem có phải món ăn vặt hay không(hỗ trợ tính năng "chọn món ăn phụ")
                        const isSnack = nameLower.includes("cafe") || nameLower.includes("trà") ||
                            nameLower.includes("bánh") || nameLower.includes("kem") ||
                            nameLower.includes("sinh tố") || nameLower.includes("juice") ||
                            nameLower.includes("ốc") || nameLower.includes("nem chua");

                        return {
                            name: m.name,
                            price: m.price,
                            category: (m.name.split(" ")[0] || "Khác").toLowerCase(),
                            isSnack: isSnack,
                            score: Math.floor(Math.random() * 50) + 50
                        };
                    }),
                    //random điểm cho từng buổi ăn
                    scores: {
                        breakfast: { score: Math.floor(Math.random() * 50) + 50, suggestedTime: "08:00" },
                        lunch: { score: Math.floor(Math.random() * 50) + 50, suggestedTime: "12:30" },
                        dinner: { score: Math.floor(Math.random() * 50) + 50, suggestedTime: "19:00" }
                    },
                    openingHours: res.openingHours && typeof res.openingHours === 'object'
                        ? `${res.openingHours.open}-${res.openingHours.close}`
                        : (res.openingHours || "07:00-22:00")
                }));
            }

            // BƯỚC 2: TRÍCH XUẤT SNACKS (ĂN VẶT) - Dùng cho phần "chọn bữa ăn phụ".
            scoredRestaurants.forEach(res => {
              //lấy ra các món ăn vặt theo đánh giá của gemini
                const snacksInRes = res.menu?.filter((m: any) => m.isSnack === true);
                if (snacksInRes && snacksInRes.length > 0) {
                  //lấy ra các trường thông tin: id, tên quán ăn, tọa độ, giờ mở cửa
                    snackCandidates.push({
                        restaurantId: res.id,
                        restaurantName: res.restaurantName,
                        location: dayPlan.cluster.restaurants.find((r: any) => r.id === res.id)?.location,
                        openingHours: (res.openingHours && typeof res.openingHours === 'object')
                            ? `${res.openingHours.open}-${res.openingHours.close}`
                            : (res.openingHours || "07:00-22:00"),
                        snacks: snacksInRes // danh sách các món ăn vặt của cửa hàng này 
                    });
                }
            });

            // BƯỚC 3: CHỌN MÓN CHO 3 BỮA CHÍNH (Sáng, Trưa, Tối)
            const meals = ['breakfast', 'lunch', 'dinner'];
            const dayMealsResult: any = {};

            for (const meal of meals) {
                const targetBudget = mealBudgetConfig[meal];  //ngân sách mỗi bữa ăn

                // Sắp xếp nhà hàng theo điểm số AI đã chấm cho bữa ăn cụ thể này
                const sortedRestaurants = [...scoredRestaurants].sort((a, b) => {
                    const scoreA = typeof a.scores?.[meal] === 'object' ? a.scores[meal].score : (a.scores?.[meal] ?? 0);
                    const scoreB = typeof b.scores?.[meal] === 'object' ? b.scores[meal].score : (b.scores?.[meal] ?? 0);
                    return scoreB - scoreA;
                });

                let selectedDish: any = null;
                let selectedRestaurant: any = null;

                /**
                 * CHIẾN THUẬT CHỌN MÓN (Strategy Levels):
                 * Duyệt từ điều kiện lý tưởng (Cấp 1) đến nới lỏng dần (Cấp 5) để đảm bảo luôn chọn được món.
                 */
                const strategyLevels = [
                    // Cấp 1: Hoàn hảo - Chưa ăn loại này bao giờ, chưa ăn quán này, giá chuẩn (+/- 20%)
                    (d: any, res: any) => {
                        const cat = d.category?.toLowerCase().trim();
                        return cat && !usedCategories.has(cat) && //món này chưa từng ăn trong cả hành trình
                            !usedRestaurantsInDay.has(res.id) &&  //quán này chưa từng ăn trong ngày hôm nay
                            d.price >= targetBudget * 0.8 && d.price <= targetBudget * 1.2; //ngân sách nằm trong khoảng +- 20%
                    },

                    // Cấp 2: Nới lỏng ngân sách - 60% đến 140% ngân sách mục tiêu, chấp nhận trùng quán
                    (d: any, res: any) => {
                        const cat = d.category?.toLowerCase().trim();
                        return cat && !usedCategories.has(cat) && //món này chưa từng ăn trong cả hành trình
                            d.price >= targetBudget * 0.6 && d.price <= targetBudget * 1.4;
                    },

                    // Cấp 3: Ưu tiên sự đa dạng - Chỉ cần chưa ăn loại món này trong cả hành trình, bất chấp giá cả, chấp nhận trùng quán
                    (d: any, res: any) => {
                        const cat = d.category?.toLowerCase().trim();
                        return cat && !usedCategories.has(cat); //món này chưa từng ăn trong cả hành trình
                    },
                    // Cấp 4: Chấp nhận trùng loại món với ngày khác nhưng không trùng món chính xác trong ngày hôm nay
                    (d: any, res: any) => {
                        const cat = d.category?.toLowerCase().trim();
                        return cat && !usedCategoriesInDay.has(cat) &&  //một ngày không ăn món trùng nhau
                            !usedRestaurantsInDay.has(res.id) &&  //một ngày không ăn cùng 1 cửa hàng
                            dayMealsResult['breakfast']?.dish !== d.name &&
                            dayMealsResult['lunch']?.dish !== d.name;
                    },
                    // Cấp 5: Cấp độ cuối cùng - Chỉ cần món này chưa được chọn cho bữa trước đó cùng ngày
                    (d: any, res: any) => {
                        const previousDishes = Object.values(dayMealsResult).map((m: any) => m.dish);
                        return !previousDishes.includes(d.name);
                    }
                ];

                //duyệt qua từng level và tiến hành chọn quán - chọn món
                for (let levelIndex = 0; levelIndex < strategyLevels.length; levelIndex++) {
                    const checkStrategy = strategyLevels[levelIndex];
                    const isFinalLevel = levelIndex === strategyLevels.length - 1;

                    //duyệt qua các nhà hàng trong cụm ngày hôm nay đã được sắp xếp theo điểm số AI cho bữa ăn này
                    for (const restaurant of sortedRestaurants) {
                        const currentScore = typeof restaurant.scores?.[meal] === 'object' ? restaurant.scores[meal].score : (restaurant.scores?.[meal] ?? -999);
                        // Bỏ qua các quán bị AI loại trừ (điểm âm do dị ứng/đóng cửa) trừ khi ở bước cuối cùng.
                        if (!isFinalLevel && currentScore < 0) continue;

                        //kiểm tra có phù hợp với chiên lược lựa chọn của level hiện tại không
                        const dish = restaurant.menu?.find((d: any) => checkStrategy(d, restaurant));

                        if (dish) {
                            selectedDish = dish;
                            selectedRestaurant = restaurant;
                            break;
                        }
                    }
                    if (selectedDish) break;
                }

                // BƯỚC DỰ PHÒNG CUỐI CÙNG: Nếu tất cả strategy đều thất bại, chọn 1 món tốt nhất từ Top 20 quán nhưng không trùng với món ăn bữa ăn trước đó trong ngày.
                // Vì lấy trong Top 20, nên vẫn đảm bảo chất lượng ở mức chấp nhận được, đồng thời tăng khả năng chọn được món hơn là duyệt toàn bộ danh sách.
                if (!selectedDish && sortedRestaurants.length > 0) {
                    const top20Restaurants = sortedRestaurants.slice(0, 20);
                    const randomFallbackRestaurant = top20Restaurants[Math.floor(Math.random() * top20Restaurants.length)];

                    if (randomFallbackRestaurant && randomFallbackRestaurant.menu?.length > 0) {
                        // lấy ra các món ăn trước đó trong ngày
                        const previousDishes = Object.values(dayMealsResult).map((m: any) => m.dish);

                        //lọc ra các món chưa được ăn trong ngày hôm đó mà nằm trong nhà hàng dự phòng ngẫu nhiên này
                        let validDishes = randomFallbackRestaurant.menu.filter((d: any) => !previousDishes.includes(d.name));

                        // Nếu tấc cả món ăn đều đã được ăn trong ngày hôm đó, thì vẫn phải chọn 1 món để đảm bảo có món ăn cho bữa này, nên sẽ không áp dụng thêm điều kiện lọc nào nữa.
                        if (validDishes.length === 0) validDishes = randomFallbackRestaurant.menu;

                        // sắp xếp theo điểm số
                        validDishes.sort((a: any, b: any) => (b.score || 0) - (a.score || 0));

                        //chọn món ăn có điểm số cao nhất
                        selectedDish = validDishes[0];
                        selectedRestaurant = randomFallbackRestaurant;
                    }
                }

                // GHI NHẬN VÀ CẬP NHẬT TRẠNG THÁI
                if (selectedRestaurant && selectedDish) {
                    //lưu vào danh sách các cửa hàng đã ăn trong ngày
                    usedRestaurantsInDay.add(selectedRestaurant.id);

                    if (selectedDish.category) {
                        const normalizedCat = selectedDish.category.toLowerCase().trim();
                        //lưu vào danh sách các món đã ăn trong toàn lịch trình
                        usedCategories.add(normalizedCat);
                        //lưu vào danh sách các quán đã ăn trong ngày
                        usedCategoriesInDay.add(normalizedCat);
                    }

                    // Xác định thời gian ăn gợi ý 
                    let suggestedTime = "08:00";
                    if (typeof selectedRestaurant.scores?.[meal] === 'object' && selectedRestaurant.scores[meal].suggestedTime) {
                        suggestedTime = selectedRestaurant.scores[meal].suggestedTime;
                    } else { //nếu không lấy được từ api gemini thì dùng giờ mặc định => tránh scrash
                        if (meal === 'lunch') suggestedTime = "12:30";
                        if (meal === 'dinner') suggestedTime = "19:00";
                    }

                    dayMealsResult[meal] = {
                        id: selectedRestaurant.id,
                        name: selectedRestaurant.restaurantName || selectedRestaurant.name,
                        dish: selectedDish.name,
                        price: selectedDish.price,
                        category: selectedDish.category,
                        time: suggestedTime,
                        type: 'main',
                        reason: selectedDish.fallbackReason || `Được hệ thống chọn dựa trên chiến lược đa dạng hóa món ăn.`
                    };
                }
            }

            finalSchedule.push({
                day: i + 1,
                meals: dayMealsResult
            });
        }

        return {
            plan: finalSchedule,  //lộ trình 3 bữa chính/ngày
            snackCandidates: snackCandidates //các quán có món ăn vặt được đánh giá cao => hỗ trợ tính năng "chọn bữa ăn phụ"
        };
    }
}