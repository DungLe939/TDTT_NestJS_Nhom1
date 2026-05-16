import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ClusteringHelper } from './algorithms/k-means';
import { ScoringHelper } from './utils/scoring';
import { RawFilterHelper } from './utils/raw-filter';
import { PlanCacheHelper } from './utils/plan-cache';
import { calculateDistance } from './algorithms/haversine';
import { ShopeeFoodLoader } from './utils/shopeefood-loader';

@Injectable()
export class SchedulerService {
  constructor(
    private readonly rawFilterHelper: RawFilterHelper,
    private readonly clusteringHelper: ClusteringHelper,
    private readonly scoringHelper: ScoringHelper,
    private readonly planCacheHelper: PlanCacheHelper,
    private readonly shopeeFoodLoader: ShopeeFoodLoader,
  ) { }

  // Hàm lấy tọa độ từ Keyword
  private async getCoordsFromKeyword(keyword: string) {
    try {
      //Gọi api tới openstreetmap
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(keyword)}&format=json&limit=1`;
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Smart-Tourism-App-HCMUS' }, // Nominatim yêu cầu User-Agent
      });

      const data = response.data;
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
      }
      return null;
    } catch (error) {

      return null;
    }
  }

  // Hàm lấy danh sách gợi ý địa điểm (Autocomplete)
  async getLocationSuggestions(keyword: string) {
    try {
      // Gọi api tới openstreetmap với giới hạn 5 kết quả tại VN
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(keyword)}&format=json&limit=5&countrycodes=vn`;
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Smart-Tourism-App-HCMUS' },
      });

      const data = response.data;
      if (data && data.length > 0) {
        return data.map((item: any) => ({
          name: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        }));
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Dữ liệu quán ăn ShopeeFood đã có sẵn trong ShopeeFoodLoader.
   * Chỉ cần geocode keyword → tọa độ rồi trả về xác nhận.
   * Được gọi từ endpoint: /schedule/searchLocation
   */
  async processSearchLocation(keyword: string, guestId: string) {
    // Lấy tọa độ từ keyword (giữ nguyên logic geocoding)
    const coords = await this.getCoordsFromKeyword(keyword);
    if (!coords) return null;

    // Lấy danh sách quán ăn từ ShopeeFood (đã load sẵn khi server khởi động)
    const allRestaurants = this.shopeeFoodLoader.getAllRestaurants();

    return {
      data: allRestaurants,
      coords: coords,
    };
  }


  /**
   * preparePlanData: Bước chuẩn bị (Raw Filter + Clustering) trong luồng Streaming.
   * 1. Nhận vị trí người dùng, số ngày đi (travelDays) và ngân sách (budget).
   * 2. Lấy danh sách quán từ ShopeeFoodLoader.
   * 3. Phân cụm (Clustering) các quán ăn thành N cụm (tương ứng N ngày đi) bằng thuật toán K-means.
   * 4. Lưu toàn bộ kết quả vào RAM Cache. Bước này CHƯA GỌI AI, giúp tiết kiệm thời gian đáng kể.
   */
  async preparePlanData(body: any, guestId: string) {
    const { currentLocation, preferences } = body;
    const budget = Number(body.budget);
    const travelDays = Number(body.travelDays);

    if (!currentLocation || !currentLocation.lat || !currentLocation.lng) {
      throw new Error(
        'Dữ liệu vị trí (currentLocation) không hợp lệ hoặc bị thiếu.',
      );
    }

    // Tính toán cấu hình ngân sách
    const dailyBudget = budget / travelDays;
    const mealBudgetConfig = {
      breakfast: dailyBudget * 0.2,
      lunch: dailyBudget * 0.3,
      dinner: dailyBudget * 0.5,
    };

    let globalMaxPriceRange = 2;
    if (mealBudgetConfig.dinner > 200000) globalMaxPriceRange = 3;

    // Lọc thô dữ liệu
    const rawRestaurants = await this.rawFilterHelper.rawData(
      currentLocation,
      globalMaxPriceRange,
      guestId,
      travelDays,
    );

    if (!rawRestaurants || rawRestaurants.length === 0) {
      return {
        success: false,
        message: 'Không tìm thấy quán ăn phù hợp tại khu vực này.',
      };
    }

    // Thực hiện phân cụm (Clustering) quán ăn theo số ngày đi
    const orderedPlan = this.clusteringHelper.clusteringStep(
      rawRestaurants,
      travelDays,
      currentLocation,
    );

    // LƯU KẾT QUẢ VÀO CLOUD CACHE: Để các lượt gọi sau không phải tính lại bước này
    await this.planCacheHelper.set(guestId, {
      rawRestaurants,
      orderedPlan,
      mealBudgetConfig,
      preferences,
      usedCategories: [],
    });

    return {
      success: true,
      totalDays: travelDays,
      info: { totalBudget: budget, suggestedMealBudget: mealBudgetConfig },
      count: rawRestaurants.length,
    };
  }

  /**
   * createSingleDayPlan: Tạo lịch trình cho một ngày cụ thể (Dùng cho Streaming).
   * 1. Lấy dữ liệu cụm của ngày `dayIndex` từ In-Memory Cache.
   * 2. Gọi `scoringHelper.generateSingleDayPlan` để nhờ AI (Gemini) chấm điểm quán ăn trong cụm.
   *    -> Lưu ý: AI chỉ chấm điểm, KHÔNG sinh metadata, giúp giảm token 80%.
   * 3. Lưu điểm của AI (`scoredRestaurants`) vào cache để phục vụ tính năng "Đổi món" (getSwapOptions)
   *    mà KHÔNG cần gọi lại AI.
   * 4. Lấy dữ liệu gốc từ ShopeeFood (như img, price_range, openingHours) đắp vào kết quả trả về.
   */
  async createSingleDayPlan(guestId: string, dayIndex: number) {
    const cache = await this.planCacheHelper.get(guestId);
    if (!cache) {
      throw new Error(
        'Lỗi: Phiên chuẩn bị dữ liệu đã hết hạn hoặc không tồn tại. Vui lòng thử lại.',
      );
    }

    const dayPlan = cache.orderedPlan[dayIndex];
    if (!dayPlan) {
      throw new Error(
        `Lỗi: Không tìm thấy dữ liệu cho ngày thứ ${dayIndex + 1}.`,
      );
    }

    // Gọi logic ScoringHelper kết hợp với AI (Gemini) để chọn quán cho ngày này
    const result = await this.scoringHelper.generateSingleDayPlan(
      dayPlan,
      cache.mealBudgetConfig,
      cache.preferences,
      cache.usedCategories,
    );

    // Cập nhật danh sách loại món đã ăn để ngày hôm sau AI không chọn trùng
    await this.planCacheHelper.updateUsedCategories(
      guestId,
      result.newUsedCategories,
    );

    // LƯU KẾT QUẢ ĐÃ CHẤM ĐIỂM VÀO CACHE: Để phục vụ tính năng "Đổi món" (Swap Meal)
    // Việc này giúp tránh việc phải gọi lại AI Gemini cực kỳ tốn kém và chậm chạp.
    await this.planCacheHelper.saveDayScores(
      guestId,
      dayIndex,
      result.scoredRestaurants,
    );

    // Bổ sung ảnh món ăn cho kết quả
    const enrichedMeals = {};
    if (result.dayResult.meals) {
      for (const [session, meal] of Object.entries(result.dayResult.meals)) {
        const mealAny = meal as any;
        const originalData = cache.rawRestaurants.find(r => r.id === mealAny.id);
        const selectedDishData = originalData?.menu?.find(m => m.name === mealAny.dish);

        enrichedMeals[session] = {
          ...mealAny,
          img: selectedDishData?.imageUrl || originalData?.coverImage || '',
          price_range: originalData?.price_range,
          openingHours: originalData?.openingHours || { open: '07:00', close: '22:00' }
        };
      }
    }

    return {
      day: dayIndex + 1,
      meals: enrichedMeals,
      snackCandidates: result.snackCandidates,
    };
  }


  //Hàm tạo đường đi ngắn nhất giữa 2 điểm
  // Gọi từ endpoint: /schedule/route
  async getShortestPath(
    userLat: number,
    userLng: number,
    destLat: number,
    destLng: number,
    mode: string = 'car',
    steps: boolean = false,
  ) {
    let url = '';
    try {
      // OSRM API: lng,lat;lng,lat
      const stepsParam = steps ? '&steps=true' : '';
      url = `http://router.project-osrm.org/route/v1/${mode}/${userLng},${userLat};${destLng},${destLat}?overview=full&geometries=geojson${stepsParam}`;
      const response = await axios.get(url);

      if (
        response.data &&
        response.data.routes &&
        response.data.routes.length > 0
      ) {
        const route = response.data.routes[0];
        return {
          distance: route.distance, // khoảng cách: là đường đi ngắn nhất(không phải khoảng cách theo đường chim bay)
          duration: route.duration, // Thời gian đi dự kiến
          geometry: route.geometry, // GeoJSON LineString : danh sách chi tiết các tọa độ trên đường đi
          steps: steps && route.legs && route.legs[0] ? route.legs[0].steps : undefined,
        };
      }

      require('fs').appendFileSync('osrm_error.log', new Date().toISOString() + ' - No Route Found cho: ' + url + '\n');

      return null;
    } catch (error) {
      require('fs').appendFileSync('osrm_error.log', new Date().toISOString() + ' - Lỗi OSRM Routing: ' + (error.response ? JSON.stringify(error.response.data) + ' URL: ' + url : error.message) + '\n');

      return null;
    }
  }

  /**
   * getSwapOptions: Lấy danh sách các món ăn thay thế cho một bữa ăn cụ thể.
   */
  async getSwapOptions(
    guestId: string,
    dayIndex: number,
    mealType: string,
    userLat?: number,
    userLng?: number,
  ) {
    const cache = await this.planCacheHelper.get(guestId);
    if (!cache) return { success: false, message: 'Session expired' };

    let scoredRestaurants = await this.planCacheHelper.getDayScores(
      guestId,
      dayIndex,
    );

    // FALLBACK: Nếu chưa có dayScores trong cache (user click Đổi món quá nhanh
    // hoặc cache không lưu được), dùng rawRestaurants của cụm ngày đó với scores ngẫu nhiên.
    if (!scoredRestaurants || scoredRestaurants.length === 0) {

      const dayPlan = cache.orderedPlan?.[dayIndex];
      if (dayPlan?.cluster?.restaurants?.length > 0) {
        scoredRestaurants = dayPlan.cluster.restaurants.map((res: any) => ({
          id: res.id,
          restaurantName: res.name,
          address: res.address,
          location: res.location,
          rating: res.rating || 4.0,
          priceRange: res.priceRange || 2,
          openingHours: res.openingHours,
          menu: res.menu || [],
          scores: {
            breakfast: { score: Math.floor(Math.random() * 40) + 50 },
            lunch: { score: Math.floor(Math.random() * 40) + 50 },
            dinner: { score: Math.floor(Math.random() * 40) + 50 },
          },
        }));
      } else {
        // Nếu không có cả orderedPlan thì mới thực sự trả về lỗi
        return {
          success: false,
          message: 'Chưa có dữ liệu chấm điểm cho ngày này. Vui lòng tạo lịch trình trước.',
        };
      }
    }

    const sortedRestaurants = [...scoredRestaurants as any[]]
      .sort((a, b) => {
        const scoreA =
          typeof a.scores?.[mealType] === 'object'
            ? a.scores[mealType].score
            : (a.scores?.[mealType] ?? 0);
        const scoreB =
          typeof b.scores?.[mealType] === 'object'
            ? b.scores[mealType].score
            : (b.scores?.[mealType] ?? 0);
        return scoreB - scoreA;
      })
      .slice(0, 50);

    const refLat =
      userLat || cache.orderedPlan[dayIndex]?.cluster?.centroid[1];
    const refLng =
      userLng || cache.orderedPlan[dayIndex]?.cluster?.centroid[0];

    const dishMap = new Map<string, any>();

    sortedRestaurants.forEach((res) => {
      const resScore =
        typeof res.scores?.[mealType] === 'object'
          ? res.scores[mealType].score
          : (res.scores?.[mealType] ?? 0);
      const dist =
        refLat && refLng
          ? calculateDistance(
            refLat,
            refLng,
            res.location?.coordinates?.[1] ?? 0,
            res.location?.coordinates?.[0] ?? 0,
          )
          : 0;

      res.menu?.forEach((item: any) => {
        const existing = dishMap.get(item.name);

        const shouldReplace =
          !existing ||
          resScore > existing.resScore ||
          (resScore === existing.resScore && dist < existing.distance);

        if (shouldReplace) {
          const original =
            cache.orderedPlan[dayIndex]?.cluster?.restaurants.find(
              (r) => r.id === res.id,
            );
          dishMap.set(item.name, {
            ...res,
            address: res.address || original?.address,
            location: res.location || original?.location,
            openingHours: res.openingHours || original?.openingHours,
            dish: item.name,
            img: item.imageUrl || original?.coverImage || '', // Thêm ảnh cho món đổi
            name: res.restaurantName || res.name,
            price: item.price,
            resScore: resScore,
            distance: dist,
          });
        }
      });
    });

    const finalOptions = Array.from(dishMap.values())
      .sort((a, b) => {
        if (b.resScore !== a.resScore) return b.resScore - a.resScore;
        return a.distance - b.distance;
      })
      .slice(0, 50);

    return {
      success: true,
      options: finalOptions,
    };
  }

  /**
   * getAllDishes: Lấy toàn bộ danh sách món ăn từ ShopeeFood
   * [QUAN TRỌNG ĐỂ REVIEW]: 
   * Tính năng "Thêm bữa ăn phụ" đã được làm lại. Không còn dùng AI sinh 'isSnack'.
   * Hàm này trả về toàn bộ quán ăn từ ShopeeFoodLoader. Frontend sẽ tự map category 
   * và cho người dùng tự filter (như Cơm, Bún, Trà sữa, Ăn vặt...).
   */
  async getAllDishes(guestId: string) {
    const cache = await this.planCacheHelper.get(guestId);
    if (cache && cache.rawRestaurants && cache.rawRestaurants.length > 0) {
      // Lấy từ cache phiên của guest (dữ liệu đã lọc theo vị trí + giá)
      return cache.rawRestaurants.map((res: any) => ({
        restaurantId: res.id,
        restaurantName: res.name,
        address: res.address,
        location: res.location,
        rating: res.rating || 4.0,
        priceRange: res.priceRange || 2,
        openingHours: res.openingHours || { open: '07:00', close: '22:00' },
        menu: res.menu || [],
      }));
    }

    // Fallback: nếu chưa có cache thì lấy toàn bộ dữ liệu ShopeeFood
    const allRestaurants = this.shopeeFoodLoader.getAllRestaurants();
    return allRestaurants.map((res) => ({
      restaurantId: res.id,
      restaurantName: res.name,
      address: res.address,
      location: res.location,
      rating: res.rating || 4.0,
      priceRange: res.priceRange || 2,
      openingHours: res.openingHours || { open: '07:00', close: '22:00' },
      menu: res.menu || [],
    }));
  }
}
