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

/**
 * Chuyển đổi ngân sách (VND) sang mức giá priceRange (1-3).
 *
 * Mapping tương tự scheduler:
 *   - 1 (Rẻ):         budget < 50,000
 *   - 2 (Trung bình):  50,000 ≤ budget < 200,000
 *   - 3 (Sang trọng):  budget ≥ 200,000
 *
 * @param budgetVND - Ngân sách tối đa của user (VND)
 * @returns Mức priceRange tối đa cho phép (1-3)
 */
export function budgetToPriceRange(budgetVND: number): number {
  if (budgetVND >= 200000) return 3;
  if (budgetVND >= 50000) return 2;
  return 1;
}
