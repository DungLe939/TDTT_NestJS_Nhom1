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
  const ALLOWED_ORIGINS = [
    'http://localhost:5173',  // Vite dev server (mặc định)
    'http://localhost:5174',  // Vite dev server (port thay thế)
    'http://localhost:3001',  // CRA dev server (nếu dùng)
    'http://127.0.0.1:5173',
    // Khi dùng Pinggy: thêm link FE Pinggy vào đây
    // 'https://your-frontend.a.pinggy.link',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Cho phép tất cả các origin trong môi trường development, 
      // nhưng trả về chính origin đó thay vì '*' để thỏa mãn credentials: true
      callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Pinggy-No-Screen', 'x-pinggy-no-screen', 'Accept', 'Origin', 'Cookie'],
    credentials: true,  // Cho phép gửi/nhận Cookie (guest_id session)
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
