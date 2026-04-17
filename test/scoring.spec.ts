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
    const oneLow = [0.9, 0.8, 0.1];

    const scoreHigh = aggregateGroupScore(highAll);
    const scoreLow = aggregateGroupScore(oneLow);

    expect(scoreLow).toBeLessThan(scoreHigh);
  });

  it('should return 0 for empty similarities', () => {
    expect(aggregateGroupScore([])).toBe(0);
  });

  it('should work as individual recommender for single user', () => {
    const result = aggregateGroupScore([0.85]);
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

describe('getGroupBudget', () => {
  it('should return the minimum budget (Least Misery)', () => {
    const users: IUser[] = [
      { tasteVector: [0], budget: 100000 },
      { tasteVector: [0], budget: 200000 },
      { tasteVector: [0], budget: 50000 },
    ];
    expect(getGroupBudget(users)).toBe(50000);
  });

  it('should return 0 for empty group', () => {
    expect(getGroupBudget([])).toBe(0);
  });
});

describe('getGroupAllergies', () => {
  it('should union all allergies from group', () => {
    const users: IUser[] = [
      { tasteVector: [], budget: 100000, allergies: ['tom', 'sua'] },
      { tasteVector: [], budget: 100000, allergies: ['dau_phong'] },
      { tasteVector: [], budget: 100000 },
    ];
    const result = getGroupAllergies(users);
    expect(result.size).toBe(3);
    expect(result.has('tom')).toBe(true);
    expect(result.has('sua')).toBe(true);
    expect(result.has('dau_phong')).toBe(true);
  });

  it('should return empty set for group with no allergies', () => {
    const users: IUser[] = [{ tasteVector: [], budget: 100000 }];
    expect(getGroupAllergies(users).size).toBe(0);
  });
});

describe('computeIndividualSimilarities', () => {
  it('should return similarity scores for each user', () => {
    const users: IUser[] = [
      {
        tasteVector: [0.9, 0.1, 0.8, 0.1, 0.5, 0.2, 0.0, 0.0],
        budget: 100000,
      },
      {
        tasteVector: [0.0, 0.3, 0.1, 0.1, 0.0, 0.9, 0.0, 1.0],
        budget: 100000,
      },
    ];
    const restaurant: IRestaurant = {
      name: 'Test',
      location: { lat: 10.77, lng: 106.69 },
      priceRange: 2,
      tasteVector: [0.8, 0.1, 0.7, 0.2, 0.4, 0.3, 0.0, 0.0],
      rating: 4.0,
    };

    const results = computeIndividualSimilarities(users, restaurant);

    expect(results).toHaveLength(2);
    expect(results[0]).toBeGreaterThan(results[1]);
  });
});

describe('getGroupDistanceTolerance', () => {
  it('should return the minimum distance tolerance from the group', () => {
    const users: IUser[] = [
      { tasteVector: [], budget: 100000, distance_tolerance: 5 },
      { tasteVector: [], budget: 100000, distance_tolerance: 2 },
      { tasteVector: [], budget: 100000, distance_tolerance: 10 },
    ];
    expect(getGroupDistanceTolerance(users, 5)).toBe(2);
  });

  it('should return default distance if group members have no tolerance setting', () => {
    const users: IUser[] = [
      { tasteVector: [], budget: 100000 },
      { tasteVector: [], budget: 100000 },
    ];
    expect(getGroupDistanceTolerance(users, 5)).toBe(5);
  });

  it('should return default distance if group is empty', () => {
    expect(getGroupDistanceTolerance([], 10)).toBe(10);
  });
});

describe('getGroupMinRating', () => {
  it('should return the maximum min_rating expected by the group (Constraint Aggregation)', () => {
    const users: IUser[] = [
      { tasteVector: [], budget: 100000, min_rating: 4.0 },
      { tasteVector: [], budget: 100000, min_rating: 4.5 },
      { tasteVector: [], budget: 100000, min_rating: 3.5 },
    ];
    expect(getGroupMinRating(users)).toBe(4.5);
  });

  it('should return 0 if group is empty', () => {
    expect(getGroupMinRating([])).toBe(0);
  });
});

/*
npx jest --rootDir=. test/scoring.spec.ts  
*/
