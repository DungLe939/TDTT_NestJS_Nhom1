/** Thuật toán tổng hợp điểm nhóm từ các điểm tương thích cá nhân. */

import { IUser } from '../../../shared/interfaces/user.interface';
import { cosineSimilarity } from './cosine-similarity';
import { IRestaurant } from '../../../shared/interfaces/restaurant.interface';

/** Trọng số mặc định cho Average Score. */
export const AVG_WEIGHT = 0.7;

/** Trọng số mặc định cho Least Misery (min score). */
export const MIN_WEIGHT = 0.3;

/**
 * Tính điểm similarity của từng user với một nhà hàng.
 * @param users - Danh sách người dùng trong nhóm
 * @param restaurant - Nhà hàng cần tính similarity
 * @returns Mảng điểm similarity cho mỗi user với nhà hàng này
 */
export function computeIndividualSimilarities(
  users: IUser[],
  restaurant: IRestaurant,
): number[] {
  return users.map((user) =>
    cosineSimilarity(user.tasteVector, restaurant.tasteVector),
  );
}

/**
 * Tổng hợp điểm nhóm theo công thức:
 * `final = avgWeight * average(similarities) + minWeight * min(similarities)`.
 * Nếu trọng số custom không hợp lệ, hàm tự quay về trọng số mặc định.
 * @param similarities - Mảng điểm cosine similarity cho mỗi user
 * @param weights - Trọng số tuỳ chỉnh { avgWeight, minWeight }
 * @returns Điểm tổng hợp nhóm, làm tròn 2 chữ số thập phân
 */
export function aggregateGroupScore(
  similarities: number[],
  weights?: { avgWeight: number; minWeight: number },
): number {
  if (similarities.length === 0) {
    return 0;
  }

  const inputAvgWeight = weights?.avgWeight ?? AVG_WEIGHT;
  const inputMinWeight = weights?.minWeight ?? MIN_WEIGHT;
  const totalWeight = inputAvgWeight + inputMinWeight;

  const [effectiveAvgWeight, effectiveMinWeight] =
    totalWeight > 0
      ? [inputAvgWeight / totalWeight, inputMinWeight / totalWeight]
      : [AVG_WEIGHT, MIN_WEIGHT];

  const avgScore =
    similarities.reduce((sum, s) => sum + s, 0) / similarities.length;

  const minScore = Math.min(...similarities);

  const finalScore =
    effectiveAvgWeight * avgScore + effectiveMinWeight * minScore;

  return Math.round(finalScore * 100) / 100;
}

/**
 * Lấy ngân sách chung bằng giá trị nhỏ nhất để mọi thành viên đều chi trả được.
 * @param users - Danh sách người dùng trong nhóm
 * @returns Ngân sách nhỏ nhất trong nhóm (VND)
 */
export function getGroupBudget(users: IUser[]): number {
  if (users.length === 0) {
    return 0;
  }
  return Math.min(...users.map((user) => user.budget));
}

/**
 * Lấy khoảng cách tối đa của nhóm theo giá trị nhỏ nhất `distance_tolerance`.
 * @param users - Danh sách người dùng trong nhóm
 * @param defaultDistance - Khoảng cách mặc định nếu user không set (km)
 * @returns Khoảng cách tối đa của nhóm (km)
 */
export function getGroupDistanceTolerance(
  users: IUser[],
  defaultDistance: number,
): number {
  if (users.length === 0) {
    return defaultDistance;
  }
  return Math.min(
    ...users.map((user) => user.distance_tolerance ?? defaultDistance),
  );
}

/**
 * Lấy ngưỡng rating tối thiểu của nhóm theo giá trị lớn nhất `min_rating`.
 * @param users - Danh sách người dùng trong nhóm
 * @returns Ngưỡng rating cao nhất trong nhóm
 */
export function getGroupMinRating(users: IUser[]): number {
  if (users.length === 0) {
    return 0;
  }
  return Math.max(...users.map((user) => user.min_rating ?? 0));
}

/**
 * Hợp nhất danh sách dị ứng của nhóm theo phép UNION.
 * @param users - Danh sách người dùng trong nhóm
 * @returns Set tất cả allergies của nhóm
 */
export function getGroupAllergies(users: IUser[]): Set<string> {
  const allAllergies = new Set<string>();
  for (const user of users) {
    if (user.allergies) {
      for (const allergy of user.allergies) {
        allAllergies.add(allergy.toLowerCase().trim());
      }
    }
  }
  return allAllergies;
}
