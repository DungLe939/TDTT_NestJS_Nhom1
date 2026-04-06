import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common'; // Thêm dòng này

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Kích hoạt tính năng kiểm tra dữ liệu cho toàn bộ các DTO
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,       // Loại bỏ các trường không được định nghĩa trong DTO
    forbidNonWhitelisted: true, // Báo lỗi nếu user gửi thêm trường lạ
    transform: true,       // Tự động chuyển kiểu dữ liệu (ví dụ chuỗi "10" thành số 10)
  }));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
