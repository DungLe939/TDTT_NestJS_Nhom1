/**
 * Scoring Constants & Types
 *
 * Hằng số và kiểu dữ liệu dùng trong pipeline recommendation.
 *
 * @module engine/algorithms
 */

/** Khoảng cách tối đa mặc định (km) */
export const MAX_DISTANCE_KM = 3;

/** Giá trị rating tối đa trên thang đánh giá */
export const MAX_RATING = 5;

/** Số lượng kết quả trả về tối đa */
export const TOP_K = 5;

/** Số chiều của taste vector */
export const TASTE_VECTOR_SIZE = 8;

/**
 * Labels cho các chiều taste vector (8 dimensions).
 *
 * Dùng để mapping sở thích của user sang vector số hóa.
 * User và restaurant phải cùng thứ tự chiều này.
 */
export const TASTE_DIMENSIONS = [
  'cay',        // [0] Spicy
  'ngot',       // [1] Sweet
  'man',        // [2] Savory/Salty
  'chua',       // [3] Sour
  'beo',        // [4] Rich/Fatty
  'thanh_dam',  // [5] Light/Fresh
  'hai_san',    // [6] Seafood
  'chay',       // [7] Vegetarian
] as const;
