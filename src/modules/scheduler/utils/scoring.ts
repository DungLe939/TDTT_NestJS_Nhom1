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
    private readonly geminiGenerateScheduleHelper: GeminiGenerateScheduleHelper,
  ) {}

  /**
   * generateFinalPlan: Hàm điều phối chính để tạo lịch trình ăn uống hoàn chỉnh.
   * Kết hợp logic chấm điểm từ Gemini AI và các quy tắc lọc của hệ thống.
   */
  async generateFinalPlan(
    orderedPlan: any[],
    mealBudgetConfig: any,
    preferences: any,
  ) {
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
         */
        scoredRestaurants = await this.geminiScoring.scoreRestaurantsWithAI(
          dayPlan.cluster.restaurants,
          preferences,
          mealBudgetConfig,
        );
      } catch (e) {
        console.error('Lỗi khi chấm điểm với Gemini:', e);
      }

      // FALLBACK: Nếu AI lỗi hoặc không trả về kết quả
      if (!scoredRestaurants || scoredRestaurants.length === 0) {
        scoredRestaurants = dayPlan.cluster.restaurants.map((res: any) => ({
          id: res.id,
          restaurantName: res.name,
          address: res.address,
          location: res.location,
          rating: res.rating || 4.2,
          priceRange: res.priceRange || 2,
          menu: (res.menu || []).map((m: any) => {
            const nameLower = m.name.toLowerCase();
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
          scores: {
            breakfast: { score: Math.floor(Math.random() * 50) + 50, suggestedTime: "08:00" },
            lunch: { score: Math.floor(Math.random() * 50) + 50, suggestedTime: "12:30" },
            dinner: { score: Math.floor(Math.random() * 50) + 50, suggestedTime: "19:00" }
          },
          openingHours: res.openingHours
        }));
      }

      // BƯỚC 2: TRÍCH XUẤT SNACKS
      scoredRestaurants.forEach(res => {
        const snacksInRes = res.menu?.filter((m: any) => m.isSnack === true);
        if (snacksInRes && snacksInRes.length > 0) {
          const original = dayPlan.cluster.restaurants.find((r: any) => r.id === res.id);
          snackCandidates.push({
            restaurantId: res.id,
            restaurantName: res.restaurantName || res.name,
            address: res.address || original?.address,
            location: res.location || original?.location,
            rating: res.rating || original?.rating || 4.2,
            priceRange: res.priceRange || original?.priceRange || 2,
            openingHours: res.openingHours || original?.openingHours || { open: "07:00", close: "22:00" },
            menu: res.menu || original?.menu,
            snacks: snacksInRes
          });
        }
      });

      // BƯỚC 3: CHỌN MÓN CHO 3 BỮA CHÍNH
      const meals = ['breakfast', 'lunch', 'dinner'];
      const dayMealsResult: any = {};

      for (const meal of meals) {
        const targetBudget = mealBudgetConfig[meal];

        const sortedRestaurants = [...scoredRestaurants].sort((a, b) => {
          const scoreA = typeof a.scores?.[meal] === 'object' ? a.scores[meal].score : (a.scores?.[meal] ?? 0);
          const scoreB = typeof b.scores?.[meal] === 'object' ? b.scores[meal].score : (b.scores?.[meal] ?? 0);
          return scoreB - scoreA;
        });

        let selectedDish: any = null;
        let selectedRestaurant: any = null;

        const strategyLevels = [
          (d: any, res: any) => {
            const cat = d.category?.toLowerCase().trim();
            return cat && !usedCategories.has(cat) && !usedRestaurantsInDay.has(res.id) &&
              d.price >= targetBudget * 0.8 && d.price <= targetBudget * 1.2;
          },
          (d: any, res: any) => {
            const cat = d.category?.toLowerCase().trim();
            return cat && !usedCategories.has(cat) && d.price >= targetBudget * 0.6 && d.price <= targetBudget * 1.4;
          },
          (d: any, res: any) => {
            const cat = d.category?.toLowerCase().trim();
            return cat && !usedCategories.has(cat);
          },
          (d: any, res: any) => {
            const cat = d.category?.toLowerCase().trim();
            return cat && !usedCategoriesInDay.has(cat) && !usedRestaurantsInDay.has(res.id) &&
              dayMealsResult['breakfast']?.dish !== d.name && dayMealsResult['lunch']?.dish !== d.name;
          },
          (d: any, res: any) => {
            const previousDishes = Object.values(dayMealsResult).map((m: any) => m.dish);
            return !previousDishes.includes(d.name);
          }
        ];

        for (let levelIndex = 0; levelIndex < strategyLevels.length; levelIndex++) {
          const checkStrategy = strategyLevels[levelIndex];
          const isFinalLevel = levelIndex === strategyLevels.length - 1;

          for (const restaurant of sortedRestaurants) {
            const currentScore = typeof restaurant.scores?.[meal] === 'object' ? restaurant.scores[meal].score : (restaurant.scores?.[meal] ?? -999);
            if (!isFinalLevel && currentScore < 0) continue;

            const dish = restaurant.menu?.find((d: any) => checkStrategy(d, restaurant));
            if (dish) {
              selectedDish = dish;
              selectedRestaurant = restaurant;
              break;
            }
          }
          if (selectedDish) break;
        }

        // BƯỚC DỰ PHÒNG CUỐI CÙNG
        if (!selectedDish && sortedRestaurants.length > 0) {
          const top20Restaurants = sortedRestaurants.slice(0, 20);
          const randomFallbackRestaurant = top20Restaurants[Math.floor(Math.random() * top20Restaurants.length)];

          if (randomFallbackRestaurant && randomFallbackRestaurant.menu?.length > 0) {
            const previousDishes = Object.values(dayMealsResult).map((m: any) => m.dish);
            let validDishes = randomFallbackRestaurant.menu.filter((d: any) => !previousDishes.includes(d.name));
            if (validDishes.length === 0) validDishes = randomFallbackRestaurant.menu;
            validDishes.sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
            selectedDish = validDishes[0];
            selectedRestaurant = randomFallbackRestaurant;
          }
        }

        if (selectedRestaurant && selectedDish) {
          usedRestaurantsInDay.add(selectedRestaurant.id);
          if (selectedDish.category) {
            const normalizedCat = selectedDish.category.toLowerCase().trim();
            usedCategories.add(normalizedCat);
            usedCategoriesInDay.add(normalizedCat);
          }

          let suggestedTime = "08:00";
          if (typeof selectedRestaurant.scores?.[meal] === 'object' && selectedRestaurant.scores[meal].suggestedTime) {
            suggestedTime = selectedRestaurant.scores[meal].suggestedTime;
          } else {
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
            reason: selectedDish.fallbackReason || `Được hệ thống chọn dựa trên chiến lược đa dạng hóa món ăn.`,
            address: selectedRestaurant.address || dayPlan.cluster.restaurants.find((r: any) => r.id === selectedRestaurant.id)?.address,
            location: selectedRestaurant.location || dayPlan.cluster.restaurants.find((r: any) => r.id === selectedRestaurant.id)?.location,
            openingHours: selectedRestaurant.openingHours,
            rating: selectedRestaurant.rating || 4.2,
            priceRange: selectedRestaurant.priceRange || 2,
            menu: selectedRestaurant.menu
          };
        }
      }

      finalSchedule.push({
        day: i + 1,
        meals: dayMealsResult
      });
    }

    return {
      plan: finalSchedule,
      snackCandidates: snackCandidates,
    };
  }

  /**
   * generateSingleDayPlan: Tạo lịch trình cho một ngày duy nhất (Streaming Mode).
   */
  async generateSingleDayPlan(
    dayPlan: any,
    mealBudgetConfig: any,
    preferences: any,
    existingUsedCategories: string[]
  ) {
    const usedCategories = new Set<string>(existingUsedCategories);
    const usedRestaurantsInDay = new Set<string>();
    const usedCategoriesInDay = new Set<string>();
    const snackCandidates: any[] = [];

    let scoredRestaurants: any[] = [];
    try {
      scoredRestaurants = await this.geminiScoring.scoreRestaurantsWithAI(
        dayPlan.cluster.restaurants,
        preferences,
        mealBudgetConfig
      );
    } catch (e) {
      console.error("Lỗi khi chấm điểm với Gemini:", e);
    }

    if (!scoredRestaurants || scoredRestaurants.length === 0) {
      scoredRestaurants = dayPlan.cluster.restaurants.map((res: any) => ({
        id: res.id,
        restaurantName: res.name,
        address: res.address,
        location: res.location,
        rating: res.rating || 4.2,
        priceRange: res.priceRange || 2,
        menu: (res.menu || []).map((m: any) => ({
          name: m.name,
          price: m.price,
          category: (m.name.split(" ")[0] || "Khác").toLowerCase(),
          score: Math.floor(Math.random() * 50) + 50
        })),
        scores: {
          breakfast: { score: Math.floor(Math.random() * 50) + 50 },
          lunch: { score: Math.floor(Math.random() * 50) + 50 },
          dinner: { score: Math.floor(Math.random() * 50) + 50 }
        },
        openingHours: res.openingHours
      }));
    }

    scoredRestaurants.forEach(res => {
      const snacksInRes = res.menu?.filter((m: any) => {
        const nameLower = m.name?.toLowerCase() || "";
        return nameLower.includes("cafe") || nameLower.includes("trà") ||
          nameLower.includes("bánh") || nameLower.includes("kem") ||
          nameLower.includes("ốc") || nameLower.includes("chè");
      });
      if (snacksInRes && snacksInRes.length > 0) {
        const original = dayPlan.cluster.restaurants.find((r: any) => r.id === res.id);
        snackCandidates.push({
          restaurantId: res.id,
          restaurantName: res.restaurantName || res.name,
          address: res.address || original?.address,
          location: res.location || original?.location,
          rating: res.rating || original?.rating || 4.2,
          priceRange: res.priceRange || original?.priceRange || 2,
          openingHours: res.openingHours || original?.openingHours || { open: "07:00", close: "22:00" },
          menu: res.menu || original?.menu,
          snacks: snacksInRes
        });
      }
    });

    const meals = ['breakfast', 'lunch', 'dinner'];
    const dayMealsResult: any = {};
    const alternatives: any = { breakfast: [], lunch: [], dinner: [] };

    for (const meal of meals) {
      const targetBudget = mealBudgetConfig[meal];
      const sortedRestaurants = [...scoredRestaurants].sort((a, b) => {
        const scoreA = typeof a.scores?.[meal] === 'object' ? a.scores[meal].score : (a.scores?.[meal] ?? 0);
        const scoreB = typeof b.scores?.[meal] === 'object' ? b.scores[meal].score : (b.scores?.[meal] ?? 0);
        return scoreB - scoreA;
      });

      alternatives[meal] = sortedRestaurants.slice(0, 10).map(res => {
        const top5Dishes = [...(res.menu || [])]
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .slice(0, 5);
        const original = dayPlan.cluster.restaurants.find(r => r.id === res.id);
        return {
          id: res.id,
          name: res.restaurantName || res.name,
          address: original?.address || "Địa chỉ đang cập nhật",
          location: original?.location,
          rating: original?.rating || 4.2,
          score: typeof res.scores?.[meal] === 'object' ? res.scores[meal].score : (res.scores?.[meal] ?? 0),
          openingHours: original?.openingHours || "07:00-22:00",
          menu: top5Dishes
        };
      });

      let selectedDish: any = null;
      let selectedRestaurant: any = null;

      const strategyLevels = [
        (d: any, res: any) => {
          const cat = d.category?.toLowerCase() || "";
          return cat && !usedCategories.has(cat) && !usedRestaurantsInDay.has(res.id) &&
            d.price >= targetBudget * 0.7 && d.price <= targetBudget * 1.3;
        },
        (d: any, res: any) => !usedCategories.has(d.category?.toLowerCase() || ""),
        (d: any, res: any) => true
      ];

      for (const checkStrategy of strategyLevels) {
        for (const restaurant of sortedRestaurants) {
          const dish = restaurant.menu?.find((d: any) => checkStrategy(d, restaurant));
          if (dish) {
            selectedDish = dish;
            selectedRestaurant = restaurant;
            break;
          }
        }
        if (selectedDish) break;
      }

      if (selectedRestaurant && selectedDish) {
        usedRestaurantsInDay.add(selectedRestaurant.id);
        if (selectedDish.category) usedCategories.add(selectedDish.category.toLowerCase().trim());
        const original = dayPlan.cluster.restaurants.find((r: any) => r.id === selectedRestaurant.id);
        dayMealsResult[meal] = {
          id: selectedRestaurant.id,
          name: selectedRestaurant.restaurantName || selectedRestaurant.name,
          dish: selectedDish.name,
          price: selectedDish.price,
          category: selectedDish.category,
          time: meal === 'breakfast' ? "08:00" : (meal === 'lunch' ? "12:30" : "19:00"),
          type: 'main',
          reason: "Dựa trên tiêu chí ngon bổ rẻ và sở thích cá nhân của bạn.",
          address: original?.address || "Địa chỉ đang cập nhật",
          location: original?.location,
          openingHours: original?.openingHours,
          rating: original?.rating || 4.2,
          priceRange: original?.priceRange || 2,
          menu: original?.menu || selectedRestaurant.menu
        };
      }
    }

    return {
      dayResult: { meals: dayMealsResult, alternatives },
      snackCandidates,
      newUsedCategories: Array.from(usedCategories),
      scoredRestaurants: scoredRestaurants
    };
  }
}
