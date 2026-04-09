/**
 * Engine Service — Orchestration Layer
 *
 * Điều phối toàn bộ pipeline recommendation theo mô hình Computational Thinking:
 *   Profiles → Filtering → Similarity → Aggregation → Ranking → Output
 *
 * Pipeline tổng thể (Mẫu 3 — Two-Phase Filtering):
 *   Phase 1 (Hard Filtering): Loại nhà hàng vi phạm constraint
 *   Phase 2 (Soft Ranking): Cosine Similarity → Group Aggregation → Top K
 *
 * Xử lý edge cases:
 *   - Không có người dùng → thông báo lỗi
 *   - Nhóm 1 người → hoạt động như recommender cá nhân
 *   - Tất cả bị loại → trả mảng rỗng
 *   - Vector bằng 0 → similarity = 0 (handled bởi cosineSimilarity)
 *
 * Độ phức tạp tổng: O(M × N × d)
 *   M = số nhà hàng, N = số user, d = số chiều vector
 *
 * @module engine
 */

import { Injectable } from '@nestjs/common';

import {
  GroupRecommendationDto,
  RestaurantResultDto,
} from '../restaurants/dto/group-recommendation.dto';
import { MOCK_RESTAURANTS } from '../restaurants/data/mock/restaurants.mock';
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
import { MAX_DISTANCE_KM, TOP_K } from './algorithms/scoring';
import { calculateDistance } from '../../utils/haversine.util';
import { IRestaurant } from '../../shared/interfaces/restaurant.interface';
import { IUser } from '../../shared/interfaces/user.interface';

@Injectable()
export class EngineService {
  /**
   * Gợi ý nhà hàng phù hợp nhất cho nhóm người dùng.
   *
   * Pipeline:
   *   - Bước 1 → Profile Construction (taste vectors từ DTO)
   *   - Bước 2 → Hard Constraint Filtering (distance, budget, rating, allergies)
   *   - Bước 3 → Cosine Similarity (individual sim[i][j])
   *   - Bước 4 → Group Aggregation (0.7 × avg + 0.3 × min)
   *   - Bước 5 → Ranking & Output (top K)
   *
   * @param dto - Input gồm groupUsers, currentLocation, aggregationWeights
   * @returns Top K nhà hàng, sắp xếp theo matchedScore giảm dần
   */
  getGroupRecommendations(dto: GroupRecommendationDto): RestaurantResultDto[] {
    const { groupUsers, currentLocation, aggregationWeights } = dto;

    // =====================================================
    // Bước 1 — Profile Construction
    // =====================================================
    const users: IUser[] = groupUsers.map((u) => ({
      taste_vector: u.taste_vector,
      budget: u.budget,
      allergies: u.allergies,
      distance_tolerance: u.distance_tolerance,
      min_rating: u.min_rating,
    }));

    // =====================================================
    // Bước 2 — Hard Constraint Filtering
    // =====================================================

    // 2a. Tổng hợp constraints nhóm
    const groupBudget = getGroupBudget(users);
    const groupDistance = getGroupDistanceTolerance(users, MAX_DISTANCE_KM);
    const groupMinRating = getGroupMinRating(users);
    const groupAllergies = getGroupAllergies(users);

    // 2b. Tính khoảng cách và lọc
    const filteredRestaurants: { restaurant: IRestaurant; distance: number }[] =
      [];

    for (const restaurant of MOCK_RESTAURANTS) {
      // Filter: Khoảng cách > tolerance → loại
      const distance = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        restaurant.location.lat,
        restaurant.location.lng,
      );
      if (distance > groupDistance) {
        continue;
      }

      // Filter: Giá > ngân sách nhóm → loại
      if (restaurant.averagePrice > groupBudget) {
        continue;
      }

      // Filter: Rating < ngưỡng tối thiểu → loại
      if (restaurant.rating < groupMinRating) {
        continue;
      }

      // Filter: Dị ứng — giao giữa ingredients và allergies ≠ rỗng → loại
      if (groupAllergies.size > 0 && restaurant.menu_ingredients) {
        const hasAllergen = restaurant.menu_ingredients.some((ingredient) =>
          groupAllergies.has(ingredient.toLowerCase().trim()),
        );
        if (hasAllergen) {
          continue;
        }
      }

      filteredRestaurants.push({ restaurant, distance });
    }

    // =====================================================
    // Bước 3 — Cosine Similarity (Individual Scoring)
    // Tính sim[i][j] cho mỗi cặp (user_i, restaurant_j)
    // =====================================================

    // =====================================================
    // Bước 4 — Group Aggregation
    // final = AVG_WEIGHT × avg(sim) + MIN_WEIGHT × min(sim)
    // =====================================================

    const scoredResults: RestaurantResultDto[] = filteredRestaurants.map(
      ({ restaurant, distance }) => {
        // Bước 3: Tính individual similarities
        const similarities = computeIndividualSimilarities(users, restaurant);

        // Bước 4: Tổng hợp điểm nhóm
        // Resolve optional DTO fields → concrete values cho aggregation
        const resolvedWeights = aggregationWeights
          ? {
              avgWeight: aggregationWeights.avgWeight ?? AVG_WEIGHT,
              minWeight: aggregationWeights.minWeight ?? MIN_WEIGHT,
            }
          : undefined;

        const matchedScore = aggregateGroupScore(
          similarities,
          resolvedWeights,
        );

        return {
          name: restaurant.name,
          averagePrice: restaurant.averagePrice,
          distance: Math.round(distance * 100) / 100,
          rating: restaurant.rating,
          matchedScore,
        };
      },
    );

    // =====================================================
    // Bước 5 — Ranking & Output
    // Sắp xếp giảm dần theo matchedScore
    // Nếu cùng điểm → ưu tiên khoảng cách gần hơn → rating cao hơn
    // =====================================================
    scoredResults.sort((a, b) => {
      // Ưu tiên 1: matchedScore cao hơn
      if (b.matchedScore !== a.matchedScore) {
        return b.matchedScore - a.matchedScore;
      }
      // Ưu tiên 2 (tie-breaker): khoảng cách gần hơn
      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }
      // Ưu tiên 3: rating cao hơn
      return b.rating - a.rating;
    });

    return scoredResults.slice(0, TOP_K);
  }
}
