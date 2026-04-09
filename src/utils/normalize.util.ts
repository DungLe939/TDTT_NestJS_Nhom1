/**
 * Normalize Utility
 *
 * Pure function chuẩn hoá giá trị số về khoảng [0, 1].
 * 
 * @module utils
 */

/**
 * Chuẩn hoá một giá trị số về khoảng [0, 1].
 *
 * Công thức: normalized = (value - min) / (max - min)
 * - Nếu max === min → trả về 0 (tránh chia cho 0)
 * - Kết quả được clamp trong [0, 1]
 *
 * @param value - Giá trị cần chuẩn hoá
 * @param min - Giá trị nhỏ nhất của thang đo
 * @param max - Giá trị lớn nhất của thang đo
 * @returns Giá trị đã chuẩn hoá trong khoảng [0, 1]
 */
export function normalizeScore(
  value: number,
  min: number,
  max: number,
): number {
  if (max === min) {
    return 0;
  }

  const normalized = (value - min) / (max - min);
  return Math.max(0, Math.min(1, normalized));
}
