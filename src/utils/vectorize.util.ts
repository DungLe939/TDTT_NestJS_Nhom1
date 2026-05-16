import { TASTE_DIMENSIONS, TASTE_VECTOR_SIZE } from '../modules/engine/algorithms/scoring';

/**
 * Chuyển đổi thông tin món ăn thành taste vector (7 chiều).
 * 
 * Thay vì chỉ dùng tags thủ công, hàm này sẽ quét qua name và description
 * của món ăn để tìm các từ khóa đại diện cho khẩu vị (rule-based).
 */
export function vectorizeTags(tags: string[], name?: string, description?: string | null): number[] {
  const vector = new Array(TASTE_VECTOR_SIZE).fill(0);
  
  // Gộp tất cả text lại để quét keyword
  const combinedText = [
    ...(tags || []),
    name || '',
    name || '', // Nhân đôi trọng số của tên món ăn
    description || ''
  ].join(' ').toLowerCase();

  // Nếu không có thông tin gì, trả về vector trung tính thay vì 0 để tránh chia cho 0
  if (!combinedText.trim()) {
    return new Array(TASTE_VECTOR_SIZE).fill(0.3);
  }

  // Định nghĩa các keyword cho từng chiều khẩu vị
  const keywordRules = [
    // [0] cay
    { dim: 'cay', words: ['cay', 'ớt', 'sa tế', 'sate', 'sốt thái', 'thái cay', 'spicy'] },
    // [1] ngot
    { dim: 'ngot', words: ['ngọt', 'chè', 'sâm', 'tráng miệng', 'đường', 'sweet', 'kem'] },
    // [2] man
    { dim: 'man', words: ['mắm', 'xì dầu', 'muối', 'mặn', 'tương', 'savory'] },
    // [3] chua
    { dim: 'chua', words: ['chua', 'tắc', 'xả tắc', 'giấm', 'cà pháo', 'xoài xanh', 'chanh', 'me'] },
    // [4] beo
    { dim: 'beo', words: ['béo', 'chiên', 'giòn', 'rán', 'tóp mỡ', 'phô mai', 'mỡ', 'dầu'] },
    // [5] thanh_dam
    { dim: 'thanh_dam', words: ['thanh mát', 'giải nhiệt', 'luộc', 'hấp', 'thanh đạm', 'rau sống', 'salad'] },
    // [6] chay
    { dim: 'chay', words: ['chay', 'tofu', 'đậu phụ', 'nấm', 'thuần chay', 'vegetarian'] }
  ];

  TASTE_DIMENSIONS.forEach((dim, index) => {
    const rule = keywordRules.find(r => r.dim === dim);
    if (rule) {
      // Nếu text chứa một trong các từ khóa
      const matchCount = rule.words.filter(w => combinedText.includes(w)).length;
      
      if (matchCount > 0) {
        // Cộng dồn điểm tùy số lượng keyword match được, tối đa là 1.0
        vector[index] = Math.min(1.0, 0.5 + (matchCount * 0.2));
      }
    }
  });

  // Fallback cho tags cũ (phòng hờ)
  if (tags && tags.length > 0) {
    const lowerTags = tags.map(t => t.toLowerCase().trim());
    TASTE_DIMENSIONS.forEach((dim, index) => {
      if (lowerTags.includes(dim.toLowerCase())) {
        vector[index] = Math.max(vector[index], 1.0);
      }
    });
  }

  // Nếu vẫn toàn 0, trả về trung tính
  if (vector.every(v => v === 0)) {
    return new Array(TASTE_VECTOR_SIZE).fill(0.3);
  }

  return vector;
}

