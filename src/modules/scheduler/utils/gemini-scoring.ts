import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { RestaurantDto } from "../../restaurants/dto/restaurant.dto";

@Injectable()
export class GeminiScoringHelper {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY!;
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
    }

    async scoreRestaurantsWithAI(restaurants: RestaurantDto[], preferences: any, mealBudgets: any) {
        const prompt = `
            Bạn là một AI chuyên gia phân tích ẩm thực và du lịch tại Việt Nam.
            NHIỆM VỤ: Chấm điểm danh sách nhà hàng dựa trên hồ sơ khách hàng.

            HỒ SƠ KHÁCH HÀNG:
            - Sở thích: ${preferences.favoriteFoods?.join(", ")}
            - Không thích: ${preferences.dislikedFoods?.join(", ")}
            - Dị ứng (LOẠI BỎ NGAY): ${preferences.allergies?.join(", ")}
            - Khẩu vị: ${preferences.states?.join(", ")}

            NGÂN SÁCH MỤC TIÊU (VND):
            - Sáng: ${mealBudgets.breakfast}, Trưa: ${mealBudgets.lunch}, Tối: ${mealBudgets.dinner}

            DANH SÁCH NHÀ HÀNG (JSON):
            ${JSON.stringify(restaurants)}

            QUY TẮC CHẤM ĐIỂM (TỔNG ĐIỂM CÓ THỂ > 100):
            1. Phù hợp buổi (Sáng/Trưa/Tối): +50đ (Dựa vào Menu và tên quán).
            2. Phù hợp sở thích/khẩu vị: +30đ.
            3. Phù hợp ngân sách: +30đ (Giá món chính gần bằng ngân sách mục tiêu).
            4. Món trùng lặp danh mục đã ăn: không cộng điểm.
            5. LOẠI BỎ (Điểm = -999) nếu: Chứa thành phần dị ứng, món khách không thích, hoặc NGOÀI GIỜ HOẠT ĐỘNG.

            YÊU CẦU TRẢ VỀ JSON NGHIÊM NGẶT (Mảng các đối tượng):
            lưu ý : 
                - id lấy từ Database phải chính xác nhé
                - Thêm trường "category" cho mỗi món ăn. 
                    Ví dụ "bún bò", "bún chả" thì category là "bún". "phở bò", "phở gà" thì category là "phở".
                - BẮT BUỘC CHÉP LẠI ĐẦY ĐỦ 100% CÁC MÓN TRONG THẺ MENU CỦA MỖI QUÁN. KHÔNG ĐƯỢC LƯỢC BỎ BẤT KỲ MÓN NÀO.
            [{
                "id": "...",
                "restaurantName": "...",
                "menu": [
                {
                    "name": "...",
                    "price": number,
                    "score": number,
                    "category": "..."
                }
                ],
                "scores": {
                "breakfast": { "score": number, "suggestedTime": "HH:mm" },
                "lunch": { "score": number, "suggestedTime": "HH:mm" },
                "dinner": { "score": number, "suggestedTime": "HH:mm" }
                }
            }]
            lưu ý thêm:
                - suggestedTime: hãy gợi ý thời gian ăn phù hợp cho từng buổi (ví dụ Sáng: 07:00-09:00, Trưa: 11:30-13:00, Tối: 18:00-20:00).
            `;

        try {
            const result = await this.model.generateContent(prompt);
            const responseText = result.response.text().replace(/```json|```/g, "").trim();
            return JSON.parse(responseText);
        } catch (error) {
            console.error("Gemini Scoring Error:", error);
            return [];
        }
    }
}