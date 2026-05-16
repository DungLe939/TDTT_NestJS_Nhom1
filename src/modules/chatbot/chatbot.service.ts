import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ChatRequestDto } from './dto/chat.dto';

/**
 * ChatbotService: Xử lý logic gọi DeepSeek API.
 * API Key được lưu ở biến môi trường backend, KHÔNG bao giờ gửi về frontend.
 */
@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private readonly apiKey: string;
  private readonly apiUrl = 'https://api.deepseek.com/chat/completions';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('DEEPSEEK_API_KEY', '');
    if (!this.apiKey) {
      this.logger.warn('⚠️ DEEPSEEK_API_KEY chưa được cấu hình trong .env');
    }
  }

  /**
   * Gửi tin nhắn tới DeepSeek API và nhận phản hồi.
   * @param dto - Dữ liệu chat từ frontend (message + history + user context)
   * @returns Nội dung phản hồi từ AI
   */
  async chat(dto: ChatRequestDto): Promise<string> {
    if (!this.apiKey) {
      throw new Error('DeepSeek API Key chưa được cấu hình.');
    }

    const systemPrompt = `Bạn là trợ lý ẩm thực thông minh của TasteTrekker. 
Bạn chuyên về ẩm thực Việt Nam, đặc sản vùng miền và tư vấn quán ăn.
Thông tin người dùng: Tên: ${dto.userName || 'Khách'}, Dị ứng: ${dto.userAllergies || 'Không'}.
Hãy trả lời thân thiện, ngắn gọn và hữu ích.`;

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...(dto.history || []),
        { role: 'user', content: dto.message },
      ];

      const response = await axios.post(
        this.apiUrl,
        {
          model: 'deepseek-chat',
          messages,
          stream: false,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30s timeout
        },
      );

      return response.data.choices[0].message.content;
    } catch (error: any) {
      this.logger.error(`DeepSeek API Error: ${error.message}`, error.stack);

      if (error.response?.status === 401) {
        throw new Error('API Key không hợp lệ hoặc đã hết hạn.');
      }
      if (error.response?.status === 429) {
        throw new Error('Đã vượt quá giới hạn request. Vui lòng thử lại sau.');
      }

      throw new Error('Không thể kết nối tới AI. Vui lòng thử lại sau.');
    }
  }
}
