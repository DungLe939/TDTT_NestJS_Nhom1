import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatRequestDto } from './dto/chat.dto';

/**
 * ChatbotController: Endpoint proxy cho DeepSeek API.
 * Frontend gọi endpoint này thay vì gọi trực tiếp DeepSeek → bảo mật API Key.
 * 
 * Endpoint: POST /chatbot/send
 */
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  /**
   * Nhận tin nhắn từ frontend, chuyển tiếp tới DeepSeek, trả kết quả về.
   * API Key được thêm ở tầng service, frontend KHÔNG cần biết key.
   */
  @Post('send')
  async sendMessage(@Body() dto: ChatRequestDto) {
    try {
      const reply = await this.chatbotService.chat(dto);
      return {
        success: true,
        data: { reply },
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Lỗi xử lý chatbot',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
