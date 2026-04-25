import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { RestaurantDto } from '../../restaurants/dto/restaurant.dto';

/**
 * DANH SÁCH CATEGORY CHUẨN (Tiếng Việt, khái quát)
 * AI bắt buộc phải chọn từ danh sách này.
 * Dùng chung cho cả Gemini scoring lẫn Fallback trong scoring.ts.
 */
export const VALID_CATEGORIES = [
  'Món nước',                   // Phở, bún, mì, hủ tiếu, miến...
  'Cơm - Xôi - Cháo',          // Cơm tấm, cơm gà, xôi, cháo...
  'Bánh mì & Món cuốn',        // Bánh mì, bánh cuốn, bánh xèo, gỏi cuốn...
  'Ăn vặt & Đường phố',        // Ốc, nem, bánh tráng, xiên que...
  'Lẩu & Đồ nướng',            // Lẩu, BBQ, nướng, xiên...
  'Trà & Cà phê',              // Cà phê, trà sữa, trà đào...
  'Tráng miệng & Giải khát',   // Chè, kem, sinh tố, nước ép, nước ngọt...
  'Đặc sản địa phương',        // Các món đặc trưng vùng miền, không thuộc nhóm trên
] as const;

/**
 * GeminiScoringHelper: Hỗ trợ chấm điểm nhà hàng bằng AI.
 *
 * === CHIẾN LƯỢC TỐI ƯU (Đã benchmark) ===
 * 1. MODEL: gemini-2.5-flash-lite (~1s/request), KHÔNG dùng JSON mode.
 * 2. BACKUP: gemini-2.5-flash khi lite lỗi.
 * 3. CHUNK SIZE = 5 quán + tối đa 8 món/quán → tránh response quá dài bị cắt.
 * 4. PARALLEL: Promise.all tất cả chunk.
 * 5. RETRY: 3 lần/chunk.
 * 6. CATEGORY CỐ ĐỊNH: 8 nhóm khái quát tiếng Việt.
 */
@Injectable()
export class GeminiScoringHelper {
  private genAI: GoogleGenerativeAI;
  private fastModel: any;
  private backupModel: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || '';
    this.genAI = new GoogleGenerativeAI(apiKey);

    // Model chính: gemini-2.5-flash-lite — siêu nhanh (~1s), KHÔNG bật JSON mode
    this.fastModel = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
    });

    // Model dự phòng: gemini-2.5-flash
    this.backupModel = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
    });
  }

  /**
   * scoreRestaurantsWithAI: Chia nhỏ → gọi song song → gộp kết quả.
   */
  async scoreRestaurantsWithAI(
    restaurants: RestaurantDto[],
    preferences: any,
    mealBudgets: any,
  ): Promise<any[]> {
    // Chunk nhỏ hơn (5 quán) để tránh response quá dài bị lỗi JSON
    const CHUNK_SIZE = 5;
    const chunks: RestaurantDto[][] = [];
    for (let i = 0; i < restaurants.length; i += CHUNK_SIZE) {
      chunks.push(restaurants.slice(i, i + CHUNK_SIZE));
    }

    const startTime = Date.now();
    console.log(`🧠 [Gemini] Chấm điểm ${restaurants.length} quán (${chunks.length} chunk x ${CHUNK_SIZE}, SONG SONG)`);

    const chunkPromises: Promise<any[]>[] = chunks.map((chunk, index) =>
      this.scoreChunkWithRetry(chunk, preferences, mealBudgets, index),
    );
    const results = await Promise.all(chunkPromises);

    const merged = results.flat();
    const elapsed = Date.now() - startTime;
    console.log(`✅ [Gemini] Hoàn tất! ${merged.length}/${restaurants.length} kết quả trong ${elapsed}ms`);
    return merged;
  }

  /**
   * Gọi Gemini cho 1 chunk, retry tối đa 3 lần.
   */
  private async scoreChunkWithRetry(
    chunk: RestaurantDto[],
    preferences: any,
    mealBudgets: any,
    chunkIndex: number,
  ): Promise<any[]> {
    const MAX_RETRIES = 3;

    // Minify + giới hạn tối đa 8 món/quán để tránh response quá dài
    const minifiedData = chunk.map((r: any) => ({
      id: r.id,
      name: r.name || r.restaurantName,
      menu: (r.menu || []).slice(0, 8).map((m: any) => ({
        name: m.name,
        price: m.price,
      })),
    }));

    const categoryList = VALID_CATEGORIES.map(c => `"${c}"`).join(', ');

    const prompt = `Phân tích và chấm điểm nhà hàng. CHỈ TRẢ VỀ JSON THUẦN TÚY, KHÔNG thêm text hay markdown.

KHÁCH HÀNG: Thích: ${preferences.favoriteFoods?.join(', ') || 'Không'}. Ghét: ${preferences.dislikedFoods?.join(', ') || 'Không'}. Dị ứng(điểm=-999): ${preferences.allergies?.join(', ') || 'Không'}. Khẩu vị: ${preferences.states?.join(', ') || 'Không'}.
NGÂN SÁCH: Sáng ${mealBudgets.breakfast}đ, Trưa ${mealBudgets.lunch}đ, Tối ${mealBudgets.dinner}đ.
ĐIỂM: Phù hợp buổi +50, sở thích +30, ngân sách +30. isSnack=true cho đồ uống/ăn nhẹ.
BẮT BUỘC category là MỘT trong: ${categoryList}

[{"id":"...","restaurantName":"...","menu":[{"name":"...","price":0,"score":0,"category":"...","isSnack":false,"imageUrl":""}],"scores":{"breakfast":{"score":0,"suggestedTime":"08:00"},"lunch":{"score":0,"suggestedTime":"12:30"},"dinner":{"score":0,"suggestedTime":"19:00"}}}]

DỮ LIỆU:
${JSON.stringify(minifiedData)}`;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const model = attempt < MAX_RETRIES ? this.fastModel : this.backupModel;
      const modelName = attempt < MAX_RETRIES ? 'lite' : 'flash';

      try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Trích xuất JSON từ response (bỏ markdown, text thừa)
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        const cleanJson = jsonMatch
          ? jsonMatch[0]
          : responseText.replace(/```json|```/g, '').trim();

        const parsed = JSON.parse(cleanJson);
        console.log(`  ✅ Chunk ${chunkIndex + 1}: OK lần ${attempt} [${modelName}] (${parsed.length} quán)`);
        return parsed;
      } catch (error: any) {
        const msg = (error.message || String(error)).substring(0, 100);
        console.error(`  ❌ Chunk ${chunkIndex + 1}: Lỗi ${attempt}/${MAX_RETRIES} [${modelName}] - ${msg}`);

        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    console.warn(`  ⚠️ Chunk ${chunkIndex + 1}: Hết ${MAX_RETRIES} lần, dùng Fallback`);
    return [];
  }
}
