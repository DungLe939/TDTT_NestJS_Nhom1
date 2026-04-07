import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { RestaurantDto } from "../../restaurants/dto/restaurant.dto";

@Injectable()
export class GeminiGenerateScheduleHelper {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY!;
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
    }

    async finalizeScheduleWithAI(topRestaurants: any[], preferences: any, mealBudgets: any, totalDays: number) {
        const prompt = `
            Bạn là một chuyên gia điều phối lịch trình du lịch thông minh.
            NHIỆM VỤ: Chọn đúng 3 quán/ngày cho hành trình ${totalDays} ngày .

            Chọn theo các ràng buộc sau:
            1. BẮT BUỘC: Mỗi bữa ăn (Sáng, Trưa, Tối) của mỗi ngày ĐỀU PHẢI có 1 quán được chọn. Tuyệt đối không được trả về "Chưa có quán phù hợp" hay để trống.
            2. KHÔNG TRÙNG QUÁN trong cùng một ngày. Các ngày khác nhau thì có thể ăn cùng quán nhưng phải khác món.
            3. KHÔNG TRÙNG MÓN ĂN(kể cả khác quán) trong suốt cả hành trình.
            4. VỊ TRÍ: Quán được chọn cho Ngày X phải có "areaDay": X.
            5. NGÂN SÁCH: Cố gắng bám sát ngân sách (Sáng ~${mealBudgets.morning}đ, Trưa ~${mealBudgets.lunch}đ, Tối ~${mealBudgets.dinner}đ). Nếu không có quán nào đúng giá, hãy chọn quán có giá gần nhất.
            6. Tăng trải nghiệm của khách hàng: trong một ngày không nên chọn lại "kiểu" món ăn cũ(ví dụ sáng ăn bún bò, thì các buổi còn lại không nên ăn bún chả chẳng hạn)

            QUY TẮC CHỌN KHI DỮ LIỆU KHÔNG HOÀN HẢO:
            - Nếu một bữa ăn không có quán nào có điểm buổi đó cao, hãy chọn quán có điểm cao nhất hiện có cho buổi đó trong danh sách "areaDay" tương ứng.
            - Nếu tất cả các món đều đã trùng, hãy chọn lại món ngon nhất nhưng ưu tiên khác tên quán.

            DANH SÁCH QUÁN TIỀM NĂNG:
            ${JSON.stringify(topRestaurants)}

            YÊU CẦU TRẢ VỀ JSON (Mảng ${totalDays} phần tử):
            LƯU Ý CỰC KỲ QUAN TRỌNG: 
                - Trường "id" phải là chuỗi ID kỹ thuật (ví dụ: "08XS8pFEa...") lấy từ dữ liệu gốc. 
                - TUYỆT ĐỐI KHÔNG được dùng tên quán (restaurantName) để thay thế cho trường "id". 
                - Nếu bạn sai ID, hệ thống sẽ bị sập.
                - Tuyệt đối không được chọn trùng món ăn trong cả lịch trình.
            [{
                "day": number,
                "meals": {
                    "breakfast": 
                        { 
                            "id": "...", 
                            "dish": "...", 
                            "price": number, 
                            "reason": "..." 
                        },
                    "lunch": { ... },
                    "dinner": { ... }
                }
            }]
            `;

        try {
            const result = await this.model.generateContent(prompt);
            const responseText = result.response.text().replace(/```json|```/g, "").trim();
            return JSON.parse(responseText);
        } catch (error) {
            console.error("Finalize Schedule Error:", error);
            return [];
        }
    }
}