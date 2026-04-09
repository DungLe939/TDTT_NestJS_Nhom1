/**
 * Group Aggregation Algorithms
 *
 * Kết hợp điểm tương thích cá nhân thành điểm nhóm.
 *
 *   - Utilitarian (tối đa hóa tổng lợi ích): Average Score
 *   - Egalitarian / Rawlsian (bảo vệ người yếu nhất): Least Misery
 *   - Trade-off: final_score = AVG_WEIGHT × avg + MIN_WEIGHT × min
 *
 * @module engine/algorithms
 */

import { IUser } from '../../../shared/interfaces/user.interface';
import { cosineSimilarity } from './cosine-similarity';
import { IRestaurant } from '../../../shared/interfaces/restaurant.interface';

/** Trọng số của Average Score trong công thức aggregation */
export const AVG_WEIGHT = 0.7;

/** Trọng số của Least Misery (min score) trong công thức aggregation */
export const MIN_WEIGHT = 0.3;

/**
 * Tính similarity matrix: sim[i][j] giữa mỗi user i và restaurant j.
 *
 *   Dùng Cosine Similarity cho từng cặp (user, restaurant).
 *   Output: ma trận sim[i][j] = độ phù hợp giữa user_i và restaurant_j.
 *
 * Độ phức tạp: O(M × N × d) với M restaurants, N users, d dimensions.
 *
 * @param users - Danh sách người dùng trong nhóm
 * @param restaurant - Nhà hàng cần tính similarity
 * @returns Mảng điểm similarity cho mỗi user với nhà hàng này
 */
export function computeIndividualSimilarities(
  users: IUser[],
  restaurant: IRestaurant,
): number[] {
  return users.map((user) =>
    cosineSimilarity(user.taste_vector, restaurant.taste_vector),
  );
}

/**
 * Tổng hợp điểm nhóm từ ma trận similarity cá nhân 
 *
 * Chiến lược kết hợp:
 *   - avg_score  = trung bình cộng → phản ánh mức hài lòng chung của cả nhóm
 *   - min_score  = giá trị nhỏ nhất → bảo vệ thành viên kém hài lòng nhất
 *   - final_score = AVG_WEIGHT × avg_score + MIN_WEIGHT × min_score
 *
 * Lý do:
 *   - 70% ưu tiên lợi ích chung: đa số hài lòng
 *   - 30% bảo vệ cá nhân: tránh chọn nhà hàng mà có người rất ghét
 *
 * Ví dụ: similarities = [0.9, 0.8, 0.2]
 *   - avg = 0.633
 *   - min = 0.2
 *   - final = 0.7 × 0.633 + 0.3 × 0.2 = 0.503
 *   → điểm bị kéo xuống vì có 1 người không phù hợp
 *
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

  const effectiveAvgWeight = weights?.avgWeight ?? AVG_WEIGHT;
  const effectiveMinWeight = weights?.minWeight ?? MIN_WEIGHT;

  // Average Score — tối ưu tổng lợi ích
  const avgScore =
    similarities.reduce((sum, s) => sum + s, 0) / similarities.length;

  // Least Misery — bảo vệ người yếu nhất
  const minScore = Math.min(...similarities);

  // Final Score — kết hợp hai mục tiêu
  const finalScore =
    effectiveAvgWeight * avgScore + effectiveMinWeight * minScore;

  return Math.round(finalScore * 100) / 100;
}

/**
 * Xác định ngân sách chung của nhóm (Constraint Aggregation).
 *
 * Chiến lược: Least Misery — lấy giá trị NHỎ NHẤT.
 *
 * Lý do chọn MIN thay vì AVERAGE:
 *   - MIN đảm bảo MỌI thành viên đều đủ khả năng chi trả
 *   - AVERAGE có thể khiến thành viên ngân sách thấp không đủ tiền
 *   - Ví dụ: [100k, 200k, 50k] → MIN=50k (ai cũng trả được)
 *
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
 * Xác định khoảng cách tối đa của nhóm (Constraint Aggregation).
 *
 * Lấy MIN distance_tolerance để đảm bảo mọi thành viên đều chấp nhận.
 *
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
 * Xác định ngưỡng rating tối thiểu của nhóm (Constraint Aggregation).
 *
 * Lấy MAX min_rating để đảm bảo mọi thành viên đều hài lòng.
 *
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
 * Tổng hợp danh sách dị ứng của cả nhóm (Constraint Aggregation).
 *
 * Lấy UNION tất cả allergies → nếu BẤT KỲ ai dị ứng, nhà hàng đó bị loại.
 *
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