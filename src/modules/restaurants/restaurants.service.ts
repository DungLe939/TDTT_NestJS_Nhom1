/**
 * Restaurants Service
 *
 * Chịu trách nhiệm truy vấn dữ liệu nhà hàng từ Firebase Firestore.
 * Tách biệt data access khỏi logic thuật toán trong EngineService.
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { dc } from '../../providers/dataconnect.provider';
// Chỉ định chính xác file .js để tránh lỗi MODULE_NOT_FOUND
import { listFoods } from '@dataconnect/admin-generated';
import { IRestaurant } from '../../shared/interfaces/restaurant.interface';
import { IDish } from '../../shared/interfaces/dish.interface';
import NodeCache = require('node-cache');

@Injectable()
export class RestaurantsService {
  private readonly logger = new Logger(RestaurantsService.name);
  private readonly cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

  async findByGuestId(guestId: string): Promise<IRestaurant[]> {
    const normalizedGuestId = guestId?.trim();
    if (!normalizedGuestId) {
      throw new BadRequestException('guest_id is required');
    }

    // ---- Bước 1: Kiểm tra cache (Để tránh gọi DB liên tục) ----
    const cachedData = this.cache.get<IRestaurant[]>(normalizedGuestId);
    if (cachedData) {
      return cachedData;
    }

    try {

      // ---- Bước 2: Query Data Connect ----
      const response = await listFoods(dc, { limit: 1000 });
      
      const foodItems = response?.data?.foodItems;

      if (!foodItems || foodItems.length === 0) {
        return [];
      }

      // ---- Bước 3: Ánh xạ dữ liệu sang IRestaurant interface ----
      const restaurantMap = new Map<string, IRestaurant>();

      foodItems.forEach((item) => {
        const shop = item.shop;
        let restaurant = restaurantMap.get(shop.id);

        if (!restaurant) {
          restaurant = {
            id: shop.id,
            name: shop.name,
            location: {
              lat: (shop as any).lat || 10.762622,
              lng: (shop as any).lng || 106.660172,
            },
            address: (shop as any).address || `Địa chỉ tại Quận 1 (ID: ${shop.id})`,
            priceRange: 2,
            tasteVector: (shop as any).tasteVector || (shop as any).taste_vector || [],
            rating: shop.rating || 4.0,
            tags: item.category ? [item.category.name] : [],
            opening_hours: (shop as any).openingHours || ((shop as any).openTime ? `${(shop as any).openTime}-${(shop as any).closeTime}` : "08:00-22:00"),
            cover_image: (shop as any).coverImage || null,
          } as IRestaurant;
          restaurantMap.set(shop.id, restaurant);
        } else if (item.category) {
          if (!restaurant.tags) restaurant.tags = [];
          if (!restaurant.tags.includes(item.category.name)) {
            restaurant.tags.push(item.category.name);
          }
        }
      });

      const restaurants = Array.from(restaurantMap.values());
      
      // ---- Bước 4: Lưu vào cache ----
      this.cache.set(normalizedGuestId, restaurants);

      return restaurants;
    } catch (error) {
      this.logger.error(`Error querying Data Connect: ${error.message}`);
      return [];
    }
  }

  async findDishesByGuestId(guestId: string): Promise<IDish[]> {
    const normalizedGuestId = guestId?.trim();
    if (!normalizedGuestId) {
      throw new BadRequestException('guest_id is required');
    }

    const cacheKey = `dishes_${normalizedGuestId}`;
    const cachedData = this.cache.get<IDish[]>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    try {
      const response = await listFoods(dc, { limit: 1000 });
      
      const foodItems = response?.data?.foodItems;

      if (!foodItems || foodItems.length === 0) {
        return [];
      }

      const dishes: IDish[] = foodItems.map(item => {
        const shop = item.shop;
        return {
          id: item.id,
          name: item.name,
          price: item.price || 50000,
          description: (item as any).description || null,
          image_url: (item as any).imageUrl || null,
          tags: item.category ? [item.category.name] : [],
          rating: shop.rating || 4.0,
          restaurantId: shop.id,
          restaurant: {
            id: shop.id,
            name: shop.name,
            location: {
              lat: (shop as any).lat || 10.762622,
              lng: (shop as any).lng || 106.660172,
            },
            address: (shop as any).address || `Địa chỉ tại Quận 1 (ID: ${shop.id})`,
            priceRange: 2,
            tasteVector: (shop as any).tasteVector || (shop as any).taste_vector || [],
            rating: shop.rating || 4.0,
            tags: item.category ? [item.category.name] : [],
            opening_hours: (shop as any).openingHours || ((shop as any).openTime ? `${(shop as any).openTime}-${(shop as any).closeTime}` : "08:00-22:00"),
            cover_image: (shop as any).coverImage || null,
          } as IRestaurant
        };
      });

      this.cache.set(cacheKey, dishes);

      return dishes;
    } catch (error) {
      this.logger.error(`Lỗi khi truy vấn Data Connect cho món ăn: ${error.message}`);
      return [];
    }
  }
}
