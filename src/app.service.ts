import { Injectable } from '@nestjs/common';

/**
 * AppService chứa logic xử lý nghiệp vụ cấp cao của ứng dụng.
 * @Injectable() đánh dấu đây là một Provider có thể được inject vào các component khác.
 */
@Injectable()
export class AppService {
  /**
   * Trả về chuỗi chào mừng cơ bản.
   */
  getHello(): string {
    return 'Hello World!';
  }
}
