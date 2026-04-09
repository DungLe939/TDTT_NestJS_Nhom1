import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { RestaurantDto } from "../../restaurants/dto/restaurant.dto";

/**
 * GeminiScoringHelper: Hỗ trợ chấm điểm các nhà hàng bằng AI dựa trên hồ sơ người dùng.
 * AI sẽ phân tích menu và thông tin nhà hàng để đưa ra điểm số cho từng bữa ăn (Sáng, Trưa, Tối).
 */
@Injectable()
export class GeminiScoringHelper {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor() {
        // Khởi tạo Gemini với API Key
        const apiKey = process.env.GEMINI_API_KEY!;
        this.genAI = new GoogleGenerativeAI(apiKey);
        
        // Sử dụng mô hình flash để đạt tốc độ xử lý nhanh nhất
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    }

    /**
     * scoreRestaurantsWithAI: Gửi danh sách nhà hàng và sở thích người dùng cho AI để chấm điểm.
     * 
     * @param restaurants Danh sách nhà hàng cần chấm điểm
     * @param preferences Sở thích/Dị ứng của người dùng
     * @param mealBudgets Ngân sách cho từng bữa ăn
     */
    async scoreRestaurantsWithAI(restaurants: RestaurantDto[], preferences: any, mealBudgets: any) {
        // Xây dựng Prompt với đầy đủ các quy tắc nghiệp vụ
        const prompt = `
            Bạn là một chuyên gia AI về ẩm thực và du lịch tại Việt Nam.
            NHIỆM VỤ: Phân tích menu và chấm điểm nhà hàng dựa trên hồ sơ khách hàng sau:

            HỒ SƠ KHÁCH HÀNG:
            - Sở thích: ${preferences.favoriteFoods?.join(", ")}
            - Không thích: ${preferences.dislikedFoods?.join(", ")}
            - Dị ứng (LOẠI BỎ NGAY - ĐIỂM = -999): ${preferences.allergies?.join(", ")}
            - Khẩu vị: ${preferences.states?.join(", ")}

            NGÂN SÁCH MỤC TIÊU:
            - Sáng: ${mealBudgets.breakfast}đ, Trưa: ${mealBudgets.lunch}đ, Tối: ${mealBudgets.dinner}đ

            QUY TẮC CHẤM ĐIỂM:
            1. Phù hợp buổi (Sáng/Trưa/Tối): +50đ (Dựa vào món ăn trong menu).
            2. Phù hợp sở thích: +30đ.
            3. Phù hợp ngân sách: +30đ.
            4. Phân loại "isSnack": true cho đồ uống/ăn nhẹ, false cho món ăn chính.
            5. Ghi chú ID từ dữ liệu gốc phải giữ nguyên hoàn toàn.

            TRẢ VỀ JSON (Dạng mảng):
            [{
                "id": "...",
                "restaurantName": "...",
                "menu": [{ "name": "...", "price": number, "score": number, "category": "...", "isSnack": boolean }],
                "scores": {
                    "breakfast": { "score": number, "suggestedTime": "HH:mm" },
                    "lunch": { "score": number, "suggestedTime": "HH:mm" },
                    "dinner": { "score": number, "suggestedTime": "HH:mm" }
                }
            }]

            DANH SÁCH NHÀ HÀNG:
            ${JSON.stringify(restaurants)}
        `;

        try {
            const result = await this.model.generateContent(prompt);
            const responseText = result.response.text().replace(/```json|```/g, "").trim();
            
            // Trả về kết quả sau khi AI đã phân tích và chấm điểm
            return JSON.parse(responseText);
        } catch (error) {
            console.error("Lỗi khi chấm điểm với Gemini:", error);
            return [];
        }
    }
}