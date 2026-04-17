import { Injectable, Logger } from '@nestjs/common';
import {
  GroupRecommendationDto,
  GroupRecommendationResponseDto,
  ScoreResultDto,
} from '../restaurants/dto/group-recommendation.dto';
import { RestaurantsService } from '../restaurants/restaurants.service';
import {
  computeIndividualSimilarities,
  aggregateGroupScore,
  getGroupBudget,
  getGroupDistanceTolerance,
  getGroupMinRating,
  getGroupAllergies,
  AVG_WEIGHT,
  MIN_WEIGHT,
} from './algorithms/group-aggregation';
import {
  MAX_DISTANCE_KM,
  TOP_K,
  budgetToPriceRange,
} from './algorithms/scoring';
import { calculateDistance } from '../../utils/haversine.util';
import { IRestaurant } from '../../shared/interfaces/restaurant.interface';
import { IUser } from '../../shared/interfaces/user.interface';

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
   * Tính gợi ý nhà hàng cho nhóm theo pipeline: load data, filter constraints,
   * relaxation khi quá chặt, sau đó chấm điểm và trả về top K.
   * @param dto Dữ liệu thành viên, vị trí hiện tại và trọng số tùy chỉnh.
   * @param guestId Mã phiên để truy vấn tập nhà hàng tương ứng.
   * @returns Danh sách nhà hàng đã xếp hạng cho cả nhóm.
   */
  async getGroupRecommendations(
    dto: GroupRecommendationDto,
    guestId: string,
  ): Promise<GroupRecommendationResponseDto> {
    const { users: groupUsers, currentLocation, aggregationWeights } = dto;

    const allRestaurants = await this.restaurantsService.findByGuestId(guestId);

    this.logger.log(
      `[Recommendation] guest=${guestId}, totalRestaurants=${allRestaurants.length}, ` +
        `users=${groupUsers.length}, location=(${currentLocation.lat}, ${currentLocation.lng})`,
    );

    if (allRestaurants.length === 0) {
      this.logger.warn(
        `Không có nhà hàng nào trong Firestore cho guest_id: ${guestId}. ` +
          'Hãy gọi /schedule/searchLocation trước.',
      );
      return {
        totalCandidates: 0,
        filteredCount: 0,
        recommendations: [],
      };
    }

    const users: IUser[] = groupUsers.map((u) => ({
      userId: u.userId,
      tasteVector: u.tasteVector,
      budget: u.budget,
      allergies: u.allergies,
      distance_tolerance: u.distance_tolerance,
      min_rating: u.min_rating,
    }));

    // Tính constraint aggregation
    const groupBudget = getGroupBudget(users);
    const groupDistance = getGroupDistanceTolerance(users, MAX_DISTANCE_KM);
    const groupMinRating = getGroupMinRating(users);
    const groupAllergies = getGroupAllergies(users);
    const groupPriceRange = budgetToPriceRange(groupBudget);

    this.logger.log(
      `[Constraints] budget=${groupBudget}, priceRange<=${groupPriceRange}, ` +
        `distance<=${groupDistance}km, minRating>=${groupMinRating}, ` +
        `allergies=${groupAllergies.size > 0 ? [...groupAllergies].join(',') : 'none'}`,
    );

    // ---- Filter với relaxation ----
    let filteredRestaurants = this.filterRestaurants(
      allRestaurants,
      currentLocation,
      groupDistance,
      groupPriceRange,
      groupMinRating,
      groupAllergies,
    );

    this.logger.log(
      `[Filter] Strict: ${filteredRestaurants.length}/${allRestaurants.length} phù hợp`,
    );

    /**
     * RELAXATION STRATEGY:
     * Nếu filter quá chặt (0 hoặc quá ít kết quả), nới lỏng dần:
     * 1. Bỏ rating filter
     * 2. Nới rộng khoảng cách (×2)
     * 3. Nới rộng priceRange (+1)
     * 4. Fallback cuối: chỉ filter distance (×3)
     */
    if (filteredRestaurants.length === 0) {
      this.logger.warn(
        '[Relaxation] Strict filter trả rỗng → thử bỏ rating...',
      );

      // Level 1: Bỏ min_rating
      filteredRestaurants = this.filterRestaurants(
        allRestaurants,
        currentLocation,
        groupDistance,
        groupPriceRange,
        0, // Bỏ rating filter
        groupAllergies,
      );

      if (filteredRestaurants.length === 0) {
        this.logger.warn('[Relaxation] Vẫn rỗng → nới rộng distance ×2...');

        // Level 2: Nới distance ×2 + bỏ rating
        filteredRestaurants = this.filterRestaurants(
          allRestaurants,
          currentLocation,
          groupDistance * 2,
          groupPriceRange,
          0,
          groupAllergies,
        );
      }

      if (filteredRestaurants.length === 0) {
        this.logger.warn('[Relaxation] Vẫn rỗng → nới budget + distance...');

        // Level 3: Nới distance ×2 + priceRange +1 + bỏ rating
        filteredRestaurants = this.filterRestaurants(
          allRestaurants,
          currentLocation,
          groupDistance * 2,
          Math.min(groupPriceRange + 1, 3),
          0,
          groupAllergies,
        );
      }

      if (filteredRestaurants.length === 0) {
        this.logger.warn(
          '[Relaxation] Vẫn rỗng → fallback chỉ distance ×3, bỏ mọi filter...',
        );

        // Level 4 (final fallback): Chỉ filter distance ×3, bỏ hết constraint khác
        filteredRestaurants = this.filterRestaurants(
          allRestaurants,
          currentLocation,
          groupDistance * 3,
          3, // Cho phép mọi mức giá
          0,
          new Set(), // Bỏ allergies
        );
      }

      this.logger.log(
        `[Relaxation] Sau nới lỏng: ${filteredRestaurants.length} kết quả`,
      );
    }

    // ---- Scoring ----
    const resolvedWeights = aggregationWeights
      ? {
          avgWeight: aggregationWeights.avgWeight ?? AVG_WEIGHT,
          minWeight: aggregationWeights.minWeight ?? MIN_WEIGHT,
        }
      : undefined;

    const scoredResults: ScoreResultDto[] = filteredRestaurants.map(
      ({ restaurant, distance }) => {
        const similarities = computeIndividualSimilarities(users, restaurant);

        const userScores = users.map((user, index) => ({
          userId: user.userId ?? `user_${index}`,
          similarity: Math.round(similarities[index] * 100) / 100,
        }));

        const finalScore = aggregateGroupScore(similarities, resolvedWeights);

        const avgSimilarity =
          similarities.length > 0
            ? Math.round(
                (similarities.reduce((s, v) => s + v, 0) /
                  similarities.length) *
                  100,
              ) / 100
            : 0;
        const minSimilarity =
          similarities.length > 0
            ? Math.round(Math.min(...similarities) * 100) / 100
            : 0;

        return {
          restaurant: {
            id: restaurant.id ?? '',
            name: restaurant.name,
            price: this.priceRangeToPrice(restaurant.priceRange),
            rating: restaurant.rating,
            location: restaurant.location,
            distance: Math.round(distance * 100) / 100,
            tags: restaurant.tags,
          },
          finalScore,
          avgSimilarity,
          minSimilarity,
          userScores,
        };
      },
    );

    scoredResults.sort((a, b) => b.finalScore - a.finalScore);

    this.logger.log(
      `[Result] Top ${Math.min(TOP_K, scoredResults.length)} nhà hàng. ` +
        `Best: ${scoredResults[0]?.restaurant.name ?? 'N/A'} (${scoredResults[0]?.finalScore ?? 0})`,
    );

    return {
      totalCandidates: allRestaurants.length,
      filteredCount: filteredRestaurants.length,
      recommendations: scoredResults.slice(0, TOP_K),
    };
  }

  /**
   * Filter nhà hàng theo hard constraints.
   * Trả về danh sách { restaurant, distance } với distance đã tính.
   *
   * @param restaurants - Tất cả nhà hàng từ Firestore
   * @param center - Toạ độ tâm (currentLocation)
   * @param maxDistance - Khoảng cách tối đa (km)
   * @param maxPriceRange - Mức giá tối đa cho phép (1-3)
   * @param minRating - Rating tối thiểu (0-5)
   * @param allergies - Set các allergens cần loại trừ
   */
  private filterRestaurants(
    restaurants: IRestaurant[],
    center: { lat: number; lng: number },
    maxDistance: number,
    maxPriceRange: number,
    minRating: number,
    allergies: Set<string>,
  ): { restaurant: IRestaurant; distance: number }[] {
    const results: { restaurant: IRestaurant; distance: number }[] = [];

    for (const restaurant of restaurants) {
      // Skip nhà hàng có toạ độ (0,0) — dữ liệu lỗi
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
      if (restaurant.priceRange > maxPriceRange) continue;
      if (minRating > 0 && restaurant.rating < minRating) continue;

      if (allergies.size > 0 && restaurant.menu_ingredients) {
        const hasAllergen = restaurant.menu_ingredients.some((ingredient) =>
          allergies.has(ingredient.toLowerCase().trim()),
        );
        if (hasAllergen) continue;
      }

      results.push({ restaurant, distance });
    }

    return results;
  }
}
