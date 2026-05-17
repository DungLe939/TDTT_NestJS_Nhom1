import { Module } from '@nestjs/common';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';

/**
 * ChatbotModule: Module xử lý chatbot AI (DeepSeek).
 * Proxy API call qua backend để bảo mật API Key.
 */
@Module({
  controllers: [ChatbotController],
  providers: [ChatbotService],
})
export class ChatbotModule {}
