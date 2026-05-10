import { Injectable } from '@nestjs/common';
import { LocationDto } from '../dto/location.dto';
import { calculateDistance } from '../algorithms/haversine';
import { ShopeeFoodLoader } from './shopeefood-loader';

/**
 * RawFilterHelper: Hỗ trợ lọc danh sách nhà hàng thô từ dữ liệu ShopeeFood.
 * 
 * Thực hiện các bước lọc cơ bản về giá, khoảng cách địa lý và đánh giá.
 */
@Injectable()
export class RawFilterHelper {
  constructor(private readonly shopeeFoodLoader: ShopeeFoodLoader) { }

  /**
   * rawData: Lấy dữ liệu nhà hàng ShopeeFood và thực hiện lọc sơ bộ.
   *
   * @param currentLocation Vị trí người dùng chọn (tọa độ từ geocoding)
   * @param globalMaxPriceRange Mức giá tối đa người dùng chấp nhận (1-3)
   * @param guest_id ID phiên làm việc (giữ lại cho tương thích, không dùng để query DB nữa)
   * @param travelDays Số ngày du lịch (dùng để tính toán bán kính tìm kiếm)
   */
  async rawData(
    currentLocation: LocationDto,
    globalMaxPriceRange: number,
    guest_id: string,
    travelDays: number = 3,
  ): Promise<any[]> {
    /**
     * 1. Lấy dữ liệu từ ShopeeFoodLoader
     * Dữ liệu ShopeeFood đã được load sẵn khi server khởi động
     */
    const allRestaurants = this.shopeeFoodLoader.getAllRestaurants();

    if (!allRestaurants || allRestaurants.length === 0) {
      return [];
    }

    /**
     * 2. Tính toán bán kính tìm kiếm:
     * Vì dữ liệu chỉ nằm trong TP.HCM nên mở rộng bán kính hơn
     * để đảm bảo có đủ quán cho lịch trình.
     * Mặc định: 15km + 3km cho mỗi ngày thêm.
     */
    const maxRadius = 15000 + travelDays * 3000;

    // Giới hạn số lượng kết quả
    const limitCount = Math.max(50, travelDays * 20); // Tối thiểu lấy hết 50 quán

    /**
     * 3. Lọc sơ bộ:
     * Duyệt qua danh sách quán thu được từ ShopeeFood
     */
    const rawRestaurants = allRestaurants
      .map((restaurant) => ({
        ...restaurant,
        guest_id,
      }))
      .filter((restaurant) => {
        // Lọc theo mức giá
        if (restaurant.priceRange > globalMaxPriceRange) return false;

        // Kiểm tra Rating có đạt chuẩn không (>= 2.5)
        const isGoodRating = (restaurant.rating || 4.0) >= 2.5;

        // Tính toán khoảng cách thực tế từ vị trí hiện tại đến nhà hàng (haversine)
        const dist = calculateDistance(
          currentLocation.lat,
          currentLocation.lng,
          restaurant.location.coordinates[1], // Vĩ độ
          restaurant.location.coordinates[0]  // Kinh độ
        );

        // Gắn thêm thông tin khoảng cách để dùng cho việc sắp xếp
        (restaurant as any).distance = dist;

        // Trả về true nếu thỏa mãn cả hai điều kiện
        return isGoodRating && dist <= maxRadius;
      })
      /**
       * 4. Sắp xếp theo khoảng cách
       */
      .sort((a: any, b: any) => a.distance - b.distance)
      .slice(0, limitCount);

    return rawRestaurants;
  }
}
