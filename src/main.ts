import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

/**
 * Hàm khởi tạo ứng dụng NestJS (Bootstrap).
 * Đây là điểm bắt đầu (Entry Point) của toàn bộ project.
 */
async function bootstrap() {
  // Tạo instance của ứng dụng NestJS từ AppModule
  const app = await NestFactory.create(AppModule);

  // ----------------------------------------------------------------------
  // [HƯỚNG DẪN DÀNH CHO NHÓM] - LƯU Ý VỀ BẢO MẬT KHI DÙNG PINGGY
  // ----------------------------------------------------------------------
  // Tại sao phải có dòng app.enableCors() này?
  // Bình thường, React chạy ở `localhost:5173`, còn NestJS chạy ở `localhost:3000`.
  // Khi dùng Pinggy, NestJS biến thành link `https://xxx.a.pinggy.link`.
  // Trình duyệt sẽ chặn React vì nó cố giao tiếp với một "người lạ" khác địa chỉ.
  // Dòng code này chính là để cấp quyền "cho phép React đi qua cửa".
  // Đừng bao giờ xóa dòng này nếu bạn muốn test API trên internet nhé!
  // ----------------------------------------------------------------------
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: '*',
    credentials: true,
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
