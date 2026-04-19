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
     * Lọc các quán có guest_id phù hợp.
     */
    const snapshot = await db.collection('restaurants')
      .where('guest_id', '==', guest_id)
      .get();

    if (snapshot.empty) {
      return [];
    }

    /**
     * 2. Tính toán bán kính tìm kiếm:
     */
    const maxRadius = 10000 + (travelDays * 2500);
    const limitCount = Math.max(100, travelDays * 40);

    /**
     * 3. Lọc sơ bộ:
     */
    const rawRestaurants = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as any))
      .filter(restaurant => {
        // Lọc theo mức giá (Thực hiện lọc tại Server thay vì Firestore để không cần tạo Index)
        if (restaurant.priceRange > globalMaxPriceRange) return false;

        // Kiểm tra Rating có đạt chuẩn không (>= 2.5)
        const isGoodRating = (restaurant.rating || 4.0) >= 2.5;

        // Tính toán khoảng cách thực tế từ vị trí hiện tại đến nhà hàng
        const dist = calculateDistance(
          currentLocation.lat,
          currentLocation.lng,
          restaurant.location.coordinates[1], // Vĩ độ
          restaurant.location.coordinates[0]  // Kinh độ
        );

        restaurant.distance = dist;

        return isGoodRating && dist <= maxRadius;
      })
      /**
       * 4. Sắp xếp theo khoảng cách
       */
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limitCount);

    return rawRestaurants;
  }
}
