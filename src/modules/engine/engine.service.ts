import { Injectable, Logger } from '@nestjs/common';
import {
  GroupRecommendationDto,
  GroupRecommendationResponseDto,
  DishInfoDto,
} from '../restaurants/dto/group-recommendation.dto';
import { RestaurantsService } from '../restaurants/restaurants.service';
import {
  getGroupBudget,
  getGroupDistanceTolerance,
  getGroupMinRating,
  getGroupAllergies,
  computeIndividualSimilarities,
  aggregateGroupScore,
} from './algorithms/group-aggregation';
import {
  MAX_DISTANCE_KM,
  TOP_K,
  budgetToPriceRange,
  TASTE_DIMENSIONS,
} from './algorithms/scoring';
import { calculateDistance } from '../../utils/haversine.util';
import { vectorizeTags } from '../../utils/vectorize.util';
import { IRestaurant } from '../../shared/interfaces/restaurant.interface';
import { IUser } from '../../shared/interfaces/user.interface';
import { IDish } from '../../shared/interfaces/dish.interface';

@Injectable()
export class EngineService {
  private readonly logger = new Logger(EngineService.name);

  constructor(private readonly restaurantsService: RestaurantsService) {}

  private priceRangeToPrice(range: number): number {
    if (range === 1) return 30000;
    if (range === 3) return 250000;
    return 100000;
  }

  /**
   * Tính gợi ý món ăn cho nhóm.
   * Chuyển đổi restaurant sang dish-based.
   */
  async getGroupRecommendations(
    dto: GroupRecommendationDto,
    guestId: string,
  ): Promise<GroupRecommendationResponseDto> {
    const { users: groupUsers, currentLocation } = dto;

    const allDishes = await this.restaurantsService.findDishesByGuestId(guestId);

    this.logger.log(
      `Đang xử lý gợi ý nhóm: khách=${guestId}, số người=${groupUsers.length}`,
    );

    if (allDishes.length === 0) {
      return {
        totalCandidates: 0,
        filteredCount: 0,
        dishes: [],
      };
    }


    const users: IUser[] = groupUsers.map((u) => ({
      userId: u.userId,
      tasteVector: u.tasteVector,
      budget: u.budget,
      allergies: u.allergies,
      distance_tolerance: u.distance_tolerance,
      min_rating: u.min_rating,
      tags: u.tags,
    }));

    // Tính constraint aggregation
    const groupBudget = getGroupBudget(users);
    const groupDistance = getGroupDistanceTolerance(users, MAX_DISTANCE_KM);
    const groupMinRating = getGroupMinRating(users);
    const groupAllergies = getGroupAllergies(users);

    this.logger.log(`Đang lọc với các ràng buộc: ngân sách=${groupBudget}, khoảng cách=${groupDistance}km`);

    // ---- Filter với relaxation ----
    let filteredDishes = this.filterDishes(
      allDishes,
      currentLocation,
      groupDistance,
      groupBudget,
      groupMinRating,
      groupAllergies,
    );

    // Filtering logic with relaxation options

    // Relaxation logic
    if (filteredDishes.length === 0) {
      this.logger.warn('Bộ lọc nghiêm ngặt không có kết quả → đang nới lỏng (bỏ qua đánh giá)...');
      filteredDishes = this.filterDishes(allDishes, currentLocation, groupDistance, groupBudget, 0, groupAllergies);

      if (filteredDishes.length === 0) {
        this.logger.warn('Vẫn không có kết quả → nới lỏng khoảng cách (gấp 2 lần)...');
        filteredDishes = this.filterDishes(allDishes, currentLocation, groupDistance * 2, groupBudget, 0, groupAllergies);
      }

      if (filteredDishes.length === 0) {
        this.logger.warn('Vẫn không có kết quả → loại bỏ giới hạn ngân sách...');
        filteredDishes = this.filterDishes(allDishes, currentLocation, groupDistance * 3, Infinity, 0, groupAllergies);
      }
    }

    // Tính avg budget của nhóm
    const groupAvgBudget = users.length > 0
      ? users.reduce((sum, u) => sum + (u.budget || 0), 0) / users.length
      : Infinity;

    // Tính avgGroupRating (trung bình rating mong muốn của nhóm)
    const avgGroupMinRating = users.length > 0
      ? users.reduce((sum, u) => sum + (u.min_rating || 3.0), 0) / users.length
      : 3.0;

    // ---- Scoring (Dish-based with POC Pipeline) ----
    const scoredDishes = filteredDishes.map(({ dish, distance }) => {
      // Step 1: Vectorization (nếu dữ liệu DB chưa có vector)
      const dishVector = (dish.restaurant && dish.restaurant.tasteVector && dish.restaurant.tasteVector.length === 7)
        ? dish.restaurant.tasteVector
        : vectorizeTags([...dish.tags, dish.name]);

      // Step 3 & 4: Similarity & Aggregation
      // Tạo một đối tượng IRestaurant tạm thời để dùng với computeIndividualSimilarities
      const tempRestaurant: IRestaurant = {
        ...dish.restaurant!,
        tasteVector: dishVector,
      };

      const individualSims = computeIndividualSimilarities(users, tempRestaurant);
      
      // Aggregation: Kết hợp Average và Least Misery (Min)
      const aggregatedSim = aggregateGroupScore(individualSims, { 
        avgWeight: 0.7, 
        minWeight: 0.3 
      });

      // MatchScore trong công thức: Score = Rating + MatchScore - Distance
      // Chúng ta scale aggregatedSim (0-1) lên thang điểm 10 để có trọng số tốt
      const matchScore = aggregatedSim * 10;

      // Ranking formula từ Engine Logic: Score = Rating + MatchScore - Distance
      const finalScore = dish.rating + matchScore - distance;

      // Xây dựng matchedReasons dựa trên đặc trưng vector (vùng cao nhất)
      const reasons: string[] = [];
      
      // Ngân sách & Khoảng cách
      if (dish.price <= groupAvgBudget) reasons.push('Phù hợp ngân sách nhóm');
      if (distance <= 1.0) reasons.push(`Rất gần (${distance.toFixed(1)} km)`);
      else if (distance <= 3.0) reasons.push(`Gần (${distance.toFixed(1)} km)`);

      // Khẩu vị (Dựa trên similarity)
      if (aggregatedSim > 0.7) {
        reasons.push('Rất hợp khẩu vị nhóm 🔥');
      } else if (aggregatedSim > 0.4) {
        reasons.push('Hợp khẩu vị');
      }

      // Rating
      if (dish.rating >= 4.5) reasons.push('Rating xuất sắc ⭐');

      return {
        dish,
        finalScore,
        distance,
        matchedReasons: reasons,
      };
    });

    scoredDishes.sort((a, b) => b.finalScore - a.finalScore);

    // Normalize finalScore → matchPercentage (0-100)
    const maxScore = scoredDishes.length > 0 ? scoredDishes[0].finalScore : 1;
    const minScore = scoredDishes.length > 0 ? scoredDishes[scoredDishes.length - 1].finalScore : 0;
    const scoreRange = maxScore - minScore || 1;

    const topDishes = scoredDishes.slice(0, TOP_K).map(item => {
      const dish = item.dish;
      // Map finalScore vào [50, 100]%
      const matchPct = Math.round(50 + ((item.finalScore - minScore) / scoreRange) * 50);

      return {
        id: dish.id,
        name: dish.name,
        price: dish.price,
        rating: dish.rating,
        tags: dish.tags,
        image_url: dish.image_url,
        description: dish.description,
        restaurant: {
          id: dish.restaurant!.id || '',
          name: dish.restaurant!.name,
          cover_image: dish.restaurant!.cover_image,
        },
        finalScore: Math.round(item.finalScore * 100) / 100,
        matchPercentage: Math.min(100, Math.max(0, matchPct)),
        avgGroupRating: Math.round(avgGroupMinRating * 10) / 10,
        distance: Math.round(item.distance * 10) / 10,
        matchedReasons: item.matchedReasons,
      } as DishInfoDto;
    });

    return {
      totalCandidates: allDishes.length,
      filteredCount: filteredDishes.length,
      dishes: topDishes,
    };
  }

  private filterDishes(
    dishes: IDish[],
    center: { lat: number; lng: number },
    maxDistance: number,
    groupBudget: number,
    minRating: number,
    allergies: Set<string>,
  ): { dish: IDish; distance: number }[] {
    const results: { dish: IDish; distance: number }[] = [];

    const allergyList = Array.from(allergies).map(a => a.toLowerCase());

    for (const dish of dishes) {
      const restaurant = dish.restaurant;
      if (!restaurant) continue;

      if (restaurant.location.lat === 0 && restaurant.location.lng === 0) {
        continue;
      }

      const distance = calculateDistance(
        center.lat,
        center.lng,
        restaurant.location.lat,
        restaurant.location.lng,
      );

      if (distance > maxDistance) continue;
      if (dish.price > groupBudget) continue;
      if (minRating > 0 && dish.rating < minRating) continue;

      if (allergyList.length > 0) {
        const dishContent = `${dish.name} ${dish.tags.join(' ')}`.toLowerCase();
        const hasAllergenInDish = allergyList.some((a) =>
          dishContent.includes(a),
        );
        if (hasAllergenInDish) continue;

        if (restaurant.menu_ingredients) {
          const hasAllergenInIngredients = restaurant.menu_ingredients.some(
            (ingredient) => allergyList.includes(ingredient.toLowerCase().trim()),
          );
          if (hasAllergenInIngredients) continue;
        }
      }

      results.push({ dish, distance });
    }

    return results;
  }
}
