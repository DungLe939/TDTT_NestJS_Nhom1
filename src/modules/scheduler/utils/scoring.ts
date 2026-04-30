import { Injectable } from '@nestjs/common';
import { GeminiScoringHelper } from './gemini-scoring';
import { SortingHelper } from '../algorithms/sorting';

@Injectable()
export class ScoringHelper {
  constructor(
    private readonly geminiScoring: GeminiScoringHelper,
    private readonly sortingHelper: SortingHelper,
  ) { }

  // TẠO LỊCH TRÌNH CHO 1 NGÀY DUY NHẤT (Streaming Mode)
  async generateSingleDayPlan(
    dayPlan: any,
    mealBudgetConfig: any,
    preferences: any,
    existingUsedCategories: string[],
  ) {
    const usedCategories = new Set<string>(existingUsedCategories);
    const usedRestaurantsInDay = new Set<string>();
    const usedCategoriesInDay = new Set<string>();
    // snackCandidates = TẤT CẢ nhà hàng trong cụm ngày này
    const snackCandidates: any[] = [];

    let scoredRestaurants: any[] = [];
    try {
      // Gọi AI (Gemini) chấm điểm — AI chỉ trả scores, menu/category từ data gốc
      scoredRestaurants = await this.geminiScoring.scoreRestaurantsWithAI(
        dayPlan.cluster.restaurants,
        preferences,
        mealBudgetConfig,
      );
    } catch (e) {

    }

    // Fallback: Nếu AI lỗi, dùng điểm ngẫu nhiên + category từ data gốc
    if (!scoredRestaurants || scoredRestaurants.length === 0) {
      scoredRestaurants = dayPlan.cluster.restaurants.map((res: any) => ({
        id: res.id,
        restaurantName: res.name,
        address: res.address,
        location: res.location,
        rating: res.rating || 4.2,
        priceRange: res.priceRange || 2,
        openingHours: res.openingHours,
        menu: (res.menu || []).map((m: any) => ({
          name: m.name,
          price: m.price,
          // Lấy category từ data ShopeeFood có sẵn
          category: m.category || 'Khác',
          imageUrl: m.imageUrl || '',
        })),
        scores: {
          breakfast: { score: Math.floor(Math.random() * 50) + 50, suggestedTime: '08:00' },
          lunch: { score: Math.floor(Math.random() * 50) + 50, suggestedTime: '12:30' },
          dinner: { score: Math.floor(Math.random() * 50) + 50, suggestedTime: '19:00' },
        },
      }));
    }

    // Thu thập tất cả nhà hàng làm snack candidates
    scoredRestaurants.forEach((res) => {
      const original = dayPlan.cluster.restaurants.find(
        (r: any) => r.id === res.id,
      );
      snackCandidates.push({
        restaurantId: res.id,
        restaurantName: res.restaurantName || res.name,
        address: res.address || original?.address,
        location: res.location || original?.location,
        rating: res.rating || original?.rating || 4.2,
        priceRange: res.priceRange || original?.priceRange || 2,
        openingHours: res.openingHours || original?.openingHours || { open: '07:00', close: '22:00' },
        menu: res.menu || original?.menu || [],
      });
    });

    const meals = ['breakfast', 'lunch', 'dinner'];
    const dayMealsResult: any = {};
    const alternatives: any = { breakfast: [], lunch: [], dinner: [] };

    for (const meal of meals) {
      const targetBudget = mealBudgetConfig[meal];
      const sortedRestaurants = [...scoredRestaurants].sort((a, b) => {
        const scoreA =
          typeof a.scores?.[meal] === 'object'
            ? a.scores[meal].score
            : (a.scores?.[meal] ?? 0);
        const scoreB =
          typeof b.scores?.[meal] === 'object'
            ? b.scores[meal].score
            : (b.scores?.[meal] ?? 0);
        return scoreB - scoreA;
      });

      // Gợi ý danh sách 10 quán ăn tốt nhất (để dùng cho tính năng "Đổi quán")
      alternatives[meal] = sortedRestaurants.slice(0, 10).map((res) => {
        const top5Dishes = [...(res.menu || [])]
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .slice(0, 5);

        const original = dayPlan.cluster.restaurants.find(
          (r) => r.id === res.id,
        );

        return {
          id: res.id,
          name: res.restaurantName || res.name,
          address: original?.address || 'Địa chỉ đang cập nhật',
          location: original?.location,
          rating: original?.rating || 4.2,
          score:
            typeof res.scores?.[meal] === 'object'
              ? res.scores[meal].score
              : (res.scores?.[meal] ?? 0),
          openingHours: original?.openingHours || '07:00-22:00',
          menu: top5Dishes,
        };
      });

      let selectedDish: any = null;
      let selectedRestaurant: any = null;

      // Chiến thuật chọn món: Ưu tiên sự đa dạng và nằm trong ngân sách
      const strategyLevels = [
        (d: any, res: any) => {
          const cat = d.category?.toLowerCase() || '';
          return (
            cat &&
            !usedCategories.has(cat) &&
            !usedRestaurantsInDay.has(res.id) &&
            d.price >= targetBudget * 0.7 &&
            d.price <= targetBudget * 1.3
          );
        },
        (d: any, _res: any) =>
          !usedCategories.has(d.category?.toLowerCase() || ''),
        (_d: any, _res: any) => true,
      ];

      // Bộ lọc MÓN KHÔNG PHẢI MÓN CHÍNH — dùng chung logic với generateFinalPlan
      const NOT_MAIN_DISH_KEYWORDS = [
        'thêm', 'extra', 'topping', 'phần thêm', 'thêm phần',
        'nước chấm', 'nước tương', 'nước mắm', 'tương ớt',
        'gia vị', 'muối', 'tiêu', 'ớt', 'sa tế',
        'bịch', 'gói', 'hộp', 'túi', 'ly', 'khăn lạnh',
        'upsize', 'size', 'nâng cấp',
        'coca', 'pepsi', 'sprite', '7up', 'fanta', 'mirinda',
        'nước ngọt', 'nước suối', 'nước khoáng', 'nước lọc',
        'trà đá', 'trà nóng', 'trà xanh', 'trà sữa', 'trà vải', 'trà đào',
        'trà chanh', 'trà gừng', 'trà ô long', 'trà sen',
        'cà phê', 'cafe', 'coffee', 'capuchino', 'latte', 'espresso',
        'sinh tố', 'nước ép', 'smoothie', 'juice',
        'sữa đậu', 'sữa tươi', 'sữa chua', 'yaourt',
        'bia', 'beer', 'rượu', 'wine', 'vodka', 'cocktail',
        'nước dừa', 'dừa tươi',
        'kẹo', 'đá xay', 'đá bào', 'kem', 'flan',
      ];
      const isNotMainDish = (name: string): boolean =>
        NOT_MAIN_DISH_KEYWORDS.some(kw => name.toLowerCase().trim().includes(kw));

      /**
       * ƯU TIÊN 1: Dùng recommendedDish từ LLM (matching linh hoạt)
       */
      for (const restaurant of sortedRestaurants) {
        const mealScore = restaurant.scores?.[meal];
        const recommended = typeof mealScore === 'object' ? mealScore.recommendedDish : null;
        const currentScore = typeof mealScore === 'object' ? mealScore.score : (mealScore ?? 0);

        if (currentScore < 20) continue;
        if (usedRestaurantsInDay.has(restaurant.id)) continue;

        if (recommended && !isNotMainDish(recommended)) {
          const recLower = recommended.toLowerCase().trim();
          const dish = restaurant.menu?.find((d: any) => {
            const dName = d.name?.toLowerCase().trim() || '';
            return (
              !isNotMainDish(d.name) &&
              (dName === recLower || dName.includes(recLower) || recLower.includes(dName))
            );
          });
          if (dish) {
            selectedDish = dish;
            selectedRestaurant = restaurant;
            break;
          }
        }
      }

      /**
       * ƯU TIÊN 2 (FALLBACK): Strategy Levels truyền thống
       */
      if (!selectedDish) {
        for (const checkStrategy of strategyLevels) {
          for (const restaurant of sortedRestaurants) {
            const dish = restaurant.menu?.find((d: any) =>
              !isNotMainDish(d.name) && checkStrategy(d, restaurant),
            );
            if (dish) {
              selectedDish = dish;
              selectedRestaurant = restaurant;
              break;
            }
          }
          if (selectedDish) break;
        }
      }

      if (selectedRestaurant && selectedDish) {
        usedRestaurantsInDay.add(selectedRestaurant.id);
        if (selectedDish.category)
          usedCategories.add(selectedDish.category.toLowerCase().trim());

        const original = dayPlan.cluster.restaurants.find(
          (r: any) => r.id === selectedRestaurant.id,
        );

        dayMealsResult[meal] = {
          id: selectedRestaurant.id,
          name: selectedRestaurant.restaurantName || selectedRestaurant.name,
          dish: selectedDish.name,
          price: selectedDish.price,
          category: selectedDish.category,
          time:
            meal === 'breakfast'
              ? '08:00'
              : meal === 'lunch'
                ? '12:30'
                : '19:00',
          type: 'main',
          reason: 'Dựa trên tiêu chí ngon bổ rẻ và sở thích cá nhân của bạn.',
          address: original?.address || 'Địa chỉ đang cập nhật',
          location: original?.location,
          openingHours: original?.openingHours,
          rating: original?.rating || 4.2,
          priceRange: original?.priceRange || 2,
          menu: original?.menu || selectedRestaurant.menu,
        };
      }
    }

    return {
      dayResult: { meals: dayMealsResult, alternatives },
      snackCandidates,
      newUsedCategories: Array.from(usedCategories),
      scoredRestaurants: scoredRestaurants,
    };
  }
}
