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

import { initializeApp, getApps } from 'firebase-admin/app';
import { listAllShopsWithMenu } from '@dataconnect/admin-generated';

@Injectable()
export class ShopeeFoodLoader implements OnModuleInit {
  private restaurants: TransformedRestaurant[] = [];
  private isLoaded = false;

  /**
   * Tự động được gọi khi NestJS module khởi tạo xong.
   * Load dữ liệu từ Firebase Data Connect (PostgreSQL) vào bộ nhớ.
   */
  async onModuleInit() {
    await this.loadData();
  }

  /**
   * Truy vấn Data Connect để lấy toàn bộ danh sách quán và món ăn.
   */
  private async loadData() {
    try {
      // 1. Khởi tạo Firebase Admin nếu chưa có
      if (getApps().length === 0) {
        // Cấu hình Emulator nếu chạy local (được định nghĩa trong .env hoặc mặc định)
        if (process.env.NODE_ENV !== 'production') {
          process.env.FIREBASE_DATA_CONNECT_EMULATOR_HOST = '127.0.0.1:9399';
        }
        initializeApp({
          projectId: 'smart-tourism-abf26',
        });
      }

      // 2. Lấy dữ liệu qua GraphQL Query đã sinh ra
      const res = await listAllShopsWithMenu();
      const shops = res.data.shops;

      if (!shops || shops.length === 0) {
        console.warn('⚠️ [ShopeeFoodLoader] Không có quán ăn nào trong Database! Dữ liệu trống.');
        return;
      }

      // 3. Transform dữ liệu
      this.restaurants = shops.map((shop: any) => this.transformDbShop(shop));
      this.isLoaded = true;
    } catch (error: any) {
      console.error(
        '❌ [ShopeeFoodLoader] Lỗi khi load dữ liệu từ Database:',
        error.message,
      );

      console.warn('⚠️ [ShopeeFoodLoader] Fallback: Đang tải dữ liệu từ file JSON cục bộ...');
      try {
        const filePath = require('path').join(process.cwd(), 'data', 'shopeefood_geocoded.json');
        if (require('fs').existsSync(filePath)) {
          const rawData = JSON.parse(require('fs').readFileSync(filePath, 'utf-8'));
          const fallbackShops = rawData.shops;
          this.restaurants = fallbackShops.map((s: any) => this.transformJsonShop(s));
          this.isLoaded = true;
          console.log(`✅ [ShopeeFoodLoader] Đã load fallback ${this.restaurants.length} quán ăn từ JSON.`);
        }
      } catch (fallbackError: any) {
        console.error('❌ [ShopeeFoodLoader] Fallback thất bại:', fallbackError.message);
      }
    }
  }

  /**
   * Transform từ dữ liệu JSON (dành cho fallback)
   */
  private transformJsonShop(shop: any): TransformedRestaurant {
    let priceRange = 2;
    if (shop.price_range) {
      const avgPrice = (shop.price_range.min + shop.price_range.max) / 2;
      if (avgPrice <= 40000) priceRange = 1;
      else if (avgPrice <= 100000) priceRange = 2;
      else priceRange = 3;
    }

    const menu = (shop.menu || shop.foods || []).map((food: any) => {
      return {
        name: food.name,
        price: food.price || food.price_value || 0,
        description: food.description || '',
        // category lấy từ data ShopeeFood có sẵn (group_name là nhóm món từ ShopeeFood)
        category: food.category || food.group_name || 'Khác',
        imageUrl: food.image_url || '',
      };
    });

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
   * Transform một shop từ Database sang format tương thích RestaurantDto.
   */
  private transformDbShop(shop: any): TransformedRestaurant {
    // Xác định phân khúc giá dựa trên priceMin và priceMax
    let priceRange = 2; // Mặc định: Trung bình
    const min = shop.priceMin || 0;
    const max = shop.priceMax || 0;

    if (min > 0 || max > 0) {
      const avgPrice = (min + max) / 2;
      if (avgPrice <= 40000) priceRange = 1; // Rẻ
      else if (avgPrice <= 100000) priceRange = 2; // Trung bình
      else priceRange = 3; // Sang
    }

    // Transform menu items — category lấy từ data ShopeeFood có sẵn, không cần AI sinh lại
    const menu = (shop.foodItems_on_shop || []).map((food: any) => {
      return {
        name: food.name,
        price: food.price || 0,
        description: food.description || '',
        category: food.category?.name || food.groupName || 'Khác',
        imageUrl: food.imageUrl || '',
      };
    });

    // Kiểm tra và xử lý giờ mở cửa
    const openingHours = {
      open: shop.openTime || '07:00',
      close: shop.closeTime || '22:00',
    };

    return {
      id: shop.externalId || shop.id,
      name: shop.name,
      address: shop.address,
      location: {
        type: 'Point',
        coordinates: [shop.longitude || 106.660172, shop.latitude || 10.762622],
      },
      priceRange,
      price_range: {
        min,
        max,
        display: shop.priceDisplay || '',
      },
      rating: shop.rating || 4.0,
      menu,
      openingHours,
      coverImage: shop.coverImage || '',
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
