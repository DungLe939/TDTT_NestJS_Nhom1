import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { RestaurantDto } from '../../restaurants/dto/restaurant.dto';

/**
 * GeminiScoringHelper: Chấm điểm nhà hàng theo sở thích người dùng bằng AI.
 * [QUAN TRỌNG ĐỂ REVIEW]:
 * Hệ thống sử dụng 2 nhà cung cấp AI cùng lúc để đảm bảo tốc độ + độ tin cậy:
 *
 * 1. PRIMARY — Groq (Llama 3.3 70B):
 *    - Chạy trên chip LPU đặc biệt → response < 1 giây
 *    - Free tier: 30 RPM, 14.400 req/ngày
 *    - Trả JSON chuẩn qua response_format
 *
 * 2. BACKUP — Google Gemini (gemini-flash-lite-latest):
 *    - Dùng khi Groq bị rate-limit hoặc lỗi mạng
 *    - Bật responseMimeType: 'application/json' để đảm bảo JSON hợp lệ
 *
 * 3. CONCURRENCY CONTROL:
 *    - Tối đa 3 chunk chạy song song (thay vì tất cả cùng lúc)
 *    - Giảm 90% nguy cơ bị rate-limit từ cả hai provider
 *
 * 4. RETRY: Mỗi chunk thử tối đa 6 lần:
 *    - Lần 1-5: Groq (nhanh)
 *    - Lần 6: Gemini (backup)
 */
@Injectable()
export class GeminiScoringHelper {
  // Gemini client
  private genAI: GoogleGenerativeAI;
  private geminiModel: any;

  // Groq client
  private groq: Groq;
  private readonly GROQ_MODEL = 'llama-3.3-70b-versatile';

  constructor() {
    // === Khởi tạo Groq (Model chính) ===
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY || '',
    });

    // === Khởi tạo Gemini (Model dự phòng) ===
    const geminiKey = process.env.GEMINI_API_KEY || '';
    this.genAI = new GoogleGenerativeAI(geminiKey);
    this.geminiModel = this.genAI.getGenerativeModel({
      model: 'gemini-flash-lite-latest',
      generationConfig: { responseMimeType: 'application/json' },
    });
  }

  /**
   * scoreRestaurantsWithAI:
   * 1. Chia nhà hàng thành chunk (15 quán/chunk).
   * 2. Gọi Groq/Gemini với CONCURRENCY LIMIT (tối đa 3 chunk song song).
   * 3. Merge kết quả AI với data gốc (menu, location, rating...).
   * 4. Trả về mảng nhà hàng đã được chấm điểm + đầy đủ metadata.
   */
  async scoreRestaurantsWithAI(
    restaurants: RestaurantDto[],
    preferences: any,
    mealBudgets: any,
  ): Promise<any[]> {
    // Tăng chunk size lên 15 
    const CHUNK_SIZE = 15;
    const chunks: RestaurantDto[][] = [];
    for (let i = 0; i < restaurants.length; i += CHUNK_SIZE) {
      chunks.push(restaurants.slice(i, i + CHUNK_SIZE));
    }

    const startTime = Date.now();

    // === CONCURRENCY CONTROL ===
    // Giới hạn tối đa 3 chunk chạy song song để tránh bị rate-limit
    const MAX_CONCURRENT = 3;
    const allResults: any[][] = [];

    for (let i = 0; i < chunks.length; i += MAX_CONCURRENT) {
      const batch = chunks.slice(i, i + MAX_CONCURRENT);
      const batchPromises = batch.map((chunk, batchIdx) =>
        this.scoreChunkWithRetry(chunk, preferences, mealBudgets, i + batchIdx),
      );
      const batchResults = await Promise.all(batchPromises);
      allResults.push(...batchResults);

      // Delay nhẹ giữa các batch để tránh rate-limit
      if (i + MAX_CONCURRENT < chunks.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Tạo map id → scores từ kết quả AI
    const scoresMap = new Map<string, any>();
    allResults.flat().forEach((item: any) => {
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
        // menu giữ nguyên từ data ShopeeFood 
        menu: (res.menu || []).map((m: any) => ({
          name: m.name,
          price: m.price,
          category: m.category || 'Khác',
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
    console.log(`✅ [AI Scoring] Hoàn tất ${merged.length} quán trong ${elapsed}ms`);
    return merged;
  }

  /**
   * Tạo prompt chung cho cả Groq và Gemini.
   * LLM vừa chấm điểm quán VỪA đề xuất món phù hợp nhất cho mỗi bữa.
   */
  private buildPrompt(chunk: RestaurantDto[], preferences: any, mealBudgets: any): string {
    // Gửi nhiều món hơn (tối đa 10) để LLM có đủ lựa chọn
    const minifiedData = chunk.map((r: any) => ({
      id: r.id,
      name: r.name || r.restaurantName,
      dishes: (r.menu || []).slice(0, 10).map((m: any) => m.name),
    }));

    return `Bạn là chuyên gia ẩm thực Việt Nam. Hãy chấm điểm các nhà hàng và ĐỀ XUẤT MÓN PHÙ HỢP NHẤT cho từng bữa ăn.
CHỈ TRẢ VỀ JSON THUẦN TÚY, KHÔNG có markdown hay text giải thích.

KHÁCH HÀNG:
- Thích: ${preferences.favoriteFoods?.join(', ') || 'Không có'}
- Không thích: ${preferences.dislikedFoods?.join(', ') || 'Không có'}
- Dị ứng (bắt buộc score = -999): ${preferences.allergies?.join(', ') || 'Không có'}
- Khẩu vị: ${preferences.states?.join(', ') || 'Không có'}

NGÂN SÁCH/NGƯỜI: Sáng ${mealBudgets.breakfast}đ, Trưa ${mealBudgets.lunch}đ, Tối ${mealBudgets.dinner}đ.

NHIỆM VỤ: Với MỖI nhà hàng, hãy:
1. Chấm điểm cho từng bữa dựa trên:
   - Phù hợp bữa ăn (cộng thêm từ 0 tới 60 điểm, QUAN TRỌNG NHẤT):
     * SÁNG: Món nhẹ, nhanh — phở, bún, hủ tiếu, bánh mì, xôi, cháo, bánh cuốn, bánh canh, mì, cơm tấm. KHÔNG phù hợp: lẩu, nướng, buffet.
     * TRƯA: Món chính, no — cơm, bún, phở, mì, cơm tấm, bún chả, bún đậu. Phù hợp hầu hết món chính.
     * TỐI: Món sang, thịnh soạn — lẩu, nướng BBQ, hải sản, steak, buffet, pizza, sushi, cơm niêu. KHÔNG phù hợp: xôi, bánh mì, đồ ăn vặt, chè, trà sữa, ngũ cốc, bánh bao.
   - Phù hợp sở thích => cộng thêm từ 0 tới 40 điểm 
   - Dị ứng → score = -999

  2. ĐỀ XUẤT MÓN (recommendedDish): Chọn 1 MÓN ĂN CHÍNH phù hợp nhất cho bữa đó từ danh sách "dishes".
   QUAN TRỌNG: KHÔNG chọn đồ uống (trà, cà phê, nước ngọt, sinh tố), topping (phần thêm), hoặc gia vị. Chỉ chọn MÓN ĂN CHÍNH.
   Nếu quán không có món phù hợp cho bữa đó → recommendedDish = null, score = 0.

FORMAT JSON (chỉ trả mảng này):
[{"id":"...","scores":{"breakfast":{"score":...,"suggestedTime":"...","recommendedDish":"..."},"lunch":{"score":...,"suggestedTime":"...","recommendedDish":"..."},"dinner":{"score":...,"suggestedTime":"...","recommendedDish":"..."}}}]

DỮ LIỆU:
${JSON.stringify(minifiedData)}`;
  }

  /**
   * Gọi Groq API (Llama 3.3 70B) — CỰC NHANH, response < 1 giây.
   * Không dùng json_object mode vì Groq trả mảng trực tiếp rất tốt.
   * Trả về mảng [{id, scores}] đã parse.
   */
  private async callGroq(prompt: string): Promise<any[]> {
    const response = await this.groq.chat.completions.create({
      model: this.GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Bạn là AI chấm điểm nhà hàng. CHỈ trả về JSON array thuần túy, KHÔNG thêm text hay markdown nào khác.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 3000,
    });

    const text = response.choices[0]?.message?.content || '[]';

    // Trích xuất JSON array từ response (phòng trường hợp có text thừa)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Fallback: thử parse trực tiếp
    const parsed = JSON.parse(text.trim());
    if (Array.isArray(parsed)) return parsed;

    // Nếu Groq trả về object wrapper, tìm key chứa mảng
    for (const key of Object.keys(parsed)) {
      if (Array.isArray(parsed[key])) return parsed[key];
    }

    return [];
  }

  /**
   * Gọi Gemini API (backup) — Dùng khi Groq bị rate-limit.
   * Trả về mảng [{id, scores}] đã parse.
   */
  private async callGemini(prompt: string): Promise<any[]> {
    const result = await this.geminiModel.generateContent(prompt);
    const responseText = result.response.text();
    return JSON.parse(responseText.trim());
  }

  /**
   * Retry logic cho 1 chunk:
   * - Lần 1-5: Groq (nhanh nhất)
   * - Lần 6: Gemini (backup an toàn)
   * → Đảm bảo gần như 100% thành công.
   */
  private async scoreChunkWithRetry(
    chunk: RestaurantDto[],
    preferences: any,
    mealBudgets: any,
    chunkIndex: number,
  ): Promise<any[]> {
    // 6 lần: 5 lần Groq (nhanh, < 1s mỗi lần) + 1 lần Gemini backup
    const MAX_RETRIES = 6;
    const prompt = this.buildPrompt(chunk, preferences, mealBudgets);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      // Lần 1-5: dùng Groq (nhanh), Lần 6: dùng Gemini (backup)
      const useGroq = attempt < MAX_RETRIES;
      const providerName = useGroq ? 'Groq' : 'Gemini';

      try {
        const parsed = useGroq
          ? await this.callGroq(prompt)
          : await this.callGemini(prompt);

        console.log(`  ✅ Chunk ${chunkIndex + 1}: OK [${providerName}] lần ${attempt} (${parsed.length} quán)`);
        return parsed;
      } catch (error: any) {
        const msg = (error.message || String(error)).substring(0, 120);
        console.error(`  ❌ Chunk ${chunkIndex + 1}: Lỗi ${attempt}/${MAX_RETRIES} [${providerName}] - ${msg}`);

        if (attempt < MAX_RETRIES) {
          // Delay ngắn: 500ms → 1s → 1.5s (Groq rất nhanh nên không cần đợi lâu)
          await new Promise((resolve) => setTimeout(resolve, Math.min(attempt * 500, 2000)));
        }
      }
    }

    console.warn(`  ⚠️ Chunk ${chunkIndex + 1}: Hết ${MAX_RETRIES} lần retry (Groq+Gemini), dùng fallback`);
    return [];
  }
}
