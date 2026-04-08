import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

/**
 * AppController xử lý các yêu cầu HTTP cơ bản ở cấp độ gốc (root).
 */
@Controller()
export class AppController {
  // Inject AppService vào controller
  constructor(private readonly appService: AppService) {}

  /**
   * Endpoint mặc định khi truy cập vào đường dẫn gốc (/).
   * Trả về chuỗi chào mừng từ AppService.
   */
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
