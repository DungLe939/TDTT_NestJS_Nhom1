/**
 * Cosine Similarity Algorithm
 *
 * Đo mức độ tương đồng giữa hai vector dựa trên góc giữa chúng.
 *
 * Công thức:
 *   CosineSimilarity(A, B) = (A · B) / (|A| × |B|)
 *
 * Trong đó:
 *   - A · B   = tích vô hướng (dot product)
 *   - |A|, |B| = độ dài (magnitude) của hai vector
 *   - Giá trị nằm trong [-1, 1]
 *     +1  = hoàn toàn giống nhau
 *      0  = không liên quan
 *     -1  = hoàn toàn đối lập
 *
 * @module engine/algorithms
 */

/**
 * Tính Cosine Similarity giữa hai vector.
 *
 * Xử lý edge case:
 *   - Vector rỗng → trả về 0
 *   - Khác kích thước → trả về 0
 *   - Vector bằng 0 (magnitude = 0) → trả về 0 (tránh chia cho 0)
 *
 * @param vectorA - Vector thứ nhất (vd: user taste_vector)
 * @param vectorB - Vector thứ hai (vd: restaurant taste_vector)
 * @returns Độ tương đồng trong khoảng [-1, 1]
 */
export function cosineSimilarity(
  vectorA: number[],
  vectorB: number[],
): number {
  // Edge case: vector rỗng hoặc khác kích thước
  if (
    vectorA.length === 0 ||
    vectorB.length === 0 ||
    vectorA.length !== vectorB.length
  ) {
    return 0;
  }

  // Tính dot product (tích vô hướng): A · B = Σ(Ai × Bi)
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    magnitudeA += vectorA[i] * vectorA[i];
    magnitudeB += vectorB[i] * vectorB[i];
  }

  // Tính magnitude (độ dài): |A| = √(Σ Ai²)
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  // Edge case: vector bằng 0 → tránh chia cho 0
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  // Cosine Similarity = (A · B) / (|A| × |B|)
  return dotProduct / (magnitudeA * magnitudeB);
}
