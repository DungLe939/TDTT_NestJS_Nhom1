import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

/**
 * Hàm khởi tạo ứng dụng NestJS (Bootstrap).
 * Đây là điểm bắt đầu (Entry Point) của toàn bộ project.
 */
async function bootstrap() {
  // Tạo instance của ứng dụng NestJS từ AppModule
  const app = await NestFactory.create(AppModule);

  // Cấu hình CORS (Cross-Origin Resource Sharing)
  // Cho phép các yêu cầu từ các domain khác (ví dụ: frontend ReactJS)
  app.enableCors({
    origin: true, // Chấp nhận tất cả các origin (hoặc cấu hình domain cụ thể)
    credentials: true, // Cho phép gửi kèm cookie/auth headers
  });

  // Sử dụng middleware để parse Cookie từ request
  app.use(cookieParser());

  /**
   * Cấu hình ValidationPipe toàn cục.
   * Giúp tự động kiểm tra và chuyển đổi dữ liệu đầu vào dựa trên class-validator trong DTO.
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Tự động loại bỏ các thuộc tính không được khai báo trong DTO
      forbidNonWhitelisted: true, // Trả về lỗi nếu request chứa thuộc tính lạ
      transform: true, // Tự động chuyển đổi kiểu dữ liệu (ví dụ: string "1" -> number 1)
    }),
  );

  // Lắng nghe ứng dụng trên PORT từ file .env hoặc mặc định là 3000
  await app.listen(process.env.PORT ?? 3000);
}

// Chạy hàm bootstrap để khởi động server
bootstrap();
