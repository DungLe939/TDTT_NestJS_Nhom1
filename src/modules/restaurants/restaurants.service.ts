/**
 * Restaurants Service
 *
 * Chịu trách nhiệm truy vấn dữ liệu nhà hàng từ Firebase Firestore.
 * Tách biệt data access khỏi logic thuật toán trong EngineService.
 *
 * Pattern: Giống RawFilterHelper trong scheduler module
 *   — import `db` từ firebase.provider → query Firestore theo guest_id.
 *
 * Tối ưu quota Firestore
 *   — In-memory cache theo guest_id, TTL = 5 phút
 *   — .limit(500) để giới hạn số documents đọc từ Firestore
 *
 * @module restaurants
 */

import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../providers/firebase.provider';
import { IRestaurant } from '../../shared/interfaces/restaurant.interface';
import NodeCache = require('node-cache');

@Injectable()
export class RestaurantsService {
  private readonly logger = new Logger(RestaurantsService.name);

  /**
   * Bộ đệm chuyên nghiệp (node-cache) có cơ chế tự dọn rác.
   * stdTTL: 300s (5 phút) — thời gian sống của dữ liệu.
   * checkperiod: 60s — cứ mỗi 60 giây dọn rác (xóa data hết hạn khỏi RAM).
   * Điều này khắc phục triệt để lỗi Memory Leak do Map thủ công.
   */
  private readonly cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

  /**
   * Lấy danh sách nhà hàng từ Firestore cho tính năng gợi ý nhóm.
   *
   * Luồng xử lý:
   *   1. Kiểm tra cache → nếu còn hạn thì trả về ngay (0 Firestore reads)
   *   2. Query Firestore với .limit(500) → map sang IRestaurant
   *   3. Lưu kết quả vào cache (TTL 5 phút)
   *
   * Mapping Firestore → IRestaurant:
   *   - location: GeoJSON {type, coordinates: [lng, lat]} → {lat, lng}
   *   - openingHours: {open, close} → "open-close" string
   *   - priceRange, taste_vector, rating: giữ nguyên
   *
   * @param guestId - ID phiên làm việc (lấy từ middleware)
   * @returns Danh sách nhà hàng đã map sang IRestaurant interface
   */
  async findByGuestId(guestId: string): Promise<IRestaurant[]> {
    // ---- Bước 1: Kiểm tra cache ----
    const cachedData = this.cache.get<IRestaurant[]>(guestId);
    if (cachedData) {
      this.logger.log(
        `Trả về ${cachedData.length} nhà hàng từ cache cho guest_id: ${guestId}`,
      );
      return cachedData;
    }

    // ---- Bước 2: Query Firestore ----
    const snapshot = await db
      .collection('restaurants')
      .where('guest_id', '==', guestId)
      .limit(500)
      .get();

    if (snapshot.empty) {
      this.logger.warn(
        `Không tìm thấy nhà hàng nào cho guest_id: ${guestId}. ` +
        'Hãy gọi endpoint /schedule/searchLocation trước để quét dữ liệu nhà hàng.',
      );
      return [];
    }

    this.logger.log(`Đã tìm thấy ${snapshot.size} nhà hàng cho guest_id: ${guestId}`);

    const restaurants: IRestaurant[] = snapshot.docs.map((doc) => {
      const data = doc.data();

      // Map GeoJSON coordinates [lng, lat] sang {lat, lng}
      const lat = data.location?.coordinates?.[1] ?? 0;
      const lng = data.location?.coordinates?.[0] ?? 0;

      // Map openingHours object sang string
      let openingHours: string | undefined;
      if (data.openingHours && typeof data.openingHours === 'object') {
        openingHours = `${data.openingHours.open}-${data.openingHours.close}`;
      } else if (typeof data.opening_hours === 'string') {
        openingHours = data.opening_hours;
      }

      return {
        id: doc.id,
        name: data.name,
        location: { lat, lng },
        priceRange: data.priceRange ?? 2,
        taste_vector: data.taste_vector ?? [],
        rating: data.rating ?? 4.0,
        menu_ingredients: data.menu_ingredients,
        tags: data.tags,
        opening_hours: openingHours,
      } as IRestaurant;
    });

    // ---- Bước 3: Lưu vào cache ----
    // Do node-cache đã cấu hình mặc định là 300s nên chỉ cần truyền key & data
    this.cache.set(guestId, restaurants);

    return restaurants;
  }
}

