import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { RestaurantDto } from '../../restaurants/dto/restaurant.dto';

/**
 * GeminiScoringHelper: Chấm điểm nhà hàng theo sở thích người dùng bằng AI.
 *
 * === CHIẾN LƯỢC TỐI ƯU ===
 * 1. Prompt CỰC NGẮN: AI chỉ trả về điểm 3 bữa cho mỗi quán (không sinh category, không sinh isSnack).
 *    → Response ngắn ~80% so với prompt cũ → nhanh hơn đáng kể.
 * 2. CHUNK_SIZE = 8 quán/chunk (tăng từ 5 vì response nhỏ hơn nhiều).
 * 3. Gọi SONG SONG (Promise.all) tất cả chunk.
 * 4. MERGE: Sau khi nhận điểm từ AI, merge lại với data gốc để gắn đầy đủ
 *    menu, address, location, rating, priceRange, openingHours, coverImage.
 *    → menu[].category lấy từ data ShopeeFood (đúng & không cần AI sinh lại).
 * 5. RETRY: 3 lần/chunk, lần cuối dùng model backup.
 */
@Injectable()
export class GeminiScoringHelper {
  private genAI: GoogleGenerativeAI;
  private fastModel: any;
  private backupModel: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || '';
    this.genAI = new GoogleGenerativeAI(apiKey);

    // Model chính: gemini-2.5-flash-lite — nhanh, phù hợp scoring đơn giản
    this.fastModel = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
    });

    // Model dự phòng: gemini-2.5-flash
    this.backupModel = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
    });
  }

  /**
   * scoreRestaurantsWithAI:
   * 1. Chia nhà hàng thành chunk nhỏ.
   * 2. Gửi từng chunk cho Gemini để lấy điểm 3 bữa.
   * 3. Merge kết quả AI với data gốc (menu, location, rating...).
   * 4. Trả về mảng nhà hàng đã được chấm điểm + đầy đủ metadata.
   */
  async scoreRestaurantsWithAI(
    restaurants: RestaurantDto[],
    preferences: any,
    mealBudgets: any,
  ): Promise<any[]> {
    const CHUNK_SIZE = 8; // Tăng từ 5 lên 8 vì prompt mới nhỏ hơn nhiều
    const chunks: RestaurantDto[][] = [];
    for (let i = 0; i < restaurants.length; i += CHUNK_SIZE) {
      chunks.push(restaurants.slice(i, i + CHUNK_SIZE));
    }

    const startTime = Date.now();

    // Gọi song song tất cả chunk để tiết kiệm thời gian
    const chunkPromises = chunks.map((chunk, index) =>
      this.scoreChunkWithRetry(chunk, preferences, mealBudgets, index),
    );
    const scoresResults = await Promise.all(chunkPromises);

    // scoresResults: mảng [{id, scores}] từ AI
    // Cần merge lại với data gốc để có đầy đủ menu, location, rating...
    const scoresMap = new Map<string, any>();
    scoresResults.flat().forEach((item: any) => {
      if (item?.id) scoresMap.set(item.id, item);
    });

    // Merge: với mỗi quán gốc, gắn kèm scores từ AI (nếu có)
    const merged = restaurants.map((res: any) => {
      const aiResult = scoresMap.get(res.id);
      return {
        id: res.id,
        restaurantName: res.name || res.restaurantName,
        address: res.address,
        location: res.location,
        rating: res.rating || 4.0,
        priceRange: res.priceRange || 2,
        openingHours: res.openingHours || { open: '07:00', close: '22:00' },
        coverImage: res.coverImage || '',
        // menu giữ nguyên từ data ShopeeFood — category đã có sẵn
        menu: (res.menu || []).map((m: any) => ({
          name: m.name,
          price: m.price,
          category: m.category || 'Khác', // Lấy từ ShopeeFood, không cần AI sinh lại
          imageUrl: m.imageUrl || '',
          description: m.description || '',
        })),
        // scores lấy từ AI; nếu AI không trả được thì dùng fallback
        scores: aiResult?.scores || {
          breakfast: { score: Math.floor(Math.random() * 40) + 50, suggestedTime: '08:00' },
          lunch: { score: Math.floor(Math.random() * 40) + 50, suggestedTime: '12:30' },
          dinner: { score: Math.floor(Math.random() * 40) + 50, suggestedTime: '19:00' },
        },
      };
    });

    const elapsed = Date.now() - startTime;
    return merged;
  }

  /**
   * Gọi Gemini cho 1 chunk với retry tối đa 3 lần.
   * Prompt RÚT GỌN: Chỉ hỏi điểm 3 bữa, không sinh category/isSnack.
   * → Response ngắn ~80% → parse nhanh hơn, ít lỗi JSON hơn.
   */
  private async scoreChunkWithRetry(
    chunk: RestaurantDto[],
    preferences: any,
    mealBudgets: any,
    chunkIndex: number,
  ): Promise<any[]> {
    const MAX_RETRIES = 3;

    // Chỉ gửi id + name + tối đa 5 tên món (để AI hiểu loại quán)
    const minifiedData = chunk.map((r: any) => ({
      id: r.id,
      name: r.name || r.restaurantName,
      // Gửi tên món để AI biết quán bán gì (phục vụ matching sở thích/dị ứng)
      dishes: (r.menu || []).slice(0, 5).map((m: any) => m.name),
    }));

    const prompt = `Chấm điểm phù hợp của các nhà hàng cho từng bữa ăn. CHỈ TRẢ VỀ JSON THUẦN TÚY, KHÔNG thêm text hay markdown.

KHÁCH HÀNG:
- Thích: ${preferences.favoriteFoods?.join(', ') || 'Không có'}
- Không thích: ${preferences.dislikedFoods?.join(', ') || 'Không có'}
- Dị ứng (bắt buộc score = -999): ${preferences.allergies?.join(', ') || 'Không có'}
- Khẩu vị: ${preferences.states?.join(', ') || 'Không có'}

NGÂN SÁCH/NGƯỜI: Sáng ${mealBudgets.breakfast}đ, Trưa ${mealBudgets.lunch}đ, Tối ${mealBudgets.dinner}đ.

CÁCH CHẤM (0-100):
- Phân tích tên quán + tên các món xem phù hợp sở thích không → +30
- Phù hợp loại bữa (sáng/trưa/tối) → +50
- Quán có món gây dị ứng → tất cả scores = -999

FORMAT JSON (chỉ trả mảng này, không gì khác):
[{"id":"...","scores":{"breakfast":{"score":80,"suggestedTime":"08:00"},"lunch":{"score":90,"suggestedTime":"12:30"},"dinner":{"score":70,"suggestedTime":"19:00"}}}]

DỮ LIỆU:
${JSON.stringify(minifiedData)}`;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const model = attempt < MAX_RETRIES ? this.fastModel : this.backupModel;
      const modelName = attempt < MAX_RETRIES ? 'lite' : 'flash';

      try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Trích xuất JSON từ response (bỏ markdown nếu có)
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        const cleanJson = jsonMatch
          ? jsonMatch[0]
          : responseText.replace(/```json|```/g, '').trim();

        const parsed = JSON.parse(cleanJson);
        return parsed;
      } catch (error: any) {
        const msg = (error.message || String(error)).substring(0, 100);
        console.error(`  ❌ Chunk ${chunkIndex + 1}: Lỗi ${attempt}/${MAX_RETRIES} [${modelName}] - ${msg}`);

        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    console.warn(`  ⚠️ Chunk ${chunkIndex + 1}: Hết ${MAX_RETRIES} lần retry, dùng fallback điểm ngẫu nhiên`);
    return []; // Trả về rỗng → scoring.ts sẽ dùng fallback scores ngẫu nhiên
  }
}
