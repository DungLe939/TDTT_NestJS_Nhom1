import { Injectable } from '@nestjs/common';
import { db } from '../../../providers/firebase.provider';
import { RestaurantDto } from '../../restaurants/dto/restaurant.dto';
import { LocationDto } from '../dto/location.dto';
import { calculateDistance } from '../algorithms/haversine';

/**
 * RawFilterHelper: Hỗ trợ lọc danh sách nhà hàng thô từ cơ sở dữ liệu Firestore.
 * Thực hiện các bước lọc cơ bản về giá, khoảng cách địa lý và đánh giá.
 */
@Injectable()
export class RawFilterHelper {
  /**
   * rawData: Lấy dữ liệu nhà hàng và thực hiện lọc sơ bộ.
   *
   * @param currentLocation Vị trí hiện tại của người dùng(nếu không bật GPS thì lấy vị trí được trả về từ locationIQ)
   * @param globalMaxPriceRange Mức giá tối đa người dùng chấp nhận
   * @param guest_id ID phiên làm việc của user(lấy từ middlware)
   * @param travelDays Số ngày du lịch (dùng để tính toán bán kính tìm kiếm)
   */
  async rawData(
    currentLocation: LocationDto,
    globalMaxPriceRange: number,
    guest_id: string,
    travelDays: number = 3,
  ): Promise<any[]> {
    /**
     * 1. Truy vấn Firestore:
     * Lọc các quán có guest_id phù hợp và nằm trong khoảng giá cho phép.
     * Khi lưu nhà hàng vào DB, có lưu kèm guest_id nên có thể truy vấn dễ dàng
     */
    const snapshot = await db
      .collection('restaurants')
      .where('guest_id', '==', guest_id)
      .where('priceRange', '<=', globalMaxPriceRange)
      .get();

    if (snapshot.empty) {
      return [];
    }

    /**
     * 2. Tính toán bán kính tìm kiếm:
     * Càng đi nhiều ngày, phạm vi tìm kiếm quán ăn càng được mở rộng.
     * Cơ sở: 10km + 2.5km cho mỗi ngày du lịch thêm.
     */
    const maxRadius = 10000 + travelDays * 2500;

    // Giới hạn số lượng kết quả lấy ra để đảm bảo hiệu năng
    // đi thêm 1 ngày thì tăng thêm 40 nhà hàng => đảm bảo không có quá ít lựa chọn
    const limitCount = Math.max(100, travelDays * 40);

    /**
     * 3. Lọc sơ bộ:
     * Duyệt qua danh sách quán thu được
     */
    const rawRestaurants = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as any)
      .filter((restaurant) => {
        // Kiểm tra Rating có đạt chuẩn không (>= 2.5)
        const isGoodRating = (restaurant.rating || 4.0) >= 2.5;

        // Tính toán khoảng cách thực tế từ vị trí hiện tại đến nhà hàng
        // Ở đây dùng thuật toán harvesine
        const dist = calculateDistance(
          currentLocation.lat,
          currentLocation.lng,
          restaurant.location.coordinates[1], // Vĩ độ (Latitude)
          restaurant.location.coordinates[0], // Kinh độ (Longitude)
        );

        // Gắn thêm thông tin khoảng cách để dùng cho việc sắp xếp
        restaurant.distance = dist;

        // Trả về true nếu thỏa mãn cả hai điều kiện: đánh giá tốt và trong bán kính cho phép
        return isGoodRating && dist <= maxRadius;
      })
      /**
       * 4. Sắp xếp theo khoảng cách:
       * Ưu tiên các quán gần vị trí hiện tại nhất.
       */
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limitCount);

    return rawRestaurants;
  }
}
