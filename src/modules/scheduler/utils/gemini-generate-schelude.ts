import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { RestaurantDto } from '../../restaurants/dto/restaurant.dto';

/**
 * GeminiGenerateScheduleHelper: Hỗ trợ tạo lịch trình ăn uống cuối cùng bằng trí tuệ nhân tạo (Gemini).
 * Lớp này sử dụng AI để tối ưu hóa việc chọn nhà hàng và món ăn sao cho hợp lý nhất theo sở thích và ngân sách.
 */
@Injectable()
export class GeminiGenerateScheduleHelper {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    // Khởi tạo Google AI với API Key từ biến môi trường
    const apiKey = process.env.GEMINI_API_KEY!;
    this.genAI = new GoogleGenerativeAI(apiKey);

    // Sử dụng mô hình gemini-1.5-flash-8b (phiên bản nhanh và tiết kiệm)
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash-8b',
    });
  }

  /**
   * finalizeScheduleWithAI: Sử dụng AI để sắp xếp các nhà hàng tiềm năng vào một lịch trình hoàn chỉnh.
   *
   * @param topRestaurants Danh sách các nhà hàng đã qua lọc và chấm điểm (tiềm năng nhất)
   * @param preferences Sở thích cá nhân của người dùng (ví dụ: dị ứng, phong cách ẩm thực)
   * @param mealBudgets Ngân sách phân bổ cho từng bữa ăn
   * @param totalDays Tổng số ngày di chuyển
   * @returns Mảng lịch trình JSON cho từng ngày
   */
  async finalizeScheduleWithAI(
    topRestaurants: any[],
    preferences: any,
    mealBudgets: any,
    totalDays: number,
  ) {
    // Xây dựng Prompt chi tiết để AI hiểu được các quy tắc và ràng buộc
    const prompt = `
            Bạn là một chuyên gia điều phối lịch trình du lịch thông minh.
            NHIỆM VỤ: Chọn đúng 3 quán/ngày cho hành trình ${totalDays} ngày .

            Chọn theo các ràng buộc sau:
            1. BẮT BUỘC: Mỗi bữa ăn (Sáng, Trưa, Tối) của mỗi ngày ĐỀU PHẢI có 1 quán được chọn.
            2. KHÔNG TRÙNG QUÁN trong cùng một ngày.
            3. KHÔNG TRÙNG MÓN ĂN (kể cả khác quán) trong suốt cả hành trình để tăng tính đa dạng.
            4. VỊ TRÍ: Quán được chọn cho Ngày X phải nằm trong vùng địa lý "areaDay": X.
            5. NGÂN SÁCH: Cố gắng bám sát ngân sách (Sáng ~${mealBudgets.morning}đ, Trưa ~${mealBudgets.lunch}đ, Tối ~${mealBudgets.dinner}đ).
            6. TRẢI NGHIỆM: Tránh chọn lại các "kiểu" món ăn cũ trong cùng một ngày (ví dụ: không nên ăn bún cả 2 bữa).

            DANH SÁCH QUÁN TIỀM NĂNG (Dữ liệu đầu vào):
            ${JSON.stringify(topRestaurants)}

            YÊU CẦU TRẢ VỀ DƯỚI DẠNG JSON (Mảng ${totalDays} phần tử):
            LƯU Ý CỰC KỲ QUAN TRỌNG: 
                - Trường "id" phải giữ nguyên giá trị ID kỹ thuật từ dữ liệu gốc.
                - Tuyệt đối không được trả về văn bản thừa, chỉ trả về JSON.
            [{
                "day": number,
                "meals": {
                    "breakfast": { "id": "...", "dish": "...", "price": number, "reason": "..." },
                    "lunch": { ... },
                    "dinner": { ... }
                }
            }]
        `;

    try {
      // Gửi prompt tới Gemini và nhận kết quả
      const result = await this.model.generateContent(prompt);
      const responseText = result.response
        .text()
        .replace(/```json|```/g, '')
        .trim();

      // Parse kết quả từ chuỗi văn bản sang JSON
      return JSON.parse(responseText);
    } catch (error) {
      console.error('Lỗi khi tạo lịch trình với AI:', error);
      return []; // Trả về mảng rỗng nếu có lỗi xảy ra
    }
  }
}
}
