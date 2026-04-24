import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ShopeeFoodLoader: Service quản lý dữ liệu quán ăn ShopeeFood.
 * Load dữ liệu geocoded từ file JSON khi server khởi động và cung cấp
 * cho các module khác sử dụng (thay thế cho việc quét LocationIQ + fake data).
 *
 * Dữ liệu đã được crawl từ ShopeeFood (56 shops, 592 foods) tại TP.HCM
 * và đã geocode tọa độ cho từng quán.
 */

/** Interface mô tả cấu trúc một món ăn từ ShopeeFood */
interface ShopeeFoodItem {
  name: string;
  description: string;
  price: number;
  price_display: string;
  price_value: number;
  photo_id: string;
  image_url: string;
  group_name: string;
  category: string;
  is_popular: boolean;
  total_like: number;
  local_image: string;
  restaurant_name: string;
  restaurant_url: string;
}

/** Interface mô tả cấu trúc một shop từ ShopeeFood (sau khi geocode) */
interface ShopeeFoodShop {
  id: string;
  name: string;
  url: string;
  delivery_id: string;
  address: string;
  rating: number;
  cover_image: string;
  opening_hours?: { open: string; close: string };
  price_range?: { min: number; max: number; display: string };
  foods: ShopeeFoodItem[];
  location: { type: string; coordinates: [number, number] };
  geocodeStrategy: string;
}

/** Interface dữ liệu đã transform sang format tương thích RestaurantDto */
export interface TransformedRestaurant {
  id: string;
  name: string;
  address: string;
  location: { type: string; coordinates: [number, number] };
  priceRange: number; // 1-3 for filtering
  price_range?: { min: number; max: number; display: string }; // Detailed data
  rating: number;
  menu: {
    name: string;
    price: number;
    description?: string;
    category?: string;
    isSnack?: boolean;
    imageUrl?: string;
  }[];
  openingHours: { open: string; close: string };
  coverImage?: string;
  shopUrl?: string;
}

@Injectable()
export class ShopeeFoodLoader implements OnModuleInit {
  private restaurants: TransformedRestaurant[] = [];
  private isLoaded = false;

  /**
   * Tự động được gọi khi NestJS module khởi tạo xong.
   * Load dữ liệu từ file JSON vào bộ nhớ.
   */
  onModuleInit() {
    this.loadData();
  }

  /**
   * Đọc file shopeefood_geocoded.json và transform sang format RestaurantDto.
   */
  private loadData() {
    try {
      const filePath = path.join(
        process.cwd(),
        'data',
        'shopeefood_geocoded.json',
      );

      if (!fs.existsSync(filePath)) {
        console.error(
          '❌ [ShopeeFoodLoader] Không tìm thấy file shopeefood_geocoded.json!',
        );
        console.error(
          '   Hãy chạy: node scripts/geocode-shops-v2.mjs để tạo file này.',
        );
        return;
      }

      const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const shops: ShopeeFoodShop[] = rawData.shops;

      this.restaurants = shops.map((shop) => this.transformShop(shop));
      this.isLoaded = true;

      console.log(
        `✅ [ShopeeFoodLoader] Đã load ${this.restaurants.length} quán ăn từ ShopeeFood.`,
      );
      console.log(
        `   📊 Tổng cộng ${this.restaurants.reduce((sum, r) => sum + r.menu.length, 0)} món ăn.`,
      );
      console.log(
        `   📍 Geocode stats: ${rawData.geocode_stats?.nominatim_exact || 0} chính xác, ${rawData.geocode_stats?.district_fallback || 0} fallback quận.`,
      );
    } catch (error) {
      console.error(
        '❌ [ShopeeFoodLoader] Lỗi khi load dữ liệu:',
        error.message,
      );
    }
  }

  /**
   * Transform một shop từ ShopeeFood sang format tương thích RestaurantDto.
   * Mapping:
   * - shop.id → id (unique identifier)
   * - shop.name → name
   * - shop.address → address
   * - shop.location → location (GeoJSON Point)
   * - shop.price_range → priceRange (1-3)
   * - shop.rating → rating
   * - shop.foods → menu (array of MenuItemDto)
   * - shop.opening_hours → openingHours
   */
  private transformShop(shop: ShopeeFoodShop): TransformedRestaurant {
    // Xác định phân khúc giá dựa trên price_range
    let priceRange = 2; // Mặc định: Trung bình
    if (shop.price_range) {
      const avgPrice = (shop.price_range.min + shop.price_range.max) / 2;
      if (avgPrice <= 40000) priceRange = 1; // Rẻ
      else if (avgPrice <= 100000) priceRange = 2; // Trung bình
      else priceRange = 3; // Sang
    }

    // Danh sách từ khóa để nhận diện món ăn vặt (snack)
    const snackKeywords = [
      'trà',
      'cà phê',
      'cafe',
      'coffee',
      'sinh tố',
      'nước ép',
      'kem',
      'bánh',
      'chè',
      'sữa',
      'smoothie',
      'juice',
      'trân châu',
      'matcha',
      'yogurt',
    ];

    // Transform menu items
    const menu = (shop.foods || []).map((food) => {
      const nameLower = food.name.toLowerCase();
      const isSnack = snackKeywords.some((kw) => nameLower.includes(kw));

      return {
        name: food.name,
        price: food.price || food.price_value || 0,
        description: food.description || '',
        category: food.category || food.group_name || 'Khác',
        isSnack,
        imageUrl: food.image_url || '',
      };
    });

    // Kiểm tra và xử lý giờ mở cửa (Fallback nếu dữ liệu trống)
    const openingHours = (shop.opening_hours && shop.opening_hours.open && shop.opening_hours.close)
      ? shop.opening_hours
      : { open: '07:00', close: '22:00' };

    return {
      id: `shopee_${shop.id}`,
      name: shop.name,
      address: shop.address,
      location: shop.location,
      priceRange,
      price_range: shop.price_range,
      rating: shop.rating || 4.0,
      menu,
      openingHours,
      coverImage: shop.cover_image || '',
      shopUrl: shop.url || '',
    };
  }

  /**
   * Lấy toàn bộ danh sách quán ăn đã transform.
   * Được gọi bởi RawFilterHelper để thay thế Firestore query.
   */
  getAllRestaurants(): TransformedRestaurant[] {
    if (!this.isLoaded) {
      console.warn(
        '⚠️ [ShopeeFoodLoader] Dữ liệu chưa được load, đang thử load lại...',
      );
      this.loadData();
    }
    return this.restaurants;
  }

  /**
   * Lấy tổng số quán ăn có sẵn.
   */
  getCount(): number {
    return this.restaurants.length;
  }
}
