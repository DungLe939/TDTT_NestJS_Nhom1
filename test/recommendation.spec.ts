/**
 * Unit Tests — Group Recommendation Feature
 *
 * Test pipeline:
 *   1. calculateDistance() — Haversine formula
 *   2. cosineSimilarity() — Core scoring algorithm
 *   3. aggregateGroupScore() — Group aggregation (avg + min)
 *   4. getGroupBudget() — Least Misery Strategy
 *   5. getGroupAllergies() — Union of allergies
 *
 * @module test
 */

import { calculateDistance } from '../src/utils/haversine.util';
import { cosineSimilarity } from '../src/modules/engine/algorithms/cosine-similarity';
import {
  computeIndividualSimilarities,
  aggregateGroupScore,
  getGroupBudget,
  getGroupDistanceTolerance,
  getGroupMinRating,
  getGroupAllergies,
} from '../src/modules/engine/algorithms/group-aggregation';
import { IUser } from '../src/shared/interfaces/user.interface';
import { IRestaurant } from '../src/shared/interfaces/restaurant.interface';

// ===========================================================
// Test 1: Haversine Distance
// ===========================================================
describe('calculateDistance (Haversine)', () => {
  it('should calculate distance between Chợ Bến Thành and Nhà thờ Đức Bà (~0.86km)', () => {
    const distance = calculateDistance(10.7721, 106.698, 10.7798, 106.699);
    expect(distance).toBeGreaterThan(0.7);
    expect(distance).toBeLessThan(1.1);
  });

  it('should return 0 when both points are the same', () => {
    const distance = calculateDistance(10.7721, 106.698, 10.7721, 106.698);
    expect(distance).toBe(0);
  });

  it('should calculate longer distance between Q1 and Bình Thạnh', () => {
    const distance = calculateDistance(10.7769, 106.6952, 10.8010, 106.7120);
    expect(distance).toBeGreaterThan(2);
    expect(distance).toBeLessThan(5);
  });
});

// ===========================================================
// Test 2: Cosine Similarity
// ===========================================================
describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    const v = [0.8, 0.2, 0.5, 0.3, 0.4, 0.6, 0.1, 0.0];
    const result = cosineSimilarity(v, v);
    expect(result).toBeCloseTo(1.0, 5);
  });

  it('should return 0 for orthogonal vectors', () => {
    const a = [1, 0, 0, 0, 0, 0, 0, 0];
    const b = [0, 1, 0, 0, 0, 0, 0, 0];
    const result = cosineSimilarity(a, b);
    expect(result).toBeCloseTo(0, 5);
  });

  it('should return 0 for zero vector (avoid divide by zero)', () => {
    const a = [0.5, 0.3, 0.7, 0.2, 0.4, 0.6, 0.1, 0.0];
    const zero = [0, 0, 0, 0, 0, 0, 0, 0];
    const result = cosineSimilarity(a, zero);
    expect(result).toBe(0);
  });

  it('should return 0 for mismatched lengths', () => {
    const a = [0.5, 0.3];
    const b = [0.5, 0.3, 0.7];
    const result = cosineSimilarity(a, b);
    expect(result).toBe(0);
  });

  it('should return high similarity for similar taste profiles', () => {
    // User thích cay, mặn — restaurant cũng cay, mặn
    const user = [0.9, 0.1, 0.8, 0.1, 0.5, 0.2, 0.0, 0.0];
    const restaurant = [0.8, 0.1, 0.7, 0.2, 0.4, 0.3, 0.0, 0.0];
    const result = cosineSimilarity(user, restaurant);
    expect(result).toBeGreaterThan(0.95);
  });

  it('should return low similarity for different taste profiles', () => {
    // User thích chay, thanh đạm — restaurant là đồ cay, béo
    const user = [0.0, 0.3, 0.1, 0.1, 0.0, 0.9, 0.0, 1.0];
    const restaurant = [0.9, 0.0, 0.8, 0.0, 0.8, 0.1, 0.0, 0.0];
    const result = cosineSimilarity(user, restaurant);
    expect(result).toBeLessThan(0.3);
  });
});

// ===========================================================
// Test 3: Group Aggregation (avg + min)
// ===========================================================
describe('aggregateGroupScore', () => {
  it('should compute final = 0.7 * avg + 0.3 * min', () => {
    const similarities = [0.9, 0.8, 0.7];
    const result = aggregateGroupScore(similarities);

    const expectedAvg = (0.9 + 0.8 + 0.7) / 3; // 0.8
    const expectedMin = 0.7;
    const expectedFinal = 0.7 * expectedAvg + 0.3 * expectedMin; // 0.77
    expect(result).toBeCloseTo(expectedFinal, 1);
  });

  it('should penalize when one member has very low similarity', () => {
    const highAll = [0.9, 0.8, 0.85];
    const oneLow = [0.9, 0.8, 0.1]; // one person hates it

    const scoreHigh = aggregateGroupScore(highAll);
    const scoreLow = aggregateGroupScore(oneLow);

    // Score should be significantly lower when one person has low similarity
    expect(scoreLow).toBeLessThan(scoreHigh);
  });

  it('should return 0 for empty similarities', () => {
    expect(aggregateGroupScore([])).toBe(0);
  });

  it('should work as individual recommender for single user', () => {
    const result = aggregateGroupScore([0.85]);
    // final = 0.7 * 0.85 + 0.3 * 0.85 = 0.85
    expect(result).toBeCloseTo(0.85, 1);
  });

  it('should accept custom weights', () => {
    const similarities = [0.9, 0.5];
    const customWeights = { avgWeight: 0.5, minWeight: 0.5 };
    const result = aggregateGroupScore(similarities, customWeights);

    const expectedAvg = (0.9 + 0.5) / 2; // 0.7
    const expectedMin = 0.5;
    const expectedFinal = 0.5 * expectedAvg + 0.5 * expectedMin; // 0.6
    expect(result).toBeCloseTo(expectedFinal, 1);
  });
});

// ===========================================================
// Test 4: Group Budget (Least Misery)
// ===========================================================
describe('getGroupBudget', () => {
  it('should return the minimum budget (Least Misery)', () => {
    const users: IUser[] = [
      { taste_vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], budget: 100000 },
      { taste_vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], budget: 200000 },
      { taste_vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], budget: 50000 },
    ];
    expect(getGroupBudget(users)).toBe(50000);
  });

  it('should return 0 for empty group', () => {
    expect(getGroupBudget([])).toBe(0);
  });
});

// ===========================================================
// Test 5: Group Allergies (Union)
// ===========================================================
describe('getGroupAllergies', () => {
  it('should union all allergies from group', () => {
    const users: IUser[] = [
      { taste_vector: [], budget: 100000, allergies: ['tom', 'sua'] },
      { taste_vector: [], budget: 100000, allergies: ['dau_phong'] },
      { taste_vector: [], budget: 100000 }, // no allergies
    ];
    const result = getGroupAllergies(users);
    expect(result.size).toBe(3);
    expect(result.has('tom')).toBe(true);
    expect(result.has('sua')).toBe(true);
    expect(result.has('dau_phong')).toBe(true);
  });

  it('should return empty set for group with no allergies', () => {
    const users: IUser[] = [
      { taste_vector: [], budget: 100000 },
    ];
    expect(getGroupAllergies(users).size).toBe(0);
  });
});

// ===========================================================
// Test 6: Individual Similarities
// ===========================================================
describe('computeIndividualSimilarities', () => {
  it('should return similarity scores for each user', () => {
    const users: IUser[] = [
      { taste_vector: [0.9, 0.1, 0.8, 0.1, 0.5, 0.2, 0.0, 0.0], budget: 100000 },
      { taste_vector: [0.0, 0.3, 0.1, 0.1, 0.0, 0.9, 0.0, 1.0], budget: 100000 },
    ];
    const restaurant: IRestaurant = {
      name: 'Test',
      location: { lat: 10.77, lng: 106.69 },
      averagePrice: 50000,
      taste_vector: [0.8, 0.1, 0.7, 0.2, 0.4, 0.3, 0.0, 0.0],
      rating: 4.0,
    };

    const results = computeIndividualSimilarities(users, restaurant);

    expect(results).toHaveLength(2);
    // User 1 (cay, man) should be more similar than User 2 (chay, thanh)
    expect(results[0]).toBeGreaterThan(results[1]);
  });
});

// ===========================================================
// Test 7: Group Distance Tolerance
// ===========================================================
describe('getGroupDistanceTolerance', () => {
  it('should return the minimum distance tolerance from the group', () => {
    // Giả sử dùng Minimum (nhóm chỉ đi được xa bằng người làm biếng nhất)
    const users: IUser[] = [
      { taste_vector: [], budget: 100000, distance_tolerance: 5 }, // chịu đi 5km
      { taste_vector: [], budget: 100000, distance_tolerance: 2 }, // chịu đi 2km
      { taste_vector: [], budget: 100000, distance_tolerance: 10 } // chịu đi 10km
    ];
    // Đảm bảo getGroupDistanceTolerance xử lý trả về 2 (Least Misery)
    expect(getGroupDistanceTolerance(users, 5)).toBe(2);
  });

  it('should return default distance if group members have no tolerance setting', () => {
    const users: IUser[] = [
      { taste_vector: [], budget: 100000 },
      { taste_vector: [], budget: 100000 }
    ];
    // Nên trả về 5 do chúng ta truyền defaultDistance là 5
    expect(getGroupDistanceTolerance(users, 5)).toBe(5);
  });

  it('should return default distance if group is empty', () => {
    expect(getGroupDistanceTolerance([], 10)).toBe(10);
  });
});

// ===========================================================
// Test 8: Group Min Rating
// ===========================================================
describe('getGroupMinRating', () => {
  it('should return the maximum min_rating expected by the group (Constraint Aggregation)', () => {
    const users: IUser[] = [
      { taste_vector: [], budget: 100000, min_rating: 4.0 }, 
      { taste_vector: [], budget: 100000, min_rating: 4.5 },
      { taste_vector: [], budget: 100000, min_rating: 3.5 }  
    ];
    // Logic của hàm là Math.max(...users.map) -> nên kỳ vọng là 4.5
    expect(getGroupMinRating(users)).toBe(4.5);
  });

  it('should return 0 if group is empty', () => {
    expect(getGroupMinRating([])).toBe(0);
  });
});
