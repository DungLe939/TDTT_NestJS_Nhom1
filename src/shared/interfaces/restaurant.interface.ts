/**
 * Restaurant Interface
 *
 * Mapping Firebase Firestore:
 *   restaurant: {id, name, location: {lat, lng}, price_range, taste_vector: [], rating, opening_hours}
 *
 * Mỗi nhà hàng được biểu diễn dưới dạng vector đặc trưng
 * trong cùng không gian với user để tính Cosine Similarity.
 *
 * @module shared/interfaces
 */

export interface IRestaurant {
  /** Firestore document ID */
  id?: string;

  /** Tên nhà hàng */
  name: string;

  /** Toạ độ GPS */
  location: { lat: number; lng: number };

  /** Địa chỉ nhà hàng */
  address?: string;

  /**
   * Phân khúc giá của nhà hàng — mapping: priceRange trong Firebase.
   * 1: Rẻ (< 50,000 VND)
   * 2: Trung bình (50,000 – 199,999 VND)
   * 3: Sang trọng (≥ 200,000 VND)
   */
  priceRange: number;

  /**
   * Vector đặc trưng ẩm thực — giá trị [0.0, 1.0] cho mỗi chiều.
   *
   * Cùng không gian 8 chiều với user taste_vector:
   *   [0] cay, [1] ngot, [2] man, [3] chua,
   *   [4] beo, [5] thanh_dam, [6] hai_san, [7] chay
   *
   * Ví dụ: Phở → [0.3, 0.1, 0.7, 0.2, 0.4, 0.5, 0.0, 0.0]
   *   (mặn vừa, thanh đạm, không hải sản, không chay)
   */
  tasteVector: number[];

  /** Đánh giá cộng đồng (0–5) */
  rating: number;

  /** Thành phần nguyên liệu — dùng kiểm tra dị ứng */
  menu_ingredients?: string[];

  /** Tags bổ sung: gia_dinh, yen_tinh, co_cho_do_xe... */
  tags?: string[];

  /** Giờ hoạt động — vd: "07:00-22:00" */
  opening_hours?: string;
}
