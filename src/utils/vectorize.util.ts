import { TASTE_DIMENSIONS, TASTE_VECTOR_SIZE } from '../modules/engine/algorithms/scoring';

/**
 * Chuyển đổi danh sách tags thành taste vector (8 chiều).
 * 
 * Đây là bước "Step 1 - Vectorization" trong POC Pipeline.
 * Nó giúp đồng bộ hoá dữ liệu text (tags) sang không gian vector số để tính toán similarity.
 * 
 * @param tags - Danh sách các nhãn đặc trưng (vd: ['cay', 'hai_san'])
 * @returns Vector số 8 chiều
 */
export function vectorizeTags(tags: string[]): number[] {
  const vector = new Array(TASTE_VECTOR_SIZE).fill(0);
  
  if (!tags || tags.length === 0) return vector;

  const lowerTags = tags.map(t => t.toLowerCase().trim());

  TASTE_DIMENSIONS.forEach((dim, index) => {
    // Nếu tag xuất hiện trực tiếp trong danh sách
    if (lowerTags.includes(dim.toLowerCase())) {
      vector[index] = 1.0;
    } 
    // Có thể mở rộng thêm logic mapping từ đồng nghĩa ở đây
    else if (dim === 'cay' && (lowerTags.includes('spicy') || lowerTags.includes('sa tế'))) {
      vector[index] = 0.8;
    }
    else if (dim === 'ngot' && (lowerTags.includes('sweet') || lowerTags.includes('tráng miệng'))) {
      vector[index] = 0.8;
    }
  });

  return vector;
}
