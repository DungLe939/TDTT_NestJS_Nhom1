/**
 * User Interface
 *
 * Mapping Firebase Firestore:
 *   users: {uid, name, taste_vector: [], budget, allergies: [], xp, level}
 *
 * Phân loại features:
 *   - Scoring Feature: taste_vector (dùng để tính Cosine Similarity)
 *   - Constraint Features: budget, distance_tolerance, min_rating, allergies
 *     (dùng để lọc cứng trước khi tính toán)
 *
 * @module shared/interfaces
 */

export interface IUser {
  /** ID định danh người dùng trong nhóm — dùng cho response mapping */
  userId?: string;

  /**
   * Vector sở thích ẩm thực — giá trị [0.0, 1.0] cho mỗi chiều.
   *
   * Các chiều (8 dimensions):
   *   [0] cay        - Mức độ yêu thích đồ cay
   *   [1] ngot       - Mức độ yêu thích đồ ngọt
   *   [2] man        - Mức độ yêu thích đồ mặn/đậm đà
   *   [3] chua       - Mức độ yêu thích đồ chua
   *   [4] beo        - Mức độ yêu thích đồ béo/dầu mỡ
   *   [5] thanh_dam  - Mức độ yêu thích đồ thanh đạm
   *   [6] hai_san    - Mức độ yêu thích hải sản
   *   [7] chay       - Mức độ yêu thích đồ chay/rau củ
   *
   * User và restaurant phải cùng không gian vector để tính Cosine Similarity.
   */
  tasteVector: number[];

  /** Ngân sách tối đa cho một bữa ăn (VND) — Constraint Feature */
  budget: number;

  /** Danh sách dị ứng / kiêng cữ — Constraint Feature */
  allergies?: string[];

  /** Khoảng cách tối đa chấp nhận (km) — Constraint Feature */
  distance_tolerance?: number;

  /** Ngưỡng đánh giá tối thiểu (0–5) — Constraint Feature */
  min_rating?: number;
}
