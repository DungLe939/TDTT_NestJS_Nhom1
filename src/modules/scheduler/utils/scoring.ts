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

    async generateFinalPlan(orderedPlan: any[], mealBudgetConfig: any, preferences: any) {
        const finalSchedule: any = [];
        const snackCandidates: any[] = [];
        const usedCategories = new Set<string>();

        for (let i = 0; i < orderedPlan.length; i++) {
            const usedRestaurantsInDay = new Set<string>();
            const usedCategoriesInDay = new Set<string>();

            const dayPlan = orderedPlan[i];

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

            // Nếu không lấy được từ gemini
            if (!scoredRestaurants || scoredRestaurants.length === 0) {
                scoredRestaurants = dayPlan.cluster.restaurants.map((res: any) => ({
                    id: res.id,
                    restaurantName: res.name,
                    menu: res.menu.map((m: any) => {
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
                    openingHours: res.openingHours && typeof res.openingHours === 'object'
                        ? `${res.openingHours.open}-${res.openingHours.close}`
                        : (res.openingHours || "07:00-22:00")
                }));
            }

            // Thu thập Snack Candidates từ danh sách đã chấm điểm
            scoredRestaurants.forEach(res => {
                const snacksInRes = res.menu?.filter((m: any) => m.isSnack === true);
                if (snacksInRes && snacksInRes.length > 0) {
                    snackCandidates.push({
                        restaurantId: res.id,
                        restaurantName: res.restaurantName,
                        location: dayPlan.cluster.restaurants.find((r: any) => r.id === res.id)?.location,
                        openingHours: (res.openingHours && typeof res.openingHours === 'object')
                            ? `${res.openingHours.open}-${res.openingHours.close}`
                            : (res.openingHours || "07:00-22:00"),
                        snacks: snacksInRes
                    });
                }
            });

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
                        return cat && !usedCategories.has(cat) &&
                            !usedRestaurantsInDay.has(res.id) &&
                            d.price >= targetBudget * 0.8 && d.price <= targetBudget * 1.2;
                    },
                    (d: any, res: any) => {
                        const cat = d.category?.toLowerCase().trim();
                        return cat && !usedCategories.has(cat) &&
                            d.price >= targetBudget * 0.6 && d.price <= targetBudget * 1.4;
                    },
                    (d: any, res: any) => {
                        const cat = d.category?.toLowerCase().trim();
                        return cat && !usedCategories.has(cat);
                    },
                    (d: any, res: any) => {
                        const cat = d.category?.toLowerCase().trim();
                        return cat && !usedCategoriesInDay.has(cat) &&
                            !usedRestaurantsInDay.has(res.id) &&
                            dayMealsResult['breakfast']?.dish !== d.name &&
                            dayMealsResult['lunch']?.dish !== d.name;
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
            plan: finalSchedule,
            snackCandidates: snackCandidates
        };
    }
}