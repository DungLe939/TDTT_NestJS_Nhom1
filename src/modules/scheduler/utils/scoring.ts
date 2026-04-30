import { Injectable } from '@nestjs/common';
import { GeminiScoringHelper } from './gemini-scoring';
import { SortingHelper } from '../algorithms/sorting';

@Injectable()
export class ScoringHelper {
  constructor(
    private readonly geminiScoring: GeminiScoringHelper,
    private readonly sortingHelper: SortingHelper,
  ) { }

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
    // snackCandidates = TẤT CẢ nhà hàng trong tất cả cụm (không lọc theo isSnack nữa)
    const snackCandidates: any[] = [];
    const usedCategories = new Set<string>(); // Lưu các loại món đã ăn để tránh lặp lại suốt hành trình

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
         * AI sẽ chấm điểm dựa trên: Sở thích, Dị ứng, Ngân sách và Loại bữa (Sáng/Trưa/Tối).
         * Gemini trả về điểm 3 bữa cho từng quán → merge với data gốc (category, menu... từ ShopeeFood).
         */
        scoredRestaurants = await this.geminiScoring.scoreRestaurantsWithAI(
          dayPlan.cluster.restaurants,
          preferences,
          mealBudgetConfig,
        );
      } catch (e) {
        console.error('Lỗi khi chấm điểm với Gemini:', e);
      }

      // FALLBACK: Nếu AI lỗi hoặc không trả về kết quả, hệ thống tự tạo điểm ngẫu nhiên.
      // Category và menu lấy thẳng từ data gốc ShopeeFood (không cần AI sinh lại).
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
            // Lấy category từ data ShopeeFood có sẵn, không cần AI sinh lại
            category: m.category || 'Khác',
            imageUrl: m.imageUrl || '',
          })),
          // Điểm ngẫu nhiên để fallback khi AI lỗi
          scores: {
            breakfast: { score: Math.floor(Math.random() * 50) + 50, suggestedTime: '08:00' },
            lunch: { score: Math.floor(Math.random() * 50) + 50, suggestedTime: '12:30' },
            dinner: { score: Math.floor(Math.random() * 50) + 50, suggestedTime: '19:00' },
          },
        }));
      }

      // BƯỚC 2: THU THẬP SNACK CANDIDATES
      // Không lọc theo isSnack nữa — tất cả nhà hàng trong cụm đều là candidates
      // Frontend sẽ tự filter theo category khi user chọn
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

      // BƯỚC 3: CHỌN MÓN CHO 3 BỮA CHÍNH (Sáng, Trưa, Tối)
      const meals = ['breakfast', 'lunch', 'dinner'];
      const dayMealsResult: any = {};

      /**
       * Bộ lọc: Loại bỏ các món KHÔNG PHẢI MÓN ĂN CHÍNH
       * Bao gồm: topping, đồ uống, gia vị, đóng gói
       * LLM đã lọc qua recommendedDish, nhưng fallback strategy vẫn cần filter này
       */
      const NOT_MAIN_DISH_KEYWORDS = [
        // Topping / Phần thêm
        'thêm', 'extra', 'topping', 'phần thêm', 'thêm phần',
        // Nước chấm / Gia vị
        'nước chấm', 'nước tương', 'nước mắm', 'tương ớt',
        'gia vị', 'muối', 'tiêu', 'ớt', 'sa tế',
        // Đóng gói / Dụng cụ
        'bịch', 'gói', 'hộp', 'túi', 'ly', 'khăn lạnh',
        'upsize', 'size', 'nâng cấp',
        // ĐỒ UỐNG
        'coca', 'pepsi', 'sprite', '7up', 'fanta', 'mirinda',
        'nước ngọt', 'nước suối', 'nước khoáng', 'nước lọc',
        'trà đá', 'trà nóng', 'trà xanh', 'trà sữa', 'trà vải', 'trà đào',
        'trà chanh', 'trà gừng', 'trà ô long', 'trà sen',
        'cà phê', 'cafe', 'coffee', 'capuchino', 'latte', 'espresso',
        'sinh tố', 'nước ép', 'smoothie', 'juice',
        'sữa đậu', 'sữa tươi', 'sữa chua', 'yaourt',
        'bia', 'beer', 'rượu', 'wine', 'vodka', 'cocktail',
        'nước dừa', 'dừa tươi',
        // Tráng miệng nhỏ
        'kẹo', 'đá xay', 'đá bào', 'kem', 'flan',
      ];

      /** Kiểm tra xem 1 món có phải MÓN ĂN CHÍNH hay không */
      const isNotMainDish = (dishName: string): boolean => {
        const name = dishName.toLowerCase().trim();
        return NOT_MAIN_DISH_KEYWORDS.some(kw => name.includes(kw));
      };

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

        let selectedDish: any = null;
        let selectedRestaurant: any = null;

        /**
         * ƯU TIÊN 1: Dùng recommendedDish từ LLM
         * Matching LINH HOẠT: dùng includes() thay vì so sánh chính xác
         * Vì LLM có thể trả "Coca Cola" nhưng menu ghi "Nước ngọt Coca-Pepsi"
         */
        for (const restaurant of sortedRestaurants) {
          const mealScore = restaurant.scores?.[meal];
          const recommended = typeof mealScore === 'object' ? mealScore.recommendedDish : null;
          const currentScore = typeof mealScore === 'object' ? mealScore.score : (mealScore ?? 0);

          if (currentScore < 20) continue;
          if (usedRestaurantsInDay.has(restaurant.id)) continue;

          if (recommended && !isNotMainDish(recommended)) {
            const recLower = recommended.toLowerCase().trim();
            // Tìm: exact match HOẶC tên menu chứa tên đề xuất HOẶC ngược lại
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
         * Chỉ chạy khi LLM không đề xuất được món hoặc món đề xuất không tìm thấy.
         */
        if (!selectedDish) {
          const strategyLevels = [
            // Cấp 1: Hoàn hảo - Chưa ăn loại này, chưa ăn quán này, giá chuẩn (+/- 20%)
            (d: any, res: any) => {
              const cat = d.category?.toLowerCase().trim();
              return (
                cat &&
                !usedCategories.has(cat) &&
                !usedRestaurantsInDay.has(res.id) &&
                d.price >= targetBudget * 0.8 &&
                d.price <= targetBudget * 1.2
              );
            },
            // Cấp 2: Nới lỏng ngân sách - 60% đến 140%
            (d: any, res: any) => {
              const cat = d.category?.toLowerCase().trim();
              return (
                cat &&
                !usedCategories.has(cat) &&
                d.price >= targetBudget * 0.6 &&
                d.price <= targetBudget * 1.4
              );
            },
            // Cấp 3: Chỉ cần chưa ăn loại món này
            (d: any, _res: any) => {
              const cat = d.category?.toLowerCase().trim();
              return cat && !usedCategories.has(cat);
            },
            // Cấp 4: Không trùng trong ngày hôm nay
            (d: any, res: any) => {
              const cat = d.category?.toLowerCase().trim();
              return (
                cat &&
                !usedCategoriesInDay.has(cat) &&
                !usedRestaurantsInDay.has(res.id) &&
                dayMealsResult['breakfast']?.dish !== d.name &&
                dayMealsResult['lunch']?.dish !== d.name
              );
            },
            // Cấp 5: Chỉ cần món chưa được chọn trước đó
            (d: any, _res: any) => {
              const previousDishes = Object.values(dayMealsResult).map((m: any) => m.dish);
              return !previousDishes.includes(d.name);
            },
          ];

          for (let levelIndex = 0; levelIndex < strategyLevels.length; levelIndex++) {
            const checkStrategy = strategyLevels[levelIndex];
            const isFinalLevel = levelIndex === strategyLevels.length - 1;

            for (const restaurant of sortedRestaurants) {
              const currentScore =
                typeof restaurant.scores?.[meal] === 'object'
                  ? restaurant.scores[meal].score
                  : (restaurant.scores?.[meal] ?? -999);
              if (!isFinalLevel && currentScore < 0) continue;

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

        // BƯỚC DỰ PHÒNG CUỐI CÙNG: Nếu tất cả strategy đều thất bại
        if (!selectedDish && sortedRestaurants.length > 0) {
          const top20Restaurants = sortedRestaurants.slice(0, 20);
          const randomFallbackRestaurant =
            top20Restaurants[Math.floor(Math.random() * top20Restaurants.length)];

          if (randomFallbackRestaurant && randomFallbackRestaurant.menu?.length > 0) {
            const previousDishes = Object.values(dayMealsResult).map(
              (m: any) => m.dish,
            );
            let validDishes = randomFallbackRestaurant.menu.filter(
              (d: any) => !isNotMainDish(d.name) && !previousDishes.includes(d.name),
            );
            if (validDishes.length === 0) {
              validDishes = randomFallbackRestaurant.menu.filter(
                (d: any) => !isNotMainDish(d.name),
              );
            }
            if (validDishes.length === 0) validDishes = randomFallbackRestaurant.menu;

            validDishes.sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
            selectedDish = validDishes[0];
            selectedRestaurant = randomFallbackRestaurant;
          }
        }

        // GHI NHẬN VÀ CẬP NHẬT TRẠNG THÁI
        if (selectedRestaurant && selectedDish) {
          usedRestaurantsInDay.add(selectedRestaurant.id);

          if (selectedDish.category) {
            const normalizedCat = selectedDish.category.toLowerCase().trim();
            usedCategories.add(normalizedCat);
            usedCategoriesInDay.add(normalizedCat);
          }

          let suggestedTime = '08:00';
          if (
            typeof selectedRestaurant.scores?.[meal] === 'object' &&
            selectedRestaurant.scores[meal].suggestedTime
          ) {
            suggestedTime = selectedRestaurant.scores[meal].suggestedTime;
          } else {
            if (meal === 'lunch') suggestedTime = '12:30';
            if (meal === 'dinner') suggestedTime = '19:00';
          }

          dayMealsResult[meal] = {
            id: selectedRestaurant.id,
            name: selectedRestaurant.restaurantName || selectedRestaurant.name,
            dish: selectedDish.name,
            price: selectedDish.price,
            category: selectedDish.category,
            time: suggestedTime,
            type: 'main',
            reason: `Được hệ thống chọn dựa trên chiến lược đa dạng hóa món ăn.`,
            address:
              selectedRestaurant.address ||
              dayPlan.cluster.restaurants.find(
                (r: any) => r.id === selectedRestaurant.id,
              )?.address,
            location:
              selectedRestaurant.location ||
              dayPlan.cluster.restaurants.find(
                (r: any) => r.id === selectedRestaurant.id,
              )?.location,
            openingHours: selectedRestaurant.openingHours,
            rating: selectedRestaurant.rating || 4.2,
            priceRange: selectedRestaurant.priceRange || 2,
            menu: selectedRestaurant.menu,
          };
        }
      }

      finalSchedule.push({
        day: i + 1,
        meals: dayMealsResult,
      });
    }

    return {
      plan: finalSchedule, // lộ trình 3 bữa chính/ngày
      snackCandidates: snackCandidates, // TẤT CẢ quán trong các cụm (không lọc isSnack)
    };
  }

  // ============================================
  // TẠO LỊCH TRÌNH CHO 1 NGÀY DUY NHẤT (Streaming Mode)
  // ============================================
  async generateSingleDayPlan(
    dayPlan: any,
    mealBudgetConfig: any,
    preferences: any,
    existingUsedCategories: string[],
  ) {
    const usedCategories = new Set<string>(existingUsedCategories);
    const usedRestaurantsInDay = new Set<string>();
    const usedCategoriesInDay = new Set<string>();
    // snackCandidates = TẤT CẢ nhà hàng trong cụm ngày này (không lọc isSnack)
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
      console.error('Lỗi khi chấm điểm với Gemini:', e);
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

    // Thu thập tất cả nhà hàng làm snack candidates (không lọc isSnack)
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
