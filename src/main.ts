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
    origin: (origin, callback) => {
      // Cho phép tất cả các origin trong môi trường development, 
      // nhưng trả về chính origin đó thay vì '*' để thỏa mãn credentials: true
      callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Pinggy-No-Screen', 'x-pinggy-no-screen', 'Accept', 'Origin'],
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
  const server = app.getHttpServer();
  server.timeout = 300000; // 5 phút
  server.keepAliveTimeout = 305000;

  await app.listen(process.env.PORT || 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}

// Chạy hàm bootstrap để khởi động server
bootstrap();
